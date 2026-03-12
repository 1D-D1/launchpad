/**
 * Pipeline orchestrator processor.
 * Chains pipeline stages sequentially, managing state transitions and error handling.
 */

import type { Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_MAP,
  getNextStage,
  type PipelineStageKey,
} from '@/types/pipeline';
import type { ProjectStatus } from '@prisma/client';
import {
  getQueue,
  getQueueEvents,
  QUEUE_COMPETITIVE_ANALYSIS,
  QUEUE_STRATEGY_GENERATION,
  QUEUE_CONTENT_GENERATION,
  QUEUE_SOCIAL_PUBLISHING,
  QUEUE_ADS_CAMPAIGN,
  QUEUE_EMAIL_CAMPAIGN,
  type QueueName,
} from '@/server/jobs/queue';
import { notifyPipelineStageComplete, notifyPipelineError } from '@/server/services/notifications/email-notify';

// ---------------------------------------------------------------------------
// Stage-to-queue mapping
// ---------------------------------------------------------------------------

const STAGE_QUEUE_MAP: Record<PipelineStageKey, QueueName | null> = {
  ANALYSIS: QUEUE_COMPETITIVE_ANALYSIS,
  STRATEGY: QUEUE_STRATEGY_GENERATION,
  CONTENT_GENERATION: QUEUE_CONTENT_GENERATION,
  CONTENT_REVIEW: null, // manual step -- pauses pipeline for user approval
  AD_CAMPAIGN_SETUP: QUEUE_ADS_CAMPAIGN,
  EMAIL_SEQUENCE_SETUP: QUEUE_EMAIL_CAMPAIGN,
  PUBLISHING: QUEUE_SOCIAL_PUBLISHING,
  MONITORING: null, // monitoring runs as a long-lived scheduled job, not a one-shot stage
};

const STAGE_PROJECT_STATUS: Record<PipelineStageKey, ProjectStatus> = {
  ANALYSIS: 'ANALYZING',
  STRATEGY: 'STRATEGIZING',
  CONTENT_GENERATION: 'GENERATING_CONTENT',
  CONTENT_REVIEW: 'GENERATING_CONTENT', // stays in generating until review is done
  AD_CAMPAIGN_SETUP: 'RUNNING_ADS',
  EMAIL_SEQUENCE_SETUP: 'EMAILING',
  PUBLISHING: 'PUBLISHING',
  MONITORING: 'ACTIVE',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getProjectWithUser(projectId: string) {
  return prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { user: { select: { id: true, email: true } } },
  });
}

