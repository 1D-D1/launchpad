/**
 * Worker: strategy-generation
 * Takes competitive analysis results and generates a comprehensive marketing strategy via Claude.
 * On success, enqueues content-generation job.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { callInternalApi } from '@/lib/internal-api';
import {
  getRedisConnection,
  QUEUE_STRATEGY_GENERATION,
} from '@/server/jobs/queue';

export interface StrategyGenerationJobData {
  projectId: string;
  pipelineJobId: string;
}

const log = logger.child({ worker: QUEUE_STRATEGY_GENERATION });

async function processStrategyGeneration(job: Job<StrategyGenerationJobData>): Promise<void> {
  const { projectId, pipelineJobId } = job.data;
  log.info({ projectId, pipelineJobId, jobId: job.id }, 'Starting strategy generation');

  // Mark pipeline job as RUNNING
  await prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  }).catch((err) => log.warn({ err, pipelineJobId }, 'Failed to update pipeline job status to RUNNING'));

  try {
    job.updateProgress(20);

    // Call the internal AI strategy endpoint
    const strategyResult = await callInternalApi('/api/internal/ai/strategy', {
      projectId,
    }, { timeoutMs: 180_000 });

    job.updateProgress(80);

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'GENERATING_CONTENT' },
    });

    // Mark pipeline job as COMPLETED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: strategyResult as any,
      },
    });

    job.updateProgress(100);
    log.info({ projectId }, 'Strategy generation completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, pipelineJobId, err }, 'Strategy generation failed');

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

export function createStrategyGenerationWorker(): Worker<StrategyGenerationJobData> {
  const worker = new Worker<StrategyGenerationJobData>(
    QUEUE_STRATEGY_GENERATION,
    processStrategyGeneration,
    {
      connection: getRedisConnection(),
      concurrency: 3,
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
