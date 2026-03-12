/**
 * Worker: pipeline-orchestrator
 * Listens on the pipeline-orchestrator queue and runs the full pipeline for a project.
 * Orchestrates all stages in sequence, handles failures and retries.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { getRedisConnection, QUEUE_PIPELINE_ORCHESTRATOR } from '@/server/jobs/queue';
import { runPipeline } from '@/server/jobs/processors/pipeline';
import type { PipelineStageKey } from '@/types/pipeline';

export interface PipelineOrchestratorJobData {
  projectId: string;
  startFromStage?: PipelineStageKey;
}

const log = logger.child({ worker: QUEUE_PIPELINE_ORCHESTRATOR });

async function processOrchestrator(job: Job<PipelineOrchestratorJobData>): Promise<void> {
  const { projectId, startFromStage } = job.data;
  log.info({ projectId, startFromStage, jobId: job.id }, 'Pipeline orchestrator starting');

  try {
    // Update project status to indicate pipeline is running
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ANALYZING' },
    }).catch((err) => log.warn({ err }, 'Failed to update initial project status'));

    await runPipeline(projectId, startFromStage);

    log.info({ projectId }, 'Pipeline orchestrator finished successfully');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, err }, 'Pipeline orchestrator failed');

    // Ensure project is in a recoverable state
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'PAUSED' },
    }).catch((updateErr) => log.warn({ updateErr }, 'Failed to update project status to PAUSED'));

    throw err; // Re-throw for BullMQ retry logic
  }
}

export function createPipelineOrchestratorWorker(): Worker<PipelineOrchestratorJobData> {
  const worker = new Worker<PipelineOrchestratorJobData>(
    QUEUE_PIPELINE_ORCHESTRATOR,
    processOrchestrator,
    {
      connection: getRedisConnection(),
      concurrency: 5, // allow multiple pipelines to run in parallel
    },
  );

  worker.on('completed', (job) => {
    log.info({ jobId: job.id, projectId: job.data.projectId }, 'Pipeline completed');
  });

  worker.on('failed', (job, err) => {
    log.error(
      { jobId: job?.id, projectId: job?.data.projectId, err },
      'Pipeline failed',
    );
  });

  worker.on('error', (err) => {
    log.error({ err }, 'Pipeline orchestrator worker error');
  });

  return worker;
}
