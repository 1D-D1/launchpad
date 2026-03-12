/**
 * Worker: ads-campaign
 * Creates and configures ad campaigns on Meta (Facebook/Instagram) and Google Ads.
 * Fetches approved AD_COPY content + strategy, creates campaigns, stores campaign IDs.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { callInternalApi } from '@/lib/internal-api';
import { getRedisConnection, QUEUE_ADS_CAMPAIGN } from '@/server/jobs/queue';

export interface AdsCampaignJobData {
  projectId: string;
  pipelineJobId: string;
}

const log = logger.child({ worker: QUEUE_ADS_CAMPAIGN });

async function createMetaCampaign(params: {
  adAccountId: string;
  accessToken: string;
  campaignName: string;
  objective: string;
  dailyBudget: number;
  adCopy: Array<{ title: string; body: string; callToAction: string }>;
  targeting: Record<string, unknown>;
}): Promise<{ campaignId: string; adSetId: string; adIds: string[] }> {
  const { adAccountId, accessToken, campaignName, objective, dailyBudget, adCopy, targeting } = params;

  // Create campaign
  const campaignRes = await fetch(
    `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName,
        objective: objective.toUpperCase(),
        status: 'PAUSED',
        special_ad_categories: [],
        access_token: accessToken,
      }),
    },
  );

  if (!campaignRes.ok) throw new Error(`Meta campaign creation failed: ${campaignRes.status}`);
  const campaign = await campaignRes.json();

  // Create ad set
  const adSetRes = await fetch(
    `https://graph.facebook.com/v18.0/act_${adAccountId}/adsets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${campaignName} - Ad Set`,
        campaign_id: campaign.id,
        daily_budget: Math.round(dailyBudget * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'REACH',
        targeting,
        status: 'PAUSED',
        access_token: accessToken,
      }),
    },
  );

  if (!adSetRes.ok) throw new Error(`Meta ad set creation failed: ${adSetRes.status}`);
  const adSet = await adSetRes.json();

  // Create ads from ad copy variations
  const adIds: string[] = [];
  for (const copy of adCopy) {
    const adRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}/ads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: copy.title,
          adset_id: adSet.id,
          creative: {
            title: copy.title,
            body: copy.body,
            call_to_action_type: copy.callToAction,
          },
          status: 'PAUSED',
          access_token: accessToken,
        }),
      },
    );

    if (adRes.ok) {
      const ad = await adRes.json();
      adIds.push(ad.id);
    } else {
      log.warn({ title: copy.title, status: adRes.status }, 'Failed to create ad creative');
    }
  }

  return { campaignId: campaign.id, adSetId: adSet.id, adIds };
}

async function createGoogleCampaign(params: {
  customerId: string;
  refreshToken: string;
  campaignName: string;
  dailyBudget: number;
  adCopy: Array<{ headlines: string[]; descriptions: string[]; finalUrl: string }>;
  targeting: Record<string, unknown>;
}): Promise<{ campaignId: string; adGroupId: string }> {
  const { customerId, refreshToken, campaignName, dailyBudget, adCopy, targeting } = params;

  const response = await callInternalApi<{ campaignId: string; adGroupId: string }>(
    '/api/internal/google-ads/campaign',
    {
      customerId,
      refreshToken,
      campaignName,
      dailyBudgetMicros: Math.round(dailyBudget * 1_000_000),
      adCopy,
      targeting,
    },
  );

  return response;
}

async function processAdsCampaign(job: Job<AdsCampaignJobData>): Promise<void> {
  const { projectId, pipelineJobId } = job.data;
  log.info({ projectId, pipelineJobId, jobId: job.id }, 'Starting ads campaign setup');

  // Mark pipeline job as RUNNING
  await prisma.pipelineJob.update({
    where: { id: pipelineJobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  }).catch((err) => log.warn({ err, pipelineJobId }, 'Failed to update pipeline job status to RUNNING'));

  try {
    // 1. Fetch project and strategy
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { user: { include: { accounts: true } } },
    });

    const strategy = await prisma.strategy.findFirst({ where: { projectId } });
    if (!strategy) throw new Error(`No strategy found for project ${projectId}`);

    const adContents = await prisma.content.findMany({
      where: { projectId, type: 'AD_COPY', status: 'APPROVED' },
    });

    if (adContents.length === 0) {
      log.warn({ projectId }, 'No approved ad copy found');
      await prisma.pipelineJob.update({
        where: { id: pipelineJobId },
        data: { status: 'COMPLETED', completedAt: new Date(), result: { campaigns: 0, reason: 'No approved ad copy' } as any },
      });
      job.updateProgress(100);
      return;
    }

    // Use OAuth accounts as ad accounts (filter for relevant providers)
    const adAccounts = project.user.accounts.filter(
      (a) => a.provider === 'meta' || a.provider === 'google',
    );

    if (adAccounts.length === 0) {
      log.warn({ projectId }, 'No connected ad accounts');
      await prisma.pipelineJob.update({
        where: { id: pipelineJobId },
        data: { status: 'COMPLETED', completedAt: new Date(), result: { campaigns: 0, reason: 'No connected ad accounts' } as any },
      });
      job.updateProgress(100);
      return;
    }

    job.updateProgress(20);

    // 2. Calculate budget allocation per platform
    const budget = project.budget as { total: number; allocation?: Record<string, number> } | null;
    const totalAdBudget = budget?.allocation?.['ads'] ?? (budget?.total ?? 0) * 0.4;
    const budgetPerPlatform = totalAdBudget / adAccounts.length;
    const dailyBudget = budgetPerPlatform / 30;

    // 3. Create campaigns on each connected platform
    const campaignResults: Array<{ platform: string; externalId: string; status: string }> = [];

    const strategyData = {
      objective: 'CONVERSIONS',
      targeting: {} as Record<string, unknown>,
    };

    for (const account of adAccounts) {
      try {
        if (account.provider === 'meta') {
          const result = await createMetaCampaign({
            adAccountId: account.providerAccountId,
            accessToken: account.access_token || '',
            campaignName: `${project.name} - Launchpad Campaign`,
            objective: strategyData.objective,
            dailyBudget,
            adCopy: adContents.map((c) => ({
              title: c.title || 'Untitled',
              body: c.body,
              callToAction: 'LEARN_MORE',
            })),
            targeting: strategyData.targeting,
          });

          campaignResults.push({
            platform: 'meta',
            externalId: result.campaignId,
            status: 'PAUSED',
          });
        } else if (account.provider === 'google') {
          const result = await createGoogleCampaign({
            customerId: account.providerAccountId,
            refreshToken: account.refresh_token || '',
            campaignName: `${project.name} - Launchpad Campaign`,
            dailyBudget,
            adCopy: adContents.map((c) => ({
              headlines: [c.title || 'Untitled'],
              descriptions: [c.body],
              finalUrl: project.description,
            })),
            targeting: strategyData.targeting,
          });

          campaignResults.push({
            platform: 'google',
            externalId: result.campaignId,
            status: 'PAUSED',
          });
        }
      } catch (err) {
        log.error({ platform: account.provider, err }, 'Failed to create campaign on platform');
      }

      job.updateProgress(20 + Math.round((campaignResults.length / adAccounts.length) * 60));
    }

    // 4. Store campaign records
    for (const campaign of campaignResults) {
      await prisma.adCampaign.create({
        data: {
          projectId,
          platform: campaign.platform === 'meta' ? 'FACEBOOK' : 'GOOGLE',
          externalId: campaign.externalId,
          name: `${project.name} - ${campaign.platform} Campaign`,
          objective: strategyData.objective,
          budget: dailyBudget * 30,
          budgetType: 'MONTHLY',
          targeting: strategyData.targeting as any,
          creatives: {} as any,
          status: campaign.status,
        },
      });
    }

    // 5. Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'RUNNING_ADS' },
    });

    // Mark pipeline job as COMPLETED
    await prisma.pipelineJob.update({
      where: { id: pipelineJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { campaignCount: campaignResults.length } as any,
      },
    });

    job.updateProgress(100);
    log.info({ projectId, campaignCount: campaignResults.length }, 'Ads campaign setup completed');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error({ projectId, pipelineJobId, err }, 'Ads campaign setup failed');

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

export function createAdsCampaignWorker(): Worker<AdsCampaignJobData> {
  const worker = new Worker<AdsCampaignJobData>(
    QUEUE_ADS_CAMPAIGN,
    processAdsCampaign,
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
