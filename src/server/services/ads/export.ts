/**
 * Ads Export Service.
 * Generates CSV files in the exact format expected by Meta Ads Manager
 * and Google Ads Editor bulk import tools, plus structured ads briefs.
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/server/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  name: string;
  platform: string;
  objective: string;
  budget: number;
  budgetType: string;
  targeting: {
    locations?: string[];
    ageMin?: number;
    ageMax?: number;
    interests?: string[];
    keywords?: string[];
    audiences?: string[];
  };
  creatives: {
    headline: string;
    description: string;
    callToAction?: string;
    imageUrl?: string;
    videoUrl?: string;
    landingUrl?: string;
  };
  status: string;
}

export interface AdsBrief {
  projectName: string;
  generatedAt: string;
  campaignStructure: {
    totalCampaigns: number;
    byPlatform: Record<string, number>;
    totalBudget: number;
    budgetCurrency: string;
  };
  campaigns: {
    name: string;
    platform: string;
    objective: string;
    budget: number;
    budgetType: string;
    targeting: {
      locations: string[];
      ageRange: string;
      interests: string[];
      keywords: string[];
      audiences: string[];
    };
    creative: {
      headline: string;
      description: string;
      callToAction: string;
      landingUrl: string;
      imageUrl: string;
    };
    status: string;
  }[];
  audienceTargeting: {
    primaryLocations: string[];
    ageRange: string;
    topInterests: string[];
    topKeywords: string[];
  };
  creativeSpecs: {
    metaAdSpecs: {
      imageSize: string;
      videoLength: string;
      headlineMaxChars: number;
      bodyMaxChars: number;
    };
    googleAdSpecs: {
      headlineMaxChars: number;
      descriptionMaxChars: number;
      headlines: number;
      descriptions: number;
    };
  };
  budgetAllocation: {
    platform: string;
    amount: number;
    percentage: number;
  }[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a value for CSV (wrap in quotes if it contains commas, quotes, or newlines). */
function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a single CSV string from headers + rows. */
function buildCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map((row) => row.map(csvEscape).join(','));
  return [headerLine, ...dataLines].join('\r\n') + '\r\n';
}