function buildProjectUrl(projectId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/dashboard/projects/${projectId}`;
}

async function createPipelineJob(projectId: string, stageKey: PipelineStageKey) {
  return prisma.pipelineJob.create({
    data: {
      projectId,
      stage: stageKey,
      status: 'PENDING',
    },
  });
}

async function updatePipelineJob(
  pipelineJobId: string,
  status: 'RUNNING' | 'COMPLETED' | 'FAILED',
  error?: string,
) {
  return prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: {
      status,
      ...(status === 'RUNNING' ? { startedAt: new Date() } : {}),
      ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
      ...(error ? { error } : {}),
    },
  });
}

async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status },
  });
}

// ---------------------------------------------------------------------------
// Core: wait for a BullMQ job to finish using QueueEvents
// ---------------------------------------------------------------------------

async function waitForJobCompletion(queueName: QueueName, jobId: string): Promise<void> {
  const queueEvents = getQueueEvents(queueName);

  return new Promise<void>((resolve, reject) => {
    const onCompleted = ({ jobId: completedId }: { jobId: string }) => {
      if (completedId === jobId) {
        cleanup();
        resolve();
      }
    };

    const onFailed = ({
      jobId: failedId,
      failedReason,
    }: {
      jobId: string;
      failedReason: string;
    }) => {
      if (failedId === jobId) {
        cleanup();
        reject(new Error(failedReason));
      }
    };

    function cleanup() {
      queueEvents.off('completed', onCompleted);
      queueEvents.off('failed', onFailed);
    }

    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);
  });
}

// ---------------------------------------------------------------------------
// Run a single stage
// ---------------------------------------------------------------------------

async function runStage(projectId: string, stageKey: PipelineStageKey): Promise<void> {
  const stageDef = PIPELINE_STAGE_MAP.get(stageKey);
  if (!stageDef) throw new Error(`Unknown pipeline stage: ${stageKey}`);

  const log = logger.child({ projectId, stage: stageKey });

  // If this is a manual/non-queue stage, mark it and return
  const queueName = STAGE_QUEUE_MAP[stageKey];
  if (!queueName) {
    log.info('Stage does not have an associated queue -- skipping automated execution');

    if (stageKey === 'CONTENT_REVIEW') {
      // The pipeline pauses here; a separate approval endpoint resumes it
      log.info('Pipeline paused for content review');
      return;
    }

    if (stageKey === 'MONITORING') {
      // Monitoring is handled by a recurring scheduled job
      log.info('Monitoring stage reached -- pipeline complete');
      await updateProjectStatus(projectId, 'ACTIVE');
      return;
    }

    return;
  }

  // Create a DB record for this pipeline job
  const pipelineJob = await createPipelineJob(projectId, stageKey);

  // Update project status
  const projectStatus = STAGE_PROJECT_STATUS[stageKey];
  await updateProjectStatus(projectId, projectStatus);

  // Enqueue the work
  const queue = getQueue(queueName);
  const bullJob = await queue.add(stageKey, { projectId, pipelineJobId: pipelineJob.id });

  if (!bullJob.id) throw new Error('BullMQ did not assign a job ID');

  await updatePipelineJob(pipelineJob.id, 'RUNNING');
  log.info({ bullJobId: bullJob.id }, 'Job enqueued, waiting for completion');

  // Wait for the worker to finish
  await waitForJobCompletion(queueName, bullJob.id);

  await updatePipelineJob(pipelineJob.id, 'COMPLETED');
  log.info('Stage completed');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full pipeline for a project, starting from the first stage
 * (or from a specific starting stage).
 */
export async function runPipeline(
  projectId: string,
  startFromStage?: PipelineStageKey,
): Promise<void> {
  const log = logger.child({ projectId });
  log.info({ startFromStage }, 'Pipeline started');

  const project = await getProjectWithUser(projectId);

  // Determine which stages to run
  const startOrder = startFromStage
    ? (PIPELINE_STAGE_MAP.get(startFromStage)?.order ?? 1)
    : 1;

  const stagesToRun = PIPELINE_STAGES.filter((s) => s.order >= startOrder);

  for (const stageDef of stagesToRun) {
    try {
      await runStage(projectId, stageDef.key);

      // If this is a pause point (CONTENT_REVIEW), stop the loop.
      // The pipeline will be resumed via retryStage or a dedicated resume endpoint.
      if (stageDef.key === 'CONTENT_REVIEW') {
        log.info('Pipeline paused at CONTENT_REVIEW -- awaiting user approval');
        return;
      }

      // Send success notification
      const nextStage = getNextStage(stageDef.key);
      const nextStageDef = nextStage ? PIPELINE_STAGE_MAP.get(nextStage) : undefined;

      await notifyPipelineStageComplete({
        userEmail: project.user.email,
        projectName: project.name,
        stageName: stageDef.label,
        nextStageName: nextStageDef?.label,
        projectUrl: buildProjectUrl(projectId),
      }).catch((err) => {
        // Notification failure should not stop the pipeline
        log.warn({ err }, 'Failed to send stage completion notification');
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error({ err, stage: stageDef.key }, 'Pipeline stage failed');

      // Update project status to reflect failure
      await updateProjectStatus(projectId, 'PAUSED').catch(() => {});

      // Send failure notification
      await notifyPipelineError({
        userEmail: project.user.email,
        projectName: project.name,
        stageName: stageDef.label,
        errorMessage,
        projectUrl: buildProjectUrl(projectId),
      }).catch((notifErr) => {
        log.warn({ err: notifErr }, 'Failed to send error notification');
      });

      throw err; // Re-throw so the orchestrator worker marks the job as failed
    }
  }

  log.info('Pipeline completed all stages');
  await updateProjectStatus(projectId, 'COMPLETED');
}

/**
 * Retry (re-run) a single pipeline stage, then continue the remaining stages.
 */
export async function retryStage(
  projectId: string,
  stageName: PipelineStageKey,
): Promise<void> {
  const log = logger.child({ projectId, retryStage: stageName });
  log.info('Retrying stage and continuing pipeline');

  await runPipeline(projectId, stageName);
}
