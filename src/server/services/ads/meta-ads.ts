/**
 * Meta Ads (Facebook/Instagram) service.
 * Manages ad campaigns via the Meta Marketing API.
 */

import { logger } from '@/lib/logger';

export interface CampaignParams {
  name: string;
  objective: string;
  dailyBudget: number;
  targeting: {
    ageMin?: number;
    ageMax?: number;
    genders?: number[];
    locations?: { key: string; name: string }[];
    interests?: { id: string; name: string }[];
  };
  adCreative: {
    title: string;
    body: string;
    imageUrl?: string;
    linkUrl: string;
    callToAction?: string;
  };
  startDate?: Date;
  endDate?: Date;
}

export interface CampaignMetrics {
  campaignId: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  frequency: number;
  dateRange: { start: string; end: string };
}

const MARKETING_API_BASE = 'https://graph.facebook.com/v19.0';

export class MetaAdsService {
  private readonly accessToken: string;
  private readonly adAccountId: string;
  private readonly log = logger.child({ service: 'MetaAdsService' });

  constructor() {
    const token = process.env.META_ACCESS_TOKEN;
    const accountId = process.env.META_AD_ACCOUNT_ID;

    if (!token) {
      throw new Error(
        'META_ACCESS_TOKEN is not configured. ' +
          'Set up a Meta App with Marketing API access and configure META_ACCESS_TOKEN.',
      );
    }
    if (!accountId) {
      throw new Error(
        'META_AD_ACCOUNT_ID is not configured. ' +
          'Set META_AD_ACCOUNT_ID to your ad account ID (format: act_XXXXXXXXX).',
      );
    }

    this.accessToken = token;
    this.adAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  }

  /**
   * Create a new ad campaign with ad set and ad creative.
   */
  async createCampaign(params: CampaignParams): Promise<{ campaignId: string }> {
    this.log.info(
      { name: params.name, objective: params.objective, budget: params.dailyBudget },
      'Creating Meta ad campaign',
    );

    // Step 1: Create Campaign
    const campaignData = await this.apiPost(`/${this.adAccountId}/campaigns`, {
      name: params.name,
      objective: this.mapObjective(params.objective),
      status: 'PAUSED',
      special_ad_categories: [],
    });

    const campaignId = (campaignData as { id: string }).id;
    this.log.info({ campaignId }, 'Campaign created');

    // Step 2: Create Ad Set
    const adSetData = await this.apiPost(`/${this.adAccountId}/adsets`, {
      name: `${params.name} - Ad Set`,
      campaign_id: campaignId,
      daily_budget: Math.round(params.dailyBudget * 100), // cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: {
        age_min: params.targeting.ageMin || 18,
        age_max: params.targeting.ageMax || 65,
        genders: params.targeting.genders,
        geo_locations: params.targeting.locations
          ? { countries: params.targeting.locations.map((l) => l.key) }
          : { countries: ['FR'] },
        interests: params.targeting.interests?.map((i) => ({ id: i.id, name: i.name })),
      },
      status: 'PAUSED',
      ...(params.startDate && { start_time: params.startDate.toISOString() }),
      ...(params.endDate && { end_time: params.endDate.toISOString() }),
    });

    const adSetId = (adSetData as { id: string }).id;
    this.log.info({ adSetId, campaignId }, 'Ad set created');

    // Step 3: Create Ad Creative
    const creativeData = await this.apiPost(`/${this.adAccountId}/adcreatives`, {
      name: `${params.name} - Creative`,
      object_story_spec: {
        page_id: process.env.META_PAGE_ID,
        link_data: {
          message: params.adCreative.body,
          link: params.adCreative.linkUrl,
          name: params.adCreative.title,
          ...(params.adCreative.imageUrl && { picture: params.adCreative.imageUrl }),
          call_to_action: {
            type: params.adCreative.callToAction || 'LEARN_MORE',
          },
        },
      },
    });

    const creativeId = (creativeData as { id: string }).id;

    // Step 4: Create Ad
    await this.apiPost(`/${this.adAccountId}/ads`, {
      name: `${params.name} - Ad`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
    });

    this.log.info({ campaignId }, 'Full campaign structure created (paused)');
    return { campaignId };
  }

  /**
   * Get performance metrics for a campaign.
   */
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    this.log.debug({ campaignId }, 'Fetching campaign metrics');

    const params = new URLSearchParams({
      fields: 'impressions,reach,clicks,spend,actions,ctr,cpc,frequency',
      date_preset: 'last_30d',
      access_token: this.accessToken,
    });

    const response = await fetch(
      `${MARKETING_API_BASE}/${campaignId}/insights?${params.toString()}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Meta Marketing API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`,
      );
    }

    const json = (await response.json()) as {
      data: {
        impressions?: string;
        reach?: string;
        clicks?: string;
        spend?: string;
        ctr?: string;
        cpc?: string;
        frequency?: string;
        actions?: { action_type: string; value: string }[];
        date_start?: string;
        date_stop?: string;
      }[];
    };

    const data = json.data?.[0] || {};
    const conversions =
      data.actions?.find(
        (a) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase',
      )?.value || '0';

    const spend = parseFloat(data.spend || '0');
    const conversionCount = parseInt(conversions, 10);

    return {
      campaignId,
      impressions: parseInt(data.impressions || '0', 10),
      reach: parseInt(data.reach || '0', 10),
      clicks: parseInt(data.clicks || '0', 10),
      spend,
      conversions: conversionCount,
      ctr: parseFloat(data.ctr || '0'),
      cpc: parseFloat(data.cpc || '0'),
      cpa: conversionCount > 0 ? spend / conversionCount : 0,
      roas: 0, // Requires revenue data
      frequency: parseFloat(data.frequency || '0'),
      dateRange: {
        start: data.date_start || '',
        end: data.date_stop || '',
      },
    };
  }

  /**
   * Pause a campaign.
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    this.log.info({ campaignId }, 'Pausing campaign');
    await this.apiPost(`/${campaignId}`, { status: 'PAUSED' });
    this.log.info({ campaignId }, 'Campaign paused');
  }

  /**
   * Update campaign daily budget.
   */
  async updateBudget(campaignId: string, budget: number): Promise<void> {
    this.log.info({ campaignId, newBudget: budget }, 'Updating campaign budget');

    // Budget updates go on the ad set level; find ad sets for this campaign
    const params = new URLSearchParams({
      fields: 'id',
      access_token: this.accessToken,
    });

    const response = await fetch(
      `${MARKETING_API_BASE}/${campaignId}/adsets?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ad sets for campaign ${campaignId}`);
    }

    const json = (await response.json()) as { data: { id: string }[] };

    for (const adSet of json.data || []) {
      await this.apiPost(`/${adSet.id}`, {
        daily_budget: Math.round(budget * 100),
      });
    }

    this.log.info({ campaignId, newBudget: budget }, 'Budget updated');
  }

  private mapObjective(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'OUTCOME_AWARENESS',
      traffic: 'OUTCOME_TRAFFIC',
      engagement: 'OUTCOME_ENGAGEMENT',
      leads: 'OUTCOME_LEADS',
      sales: 'OUTCOME_SALES',
      conversions: 'OUTCOME_SALES',
    };
    return mapping[objective.toLowerCase()] || 'OUTCOME_TRAFFIC';
  }

  private async apiPost(
    path: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(`${MARKETING_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, access_token: this.accessToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.log.error({ path, error }, 'Meta Marketing API error');
      throw new Error(
        `Meta Marketing API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`,
      );
    }

    return response.json();
  }
}