/** Format a Date to YYYY-MM-DD. */
function formatDate(date?: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// AdsExporter
// ---------------------------------------------------------------------------

export class AdsExporter {
  private readonly log = logger.child({ service: 'AdsExporter' });

  /**
   * Export Meta Ads campaigns as CSV for Meta Ads Manager bulk import.
   *
   * Format follows the Meta Business Suite / Ads Manager bulk upload spec:
   * https://www.facebook.com/business/help/
   */
  async exportMetaCampaignsCSV(projectId: string): Promise<string> {
    this.log.info({ projectId }, 'Generating Meta Ads CSV export');

    const campaigns = await this.fetchCampaigns(projectId, ['FACEBOOK', 'INSTAGRAM']);

    if (campaigns.length === 0) {
      this.log.warn({ projectId }, 'No Meta campaigns found for project');
    }

    const headers = [
      'Campaign Name',
      'Campaign Objective',
      'Campaign Budget',
      'Campaign Budget Type',
      'Ad Set Name',
      'Ad Set Daily Budget',
      'Ad Set Start Date',
      'Ad Set End Date',
      'Targeting Locations',
      'Targeting Age Min',
      'Targeting Age Max',
      'Targeting Interests',
      'Ad Name',
      'Ad Title',
      'Ad Body',
      'Ad Link',
      'Ad CTA',
      'Ad Image URL',
    ];

    const rows: string[][] = campaigns.map((c) => {
      const targeting = c.targeting;
      const creative = c.creatives;
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);

      return [
        c.name,
        this.mapMetaObjective(c.objective),
        String(c.budget),
        c.budgetType === 'LIFETIME' ? 'LIFETIME' : 'DAILY',
        `${c.name} - Ad Set`,
        String(c.budget),
        formatDate(today),
        formatDate(endDate),
        (targeting.locations ?? []).join(';'),
        String(targeting.ageMin ?? 18),
        String(targeting.ageMax ?? 65),
        (targeting.interests ?? []).join(';'),
        `${c.name} - Ad`,
        creative.headline,
        creative.description,
        creative.landingUrl ?? '',
        creative.callToAction ?? 'LEARN_MORE',
        creative.imageUrl ?? '',
      ];
    });

    const csv = buildCSV(headers, rows);
    this.log.info(
      { projectId, campaignCount: campaigns.length },
      'Meta Ads CSV export generated',
    );
    return csv;
  }

  /**
   * Export Google Ads campaigns as CSV for Google Ads Editor import.
   *
   * Format follows the Google Ads Editor CSV import spec:
   * https://support.google.com/google-ads/answer/6320
   */
  async exportGoogleAdsCSV(projectId: string): Promise<string> {
    this.log.info({ projectId }, 'Generating Google Ads CSV export');

    const campaigns = await this.fetchCampaigns(projectId, ['GOOGLE']);

    if (campaigns.length === 0) {
      this.log.warn({ projectId }, 'No Google campaigns found for project');
    }

    const headers = [
      'Campaign',
      'Campaign Type',
      'Campaign Budget',
      'Campaign Bid Strategy',
      'Ad Group',
      'Ad Group Default Max CPC',
      'Keyword',
      'Keyword Match Type',
      'Headline 1',
      'Headline 2',
      'Headline 3',
      'Description 1',
      'Description 2',
      'Final URL',
      'Path 1',
      'Path 2',
    ];

    const rows: string[][] = [];

    for (const c of campaigns) {
      const targeting = c.targeting;
      const creative = c.creatives;
      const keywords = targeting.keywords ?? [];
      const landingUrl = creative.landingUrl ?? '';

      // Extract path segments from landing URL
      let path1 = '';
      let path2 = '';
      try {
        const urlObj = new URL(landingUrl);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        path1 = (pathSegments[0] ?? '').slice(0, 15);
        path2 = (pathSegments[1] ?? '').slice(0, 15);
      } catch {
        // Invalid URL, leave paths empty
      }

      // Split headline into multiple parts (Google allows up to 30 chars each)
      const headlineParts = this.splitHeadline(creative.headline);

      // Split description (90 chars max each for Google)
      const descParts = this.splitDescription(creative.description);

      if (keywords.length === 0) {
        // Single row with no keyword
        rows.push([
          c.name,
          'Search',
          String(c.budget),
          'Maximize Conversions',
          `${c.name} - Ad Group`,
          '1.00',
          '',
          '',
          headlineParts[0] ?? '',
          headlineParts[1] ?? '',
          headlineParts[2] ?? '',
          descParts[0] ?? '',
          descParts[1] ?? '',
          landingUrl,
          path1,
          path2,
        ]);
      } else {
        // One row per keyword
        for (const kw of keywords) {
          rows.push([
            c.name,
            'Search',
            String(c.budget),
            'Maximize Conversions',
            `${c.name} - Ad Group`,
            '1.00',
            kw,
            'Broad', // Default match type
            headlineParts[0] ?? '',
            headlineParts[1] ?? '',
            headlineParts[2] ?? '',
            descParts[0] ?? '',
            descParts[1] ?? '',
            landingUrl,
            path1,
            path2,
          ]);
        }
      }
    }

    const csv = buildCSV(headers, rows);
    this.log.info(
      { projectId, campaignCount: campaigns.length, rowCount: rows.length },
      'Google Ads CSV export generated',
    );
    return csv;
  }

  /**
   * Generate a complete ads brief document for manual setup by a media buyer.
   */
  async generateAdsBrief(projectId: string): Promise<AdsBrief> {
    this.log.info({ projectId }, 'Generating ads brief');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        campaigns: true,
        strategies: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const allCampaigns = project.campaigns;
    const budget = project.budget as { total?: number; currency?: string } | null;

    // Aggregate by platform
    const byPlatform: Record<string, number> = {};
    let totalBudget = 0;
    for (const c of allCampaigns) {
      const platform = c.platform;
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      totalBudget += c.budget;
    }

    // Collect unique targeting data
    const allLocations = new Set<string>();
    const allInterests = new Set<string>();
    const allKeywords = new Set<string>();
    let globalAgeMin = 65;
    let globalAgeMax = 18;

    for (const c of allCampaigns) {
      const t = c.targeting as CampaignRow['targeting'] | null;
      if (t) {
        (t.locations ?? []).forEach((l) => allLocations.add(l));
        (t.interests ?? []).forEach((i) => allInterests.add(i));
        (t.keywords ?? []).forEach((k) => allKeywords.add(k));
        if (t.ageMin !== undefined && t.ageMin < globalAgeMin) globalAgeMin = t.ageMin;
        if (t.ageMax !== undefined && t.ageMax > globalAgeMax) globalAgeMax = t.ageMax;
      }
    }

    // Budget allocation
    const budgetAllocation = Object.entries(byPlatform).map(([platform, count]) => {
      const platformBudget = allCampaigns
        .filter((c) => c.platform === platform)
        .reduce((sum, c) => sum + c.budget, 0);
      return {
        platform,
        amount: platformBudget,
        percentage: totalBudget > 0 ? Math.round((platformBudget / totalBudget) * 100) : 0,
      };
    });

    const brief: AdsBrief = {
      projectName: project.name,
      generatedAt: new Date().toISOString(),
      campaignStructure: {
        totalCampaigns: allCampaigns.length,
        byPlatform,
        totalBudget,
        budgetCurrency: budget?.currency ?? 'EUR',
      },
      campaigns: allCampaigns.map((c) => {
        const t = c.targeting as CampaignRow['targeting'] | null;
        const cr = c.creatives as CampaignRow['creatives'] | null;
        return {
          name: c.name,
          platform: c.platform,
          objective: c.objective,
          budget: c.budget,
          budgetType: c.budgetType,
          targeting: {
            locations: t?.locations ?? [],
            ageRange: `${t?.ageMin ?? 18}-${t?.ageMax ?? 65}`,
            interests: t?.interests ?? [],
            keywords: t?.keywords ?? [],
            audiences: t?.audiences ?? [],
          },
          creative: {
            headline: cr?.headline ?? '',
            description: cr?.description ?? '',
            callToAction: cr?.callToAction ?? 'LEARN_MORE',
            landingUrl: cr?.landingUrl ?? '',
            imageUrl: cr?.imageUrl ?? '',
          },
          status: c.status,
        };
      }),
      audienceTargeting: {
        primaryLocations: Array.from(allLocations),
        ageRange: `${globalAgeMin}-${globalAgeMax}`,
        topInterests: Array.from(allInterests).slice(0, 10),
        topKeywords: Array.from(allKeywords).slice(0, 10),
      },
      creativeSpecs: {
        metaAdSpecs: {
          imageSize: '1080x1080 or 1200x628',
          videoLength: '15-60 seconds recommended',
          headlineMaxChars: 40,
          bodyMaxChars: 125,
        },
        googleAdSpecs: {
          headlineMaxChars: 30,
          descriptionMaxChars: 90,
          headlines: 15,
          descriptions: 4,
        },
      },
      budgetAllocation,
      recommendations: this.generateRecommendations(allCampaigns, totalBudget),
    };

    this.log.info(
      { projectId, campaignCount: allCampaigns.length },
      'Ads brief generated',
    );
    return brief;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchCampaigns(
    projectId: string,
    platforms: string[],
  ): Promise<CampaignRow[]> {
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        projectId,
        platform: { in: platforms as never[] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      objective: c.objective,
      budget: c.budget,
      budgetType: c.budgetType,
      targeting: (c.targeting as CampaignRow['targeting']) ?? {},
      creatives: (c.creatives as CampaignRow['creatives']) ?? {
        headline: '',
        description: '',
      },
      status: c.status,
    }));
  }

  private mapMetaObjective(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'OUTCOME_AWARENESS',
      traffic: 'OUTCOME_TRAFFIC',
      engagement: 'OUTCOME_ENGAGEMENT',
      leads: 'OUTCOME_LEADS',
      sales: 'OUTCOME_SALES',
      conversions: 'OUTCOME_SALES',
      lead_generation: 'OUTCOME_LEADS',
      brand_awareness: 'OUTCOME_AWARENESS',
      reach: 'OUTCOME_AWARENESS',
      video_views: 'OUTCOME_AWARENESS',
      app_installs: 'OUTCOME_TRAFFIC',
    };
    return mapping[objective.toLowerCase()] || 'OUTCOME_TRAFFIC';
  }

  /**
   * Split a headline into up to 3 parts of max 30 characters each
   * (Google Ads Responsive Search Ad limit).
   */
  private splitHeadline(headline: string): string[] {
    if (headline.length <= 30) return [headline];

    const words = headline.split(' ');
    const parts: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= 30) {
        current = test;
      } else {
        if (current) parts.push(current);
        current = word.slice(0, 30);
      }
      if (parts.length >= 3) break;
    }

    if (current && parts.length < 3) parts.push(current);
    return parts;
  }

  /**
   * Split a description into up to 2 parts of max 90 characters each
   * (Google Ads Responsive Search Ad limit).
   */
  private splitDescription(description: string): string[] {
    if (description.length <= 90) return [description];

    const sentences = description.split(/(?<=[.!?])\s+/);
    const parts: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const test = current ? `${current} ${sentence}` : sentence;
      if (test.length <= 90) {
        current = test;
      } else {
        if (current) parts.push(current);
        current = sentence.slice(0, 90);
      }
      if (parts.length >= 2) break;
    }

    if (current && parts.length < 2) parts.push(current);
    return parts;
  }

  private generateRecommendations(
    campaigns: { platform: string; budget: number; objective: string; status: string }[],
    totalBudget: number,
  ): string[] {
    const recs: string[] = [];

    const metaCampaigns = campaigns.filter(
      (c) => c.platform === 'FACEBOOK' || c.platform === 'INSTAGRAM',
    );
    const googleCampaigns = campaigns.filter((c) => c.platform === 'GOOGLE');

    if (metaCampaigns.length === 0 && googleCampaigns.length > 0) {
      recs.push(
        'Consider adding Meta (Facebook/Instagram) campaigns for broader reach and brand awareness.',
      );
    }
    if (googleCampaigns.length === 0 && metaCampaigns.length > 0) {
      recs.push(
        'Consider adding Google Search campaigns to capture high-intent traffic.',
      );
    }

    if (totalBudget < 500) {
      recs.push(
        'Total ad budget is under $500. Consider focusing on one platform to maximize impact.',
      );
    }

    const draftCampaigns = campaigns.filter((c) => c.status === 'DRAFT');
    if (draftCampaigns.length > 0) {
      recs.push(
        `${draftCampaigns.length} campaign(s) are still in DRAFT status. Review and activate when ready.`,
      );
    }

    if (campaigns.length > 0) {
      recs.push(
        'Ensure tracking pixels (Meta Pixel, Google Ads conversion tag) are installed before launching.',
      );
      recs.push(
        'Set up UTM parameters on all landing URLs for accurate attribution.',
      );
    }

    return recs;
  }
}
