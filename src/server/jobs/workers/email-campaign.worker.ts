/**
 * Worker: email-campaign
 * Sets up cold email outreach sequences with personalization and scheduling.
 * Fetches email sequences and starts the sequence engine for each lead batch.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { callInternalApi } from '@/lib/internal-api';
import { getRedisConnection, QUEUE_EMAIL_CAMPAIGN } from '@/server/jobs/queue';
import { SequenceEngine } from '@/server/services/email/sequence-engine';

export interface EmailCampaignJobData {
  projectId: string;
  pipelineJobId: string;
}

const log = logger.child({ worker: QUEUE_EMAIL_CAMPAIGN });

interface EmailSequenceStep {
  subject: string;
  body: string;
  delayDays: number;
  isFollowUp: boolean;
}

async function processEmailCampaign(job: Job<EmailCampaignJobData>): Promise<void> {
  const { projectId, pipelineJobId } = job.data;
  log.info({ projectId, pipelineJobId, jobId: job.id }, 'Starting email campaign setup');

  // Mark pipeline job as RUNNING
  await prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  }).catch((err) => log.warn({ err, pipelineJobId }, 'Failed to update pipeline job status to RUNNING'));

  try {
    // 1. Fetch project, strategy, and email content
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { user: true },
    });

    const strategy = await prisma.strategy.findFirst({ where: { projectId } });
    if (!strategy) throw new Error(`No strategy found for project ${projectId}`);

    const emailContents = await prisma.content.findMany({
      where: { projectId, type: 'EMAIL', status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
    });

    if (emailContents.length === 0) {
      log.warn({ projectId }, 'No approved email sequence content found');
      await prisma.pipelineJob.update({
        where: { id: pipelineJobId },
        data: { status: 'COMPLETED', completedAt: new Date(), result: { sequences: 0, reason: 'No approved email content' } as any },
      });
      job.updateProgress(100);
      return;
    }

    job.updateProgress(20);

    // 2. Build email sequence from approved content
    const sequenceSteps: EmailSequenceStep[] = emailContents.map((content, index) => ({
      subject: content.title || 'Untitled',
      body: content.body,
      delayDays: index === 0 ? 0 : index * 3,
      isFollowUp: index > 0,
    }));

    log.info({ stepCount: sequenceSteps.length }, 'Built email sequence');

    // 3. Store sequence record in DB
    const emailSequence = await prisma.emailSequence.create({
      data: {
        projectId,
        name: `${project.name} - Outreach Sequence`,
        status: 'DRAFT',
        metrics: JSON.parse(JSON.stringify({
          steps: sequenceSteps,
          settings: {
            sendingWindow: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
            maxPerDay: 50,
            skipWeekends: true,
            stopOnReply: true,
          },
        })),
      },
    });

    job.updateProgress(40);

    // 4. Create steps
    for (let i = 0; i < sequenceSteps.length; i++) {
      const step = sequenceSteps[i];
      await prisma.emailStep.create({
        data: {
          sequenceId: emailSequence.id,
          order: i + 1,
          subject: step.subject,
          body: step.body,
          delayHours: step.delayDays * 24,
        },
      });
    }

    job.updateProgress(60);

    // 5. Import leads if available
    const leads = await prisma.lead.findMany({
      where: { sequenceId: null },
      take: 1000,
    });

    if (leads.length > 0) {
      log.info({ leadCount: leads.length }, 'Assigning leads to sequence');

      // Assign leads to the new sequence
      await prisma.lead.updateMany({
        where: {
          id: { in: leads.map((l) => l.id) },
        },
        data: { sequenceId: emailSequence.id },
      });

      log.info({ leadCount: leads.length, sequenceId: emailSequence.id }, 'Leads assigned to sequence');
    }

    job.updateProgress(80);

    // 6. Start the sequence engine for the new sequence
    try {
      const engine = new SequenceEngine();
      // Activate the sequence first
      await prisma.emailSequence.update({
        where: { id: emailSequence.id },
        data: { status: 'ACTIVE' },
      });

      // Process the initial batch
      if (leads.length > 0) {
        await engine.processSequence(emailSequence.id);
        log.info({ sequenceId: emailSequence.id }, 'Initial sequence batch processed');
      }
    } catch (err) {
      log.warn({ err, sequenceId: emailSequence.id }, 'Initial sequence processing had errors, sequence still created');
    }

    // 7. Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'EMAILING' },
    });

    // Mark pipeline job as COMPLETED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: {
          sequenceId: emailSequence.id,
          stepCount: sequenceSteps.length,
          leadCount: leads.length,
        } as any,
      },
    });

    job.updateProgress(100);
    log.info({ projectId, sequenceId: emailSequence.id, leadCount: leads.length }, 'Email campaign setup completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, pipelineJobId, err }, 'Email campaign setup failed');

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

export function createEmailCampaignWorker(): Worker<EmailCampaignJobData> {
  const worker = new Worker<EmailCampaignJobData>(
    QUEUE_EMAIL_CAMPAIGN,
    processEmailCampaign,
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
