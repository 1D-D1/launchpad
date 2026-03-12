/**
 * Worker: competitive-analysis
 * Fetches competitor data, calls internal AI analyze endpoint, stores results.
 * On success, enqueues strategy-generation job.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { callInternalApi } from '@/lib/internal-api';
import {
  getRedisConnection,
  QUEUE_COMPETITIVE_ANALYSIS,
} from '@/server/jobs/queue';

export interface CompetitiveAnalysisJobData {
  projectId: string;
  pipelineJobId: string;
}

const log = logger.child({ worker: QUEUE_COMPETITIVE_ANALYSIS });

async function processCompetitiveAnalysis(job: Job<CompetitiveAnalysisJobData>): Promise<void> {
  const { projectId, pipelineJobId } = job.data;
  log.info({ projectId, pipelineJobId, jobId: job.id }, 'Starting competitive analysis');

  // Mark pipeline job as RUNNING
  await prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  }).catch((err) => log.warn({ err, pipelineJobId }, 'Failed to update pipeline job status to RUNNING'));

  try {
    job.updateProgress(10);

    // Call the internal AI analyze endpoint
    const analysisResult = await callInternalApi('/api/internal/ai/analyze', {
      projectId,
    }, { timeoutMs: 180_000 }); // 3 min timeout for analysis

    job.updateProgress(80);

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'STRATEGIZING' },
    });

    // Mark pipeline job as COMPLETED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: analysisResult as any,
      },
    });

    job.updateProgress(100);
    log.info({ projectId }, 'Competitive analysis completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, pipelineJobId, err }, 'Competitive analysis failed');

    // Mark pipeline job as FAILED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: errorMessage,
      },
    }).catch((updateErr) => log.warn({ updateErr, pipelineJobId }, 'Failed to update pipeline job status to FAILED'));

    throw err; // Re-throw so BullMQ marks the job as failed for retry
  }
}

export function createCompetitiveAnalysisWorker(): Worker<CompetitiveAnalysisJobData> {
  const worker = new Worker<CompetitiveAnalysisJobData>(
    QUEUE_COMPETITIVE_ANALYSIS,
    processCompetitiveAnalysis,
    {
      connection: getRedisConnection(),
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000, // max 10 jobs per minute
      },
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
