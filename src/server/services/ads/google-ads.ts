/**
 * Google Ads service.
 * Manages search campaigns via the Google Ads API.
 */

import { logger } from '@/lib/logger';

export interface SearchCampaignParams {
  name: string;
  dailyBudget: number;
  keywords: { text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  locations?: string[];
  language?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PerformanceData {
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  qualityScore: number | null;
  avgPosition: number | null;
  dateRange: { start: string; end: string };
}

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v16';

export class GoogleAdsService {
  private readonly developerToken: string;
  private readonly customerId: string;
  private readonly accessToken: string;
  private readonly log = logger.child({ service: 'GoogleAdsService' });

  constructor() {
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const accessToken = process.env.GOOGLE_ADS_ACCESS_TOKEN;

    if (!devToken || !customerId || !accessToken) {
      throw new Error(
        'Google Ads API requires GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID, and GOOGLE_ADS_ACCESS_TOKEN. ' +
          'Apply for API access at https://developers.google.com/google-ads/api/docs/get-started.',
      );
    }

    this.developerToken = devToken;
    this.customerId = customerId.replace(/-/g, '');
    this.accessToken = accessToken;
  }

  /**
   * Create a search campaign with keywords, ad group, and responsive search ad.
   */
  async createSearchCampaign(
    params: SearchCampaignParams,
  ): Promise<{ campaignId: string }> {
    this.log.info(
      { name: params.name, budget: params.dailyBudget, keywordCount: params.keywords.length },
      'Creating Google Ads search campaign',
    );

    // Step 1: Create campaign budget
    const budgetResponse = await this.mutate('campaignBudgets', {
      create: {
        name: `${params.name} Budget`,
        amountMicros: String(Math.round(params.dailyBudget * 1_000_000)),
        deliveryMethod: 'STANDARD',
      },
    });

    const budgetResourceName = this.extractResourceName(budgetResponse);
    this.log.debug({ budgetResourceName }, 'Campaign budget created');

    // Step 2: Create campaign
    const campaignResponse = await this.mutate('campaigns', {
      create: {
        name: params.name,
        advertisingChannelType: 'SEARCH',
        status: 'PAUSED',
        campaignBudget: budgetResourceName,
        startDate: params.startDate
          ? this.formatDate(params.startDate)
          : this.formatDate(new Date()),
        ...(params.endDate && { endDate: this.formatDate(params.endDate) }),
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
        },
      },
    });

    const campaignResourceName = this.extractResourceName(campaignResponse);
    const campaignId = campaignResourceName.split('/').pop()!;
    this.log.info({ campaignId }, 'Campaign created');

    // Step 3: Create ad group
    const adGroupResponse = await this.mutate('adGroups', {
      create: {
        name: `${params.name} - Ad Group`,
        campaign: campaignResourceName,
        type: 'SEARCH_STANDARD',
        status: 'ENABLED',
        cpcBidMicros: '1000000', // $1.00 default CPC bid
      },
    });

    const adGroupResourceName = this.extractResourceName(adGroupResponse);
    this.log.debug({ adGroupResourceName }, 'Ad group created');

    // Step 4: Add keywords
    for (const keyword of params.keywords) {
      await this.mutate('adGroupCriteria', {
        create: {
          adGroup: adGroupResourceName,
          keyword: {
            text: keyword.text,
            matchType: keyword.matchType,
          },
          status: 'ENABLED',
        },
      });
    }

    this.log.debug({ count: params.keywords.length }, 'Keywords added');

    // Step 5: Create responsive search ad
    await this.mutate('adGroupAds', {
      create: {
        adGroup: adGroupResourceName,
        ad: {
          responsiveSearchAd: {
            headlines: params.headlines.slice(0, 15).map((text) => ({
              text,
              pinnedField: undefined,
            })),
            descriptions: params.descriptions.slice(0, 4).map((text) => ({
              text,
              pinnedField: undefined,
            })),
          },
          finalUrls: [params.finalUrl],
        },
        status: 'ENABLED',
      },
    });

    this.log.info({ campaignId }, 'Full Google Ads campaign structure created (paused)');
    return { campaignId };
  }

  /**
   * Get performance data for a campaign.
   */
  async getCampaignPerformance(campaignId: string): Promise<PerformanceData> {
    this.log.debug({ campaignId }, 'Fetching campaign performance');

    const query = `
      SELECT
        campaign.id,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions_from_interactions_rate,
        segments.date
      FROM campaign
      WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_30_DAYS
    `;

    const response = await this.search(query);
    const rows = (response as { results?: Record<string, unknown>[] }).results || [];

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalCostMicros = 0;
    let startDate = '';
    let endDate = '';

    for (const row of rows) {
      const metrics = row.metrics as Record<string, string | number> | undefined;
      const segments = row.segments as Record<string, string> | undefined;

      if (metrics) {
        totalImpressions += parseInt(String(metrics.impressions || '0'), 10);
        totalClicks += parseInt(String(metrics.clicks || '0'), 10);
        totalConversions += parseFloat(String(metrics.conversions || '0'));
        totalCostMicros += parseInt(String(metrics.costMicros || '0'), 10);
      }

      const date = segments?.date || '';
      if (!startDate || date < startDate) startDate = date;
      if (!endDate || date > endDate) endDate = date;
    }

    const spend = totalCostMicros / 1_000_000;

    return {
      campaignId,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      spend,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cpc: totalClicks > 0 ? spend / totalClicks : 0,
      conversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
      qualityScore: null,
      avgPosition: null,
      dateRange: { start: startDate, end: endDate },
    };
  }

  /**
   * Pause a campaign.
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    this.log.info({ campaignId }, 'Pausing Google Ads campaign');
    await this.mutate('campaigns', {
      update: {
        resourceName: `customers/${this.customerId}/campaigns/${campaignId}`,
        status: 'PAUSED',
      },
      updateMask: 'status',
    });
    this.log.info({ campaignId }, 'Campaign paused');
  }

  /**
   * Update campaign daily budget.
   */
  async updateBudget(campaignId: string, budget: number): Promise<void> {
    this.log.info({ campaignId, newBudget: budget }, 'Updating Google Ads budget');

    // First, get the campaign's budget resource name
    const query = `
      SELECT campaign.campaign_budget
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `;

    const response = await this.search(query);
    const results = (response as { results?: { campaign?: { campaignBudget?: string } }[] }).results || [];

    const budgetResource = results[0]?.campaign?.campaignBudget;
    if (!budgetResource) {
      throw new Error(`Could not find budget for campaign ${campaignId}`);
    }

    await this.mutate('campaignBudgets', {
      update: {
        resourceName: budgetResource,
        amountMicros: String(Math.round(budget * 1_000_000)),
      },
      updateMask: 'amount_micros',
    });

    this.log.info({ campaignId, newBudget: budget }, 'Budget updated');
  }

  private async mutate(
    resource: string,
    operation: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${GOOGLE_ADS_API_BASE}/customers/${this.customerId}/${resource}:mutate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'developer-token': this.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operations: [operation] }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.log.error({ resource, error }, 'Google Ads API mutate error');
      throw new Error(`Google Ads API error: ${error}`);
    }

    return response.json();
  }

  private async search(query: string): Promise<unknown> {
    const url = `${GOOGLE_ADS_API_BASE}/customers/${this.customerId}/googleAds:search`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'developer-token': this.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.log.error({ error }, 'Google Ads API search error');
      throw new Error(`Google Ads API search error: ${error}`);
    }

    return response.json();
  }

  private extractResourceName(response: unknown): string {
    const results = (response as { results?: { resourceName?: string }[] }).results;
    const name = results?.[0]?.resourceName;
    if (!name) {
      throw new Error('Google Ads API did not return a resource name');
    }
    return name;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }
}
