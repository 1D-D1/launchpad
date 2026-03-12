/**
 * Ads optimizer service.
 * Automatically analyzes campaign performance and applies optimizations.
 */

import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { MetaAdsService, type CampaignMetrics } from './meta-ads';
import { GoogleAdsService, type PerformanceData } from './google-ads';

export interface OptimizationResult {
  campaignId: string;
  campaignName: string;
  platform: string;
  actions: OptimizationAction[];
  metrics: {
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    spend: number;
  };
}

export interface OptimizationAction {
  type: 'PAUSE' | 'BUDGET_INCREASE' | 'BUDGET_DECREASE' | 'NO_CHANGE';
  reason: string;
  details?: Record<string, unknown>;
}

// Performance thresholds for optimization decisions
const THRESHOLDS = {
  MIN_CTR: 0.5, // Below 0.5% CTR -> consider pausing
  MIN_IMPRESSIONS: 100, // Need at least 100 impressions for decisions
  MAX_CPA: 50, // CPA above $50 -> reduce budget
  MIN_ROAS: 1.5, // ROAS below 1.5 -> reduce budget
  HIGH_CTR: 2.0, // Above 2% CTR -> increase budget
  BUDGET_ADJUST_PERCENT: 20, // Adjust budget by 20%
};

export class AdsOptimizer {
  private readonly log = logger.child({ service: 'AdsOptimizer' });

  /**
   * Optimize all active campaigns across platforms.
   */
  async optimizeAllCampaigns(): Promise<OptimizationResult[]> {
    this.log.info('Starting optimization run for all active campaigns');

    const activeCampaigns = await prisma.adCampaign.findMany({
      where: {
        status: 'ACTIVE',
        autoOptimize: true,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    if (activeCampaigns.length === 0) {
      this.log.info('No active campaigns to optimize');
      return [];
    }

    this.log.info({ count: activeCampaigns.length }, 'Found campaigns to optimize');

    const results: OptimizationResult[] = [];

    for (const campaign of activeCampaigns) {
      try {
        const result = await this.optimizeCampaign(campaign.id);
        results.push(result);
      } catch (err) {
        this.log.error(
          { err, campaignId: campaign.id, campaignName: campaign.name },
          'Failed to optimize campaign',
        );
      }
    }

    const totalActions = results.reduce((sum, r) => sum + r.actions.length, 0);
    this.log.info(
      { campaignsProcessed: results.length, totalActions },
      'Optimization run complete',
    );

    return results;
  }

  /**
   * Optimize a single campaign by analyzing metrics and applying rules.
   */
  async optimizeCampaign(campaignId: string): Promise<OptimizationResult> {
    this.log.info({ campaignId }, 'Optimizing campaign');

    const campaign = await prisma.adCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!campaign.externalId) {
      throw new Error(
        `Campaign ${campaignId} has no external ID. It may not have been deployed to the ad platform yet.`,
      );
    }

    const metrics = await this.fetchMetrics(
      campaign.platform,
      campaign.externalId,
    );

    const actions = this.analyzeAndDecide(metrics, campaign.budget);

    // Apply actions
    for (const action of actions) {
      await this.applyAction(
        action,
        campaign.platform,
        campaign.externalId,
        campaign.id,
        campaign.budget,
      );
    }

    const result: OptimizationResult = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      platform: campaign.platform,
      actions,
      metrics: {
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpa: metrics.cpa,
        roas: metrics.roas,
        spend: metrics.spend,
      },
    };

    this.log.info(
      { campaignId, actionsCount: actions.length, actions: actions.map((a) => a.type) },
      'Campaign optimization complete',
    );

    return result;
  }

  private async fetchMetrics(
    platform: string,
    externalId: string,
  ): Promise<{ ctr: number; cpc: number; cpa: number; roas: number; spend: number; impressions: number }> {
    if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
      const metaService = new MetaAdsService();
      const metrics: CampaignMetrics = await metaService.getCampaignMetrics(externalId);
      return {
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpa: metrics.cpa,
        roas: metrics.roas,
        spend: metrics.spend,
        impressions: metrics.impressions,
      };
    }

    if (platform === 'GOOGLE') {
      const googleService = new GoogleAdsService();
      const performance: PerformanceData = await googleService.getCampaignPerformance(externalId);
      return {
        ctr: performance.ctr * 100, // Normalize to percentage
        cpc: performance.cpc,
        cpa: performance.conversions > 0 ? performance.spend / performance.conversions : 0,
        roas: 0,
        spend: performance.spend,
        impressions: performance.impressions,
      };
    }

    throw new Error(`Unsupported platform for optimization: ${platform}`);
  }

