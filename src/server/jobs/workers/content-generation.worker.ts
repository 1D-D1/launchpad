/**
 * Worker: content-generation
 * Generates social posts, ad copy, email sequences, and landing pages from the strategy.
 * Calls the internal AI content endpoint sequentially for each content type.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { callInternalApi } from '@/lib/internal-api';
import { getRedisConnection, QUEUE_CONTENT_GENERATION } from '@/server/jobs/queue';

export interface ContentGenerationJobData {
  projectId: string;
  pipelineJobId: string;
}

const log = logger.child({ worker: QUEUE_CONTENT_GENERATION });

// Content types to generate in sequence
const CONTENT_TYPES = [
  { type: 'SOCIAL_POST', count: 10, label: 'social posts' },
  { type: 'AD_COPY', count: 5, label: 'ad copy' },
  { type: 'EMAIL', count: 5, label: 'email sequences' },
] as const;

async function processContentGeneration(job: Job<ContentGenerationJobData>): Promise<void> {
  const { projectId, pipelineJobId } = job.data;
  log.info({ projectId, pipelineJobId, jobId: job.id }, 'Starting content generation');

  // Mark pipeline job as RUNNING
  await prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  }).catch((err) => log.warn({ err, pipelineJobId }, 'Failed to update pipeline job status to RUNNING'));

  try {
    job.updateProgress(10);

    const results: Array<{ type: string; count: number; success: boolean; error?: string }> = [];
    let totalGenerated = 0;

    // Generate each content type in sequence to avoid overwhelming the AI API
    for (let i = 0; i < CONTENT_TYPES.length; i++) {
      const contentType = CONTENT_TYPES[i];
      log.info({ projectId, contentType: contentType.type }, `Generating ${contentType.label}`);

      try {
        const result = await callInternalApi<{ count: number; contentIds: string[] }>(
          '/api/internal/ai/content',
          {
            projectId,
            type: contentType.type,
            count: contentType.count,
          },
          { timeoutMs: 180_000 }, // 3 min per content type
        );

        const generatedCount = result.count || 0;
        totalGenerated += generatedCount;
        results.push({ type: contentType.type, count: generatedCount, success: true });
        log.info({ projectId, contentType: contentType.type, count: generatedCount }, `Generated ${contentType.label}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn({ projectId, contentType: contentType.type, err }, `Failed to generate ${contentType.label}`);
        results.push({ type: contentType.type, count: 0, success: false, error: errorMsg });
      }

      // Update progress proportionally
      const progressPct = 10 + Math.round(((i + 1) / CONTENT_TYPES.length) * 80);
      job.updateProgress(progressPct);
    }

    // Check if at least some content was generated
    const successCount = results.filter((r) => r.success).length;
    if (successCount === 0) {
      throw new Error('All content generation batches failed: ' + results.map((r) => r.error).join('; '));
    }

    if (successCount < CONTENT_TYPES.length) {
      log.warn(
        { projectId, results },
        'Some content generation batches failed, continuing with partial results',
      );
    }

    // Mark pipeline job as COMPLETED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { totalGenerated, details: results } as any,
      },
    });

    job.updateProgress(100);
    log.info({ projectId, totalGenerated, results }, 'Content generation completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, pipelineJobId, err }, 'Content generation failed');

    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: errorMessage,
      },
    }).catch((updateErr) => log.warn({ updateErr, pipelineJobId }, 'Failed to update pipeline job status to FAILED'));

    throw err;
  }
}

export function createContentGenerationWorker(): Worker<ContentGenerationJobData> {
  const worker = new Worker<ContentGenerationJobData>(
    QUEUE_CONTENT_GENERATION,
    processContentGeneration,
    {
      connection: getRedisConnection(),
      concurrency: 2, // lower concurrency -- AI calls are expensive
    },
  );

  worker.on('completed', (job) => {
    log.info({ jobId: job.id, projectId: job.data.projectId }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    log.error(
      { jobId: job?.id, projectId: job?.data.projectId, err },
      'Job failed',
    );
  });

  worker.on('error', (err) => {
    log.error({ err }, 'Worker error');
  });

  return worker;
}
