/**
 * Worker: social-publishing
 * Publishes approved content to connected social media platforms.
 * Fetches approved SOCIAL_POST content and uses the publishing scheduler.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { getRedisConnection, QUEUE_SOCIAL_PUBLISHING } from '@/server/jobs/queue';
import { PublishingScheduler } from '@/server/services/publishing/scheduler';

export interface SocialPublishingJobData {
  projectId: string;
  pipelineJobId: string;
}

const log = logger.child({ worker: QUEUE_SOCIAL_PUBLISHING });

async function processSocialPublishing(job: Job<SocialPublishingJobData>): Promise<void> {
  const { projectId, pipelineJobId } = job.data;
  log.info({ projectId, pipelineJobId, jobId: job.id }, 'Starting social publishing');

  // Mark pipeline job as RUNNING
  await prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  }).catch((err) => log.warn({ err, pipelineJobId }, 'Failed to update pipeline job status to RUNNING'));

  try {
    // 1. Fetch approved social content for this project
    const contents = await prisma.content.findMany({
      where: {
        projectId,
        type: 'SOCIAL_POST',
        status: 'APPROVED',
      },
    });

    if (contents.length === 0) {
      log.warn({ projectId }, 'No approved social content to publish');
      await prisma.pipelineJob.update({
        where: { id: pipelineJobId },
        data: { status: 'COMPLETED', completedAt: new Date(), result: { published: 0, reason: 'No approved content' } as any },
      });
      job.updateProgress(100);
      return;
    }

    log.info({ projectId, contentCount: contents.length }, 'Found approved social content');
    job.updateProgress(20);

    // 2. Schedule each content piece for immediate publishing
    const scheduler = new PublishingScheduler();
    let published = 0;
    let failed = 0;

    for (const content of contents) {
      try {
        // Schedule for immediate publishing
        await scheduler.scheduleContent(content.id, new Date());
        published++;
        log.info({ contentId: content.id }, 'Content scheduled for publishing');
      } catch (err) {
        failed++;
        log.error({ contentId: content.id, err }, 'Failed to schedule content');
      }

      job.updateProgress(20 + Math.round(((published + failed) / contents.length) * 60));
    }

    // 3. Trigger the publishing check to actually publish scheduled content
    try {
      await scheduler.checkAndPublish();
      log.info({ projectId }, 'Publishing check completed');
    } catch (err) {
      log.warn({ err }, 'Publishing check had errors, some content may not have been published');
    }

    // 4. Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ACTIVE' },
    });

    // Mark pipeline job as COMPLETED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { published, failed } as any,
      },
    });

    job.updateProgress(100);
    log.info({ projectId, published, failed }, 'Social publishing completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, pipelineJobId, err }, 'Social publishing failed');

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

export function createSocialPublishingWorker(): Worker<SocialPublishingJobData> {
  const worker = new Worker<SocialPublishingJobData>(
    QUEUE_SOCIAL_PUBLISHING,
    processSocialPublishing,
    {
      connection: getRedisConnection(),
      concurrency: 2,
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