  private analyzeAndDecide(
    metrics: { ctr: number; cpc: number; cpa: number; roas: number; spend: number; impressions: number },
    currentBudget: number,
  ): OptimizationAction[] {
    const actions: OptimizationAction[] = [];

    // Not enough data yet
    if (metrics.impressions < THRESHOLDS.MIN_IMPRESSIONS) {
      actions.push({
        type: 'NO_CHANGE',
        reason: `Insufficient data: ${metrics.impressions} impressions (need ${THRESHOLDS.MIN_IMPRESSIONS}+)`,
      });
      return actions;
    }

    // Very low CTR -> pause
    if (metrics.ctr < THRESHOLDS.MIN_CTR && metrics.impressions > 500) {
      actions.push({
        type: 'PAUSE',
        reason: `CTR (${metrics.ctr.toFixed(2)}%) is below ${THRESHOLDS.MIN_CTR}% with ${metrics.impressions} impressions`,
        details: { ctr: metrics.ctr, impressions: metrics.impressions },
      });
      return actions;
    }

    // High CPA -> reduce budget
    if (metrics.cpa > 0 && metrics.cpa > THRESHOLDS.MAX_CPA) {
      const newBudget = currentBudget * (1 - THRESHOLDS.BUDGET_ADJUST_PERCENT / 100);
      actions.push({
        type: 'BUDGET_DECREASE',
        reason: `CPA ($${metrics.cpa.toFixed(2)}) exceeds $${THRESHOLDS.MAX_CPA} threshold`,
        details: { currentBudget, newBudget: Math.round(newBudget * 100) / 100, cpa: metrics.cpa },
      });
    }

    // Low ROAS -> reduce budget
    if (metrics.roas > 0 && metrics.roas < THRESHOLDS.MIN_ROAS) {
      const newBudget = currentBudget * (1 - THRESHOLDS.BUDGET_ADJUST_PERCENT / 100);
      actions.push({
        type: 'BUDGET_DECREASE',
        reason: `ROAS (${metrics.roas.toFixed(2)}x) is below ${THRESHOLDS.MIN_ROAS}x`,
        details: { currentBudget, newBudget: Math.round(newBudget * 100) / 100, roas: metrics.roas },
      });
    }

    // High CTR -> increase budget
    if (metrics.ctr > THRESHOLDS.HIGH_CTR && actions.length === 0) {
      const newBudget = currentBudget * (1 + THRESHOLDS.BUDGET_ADJUST_PERCENT / 100);
      actions.push({
        type: 'BUDGET_INCREASE',
        reason: `Strong CTR (${metrics.ctr.toFixed(2)}%) - increasing budget to capture more traffic`,
        details: { currentBudget, newBudget: Math.round(newBudget * 100) / 100, ctr: metrics.ctr },
      });
    }

    if (actions.length === 0) {
      actions.push({
        type: 'NO_CHANGE',
        reason: 'Campaign performance is within acceptable ranges',
      });
    }

    return actions;
  }

  private async applyAction(
    action: OptimizationAction,
    platform: string,
    externalId: string,
    internalId: string,
    currentBudget: number,
  ): Promise<void> {
    switch (action.type) {
      case 'PAUSE': {
        if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
          const metaService = new MetaAdsService();
          await metaService.pauseCampaign(externalId);
        } else if (platform === 'GOOGLE') {
          const googleService = new GoogleAdsService();
          await googleService.pauseCampaign(externalId);
        }

        await prisma.adCampaign.update({
          where: { id: internalId },
          data: { status: 'PAUSED' },
        });
        break;
      }

      case 'BUDGET_INCREASE':
      case 'BUDGET_DECREASE': {
        const multiplier =
          action.type === 'BUDGET_INCREASE'
            ? 1 + THRESHOLDS.BUDGET_ADJUST_PERCENT / 100
            : 1 - THRESHOLDS.BUDGET_ADJUST_PERCENT / 100;

        const newBudget = Math.round(currentBudget * multiplier * 100) / 100;

        if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
          const metaService = new MetaAdsService();
          await metaService.updateBudget(externalId, newBudget);
        } else if (platform === 'GOOGLE') {
          const googleService = new GoogleAdsService();
          await googleService.updateBudget(externalId, newBudget);
        }

        await prisma.adCampaign.update({
          where: { id: internalId },
          data: { budget: newBudget },
        });
        break;
      }

      case 'NO_CHANGE':
        // Nothing to apply
        break;
    }
  }
}
