import { prisma } from '@/server/db/prisma';

// --- Types ---

export interface ChannelBudget {
  channel: string;
  percentage: number;
  amount: number;
  minimumDaily: number;
  valid: boolean;
}

export interface BudgetSuggestion {
  channel: string;
  currentPercent: number;
  suggestedPercent: number;
  reason: string;
}

export interface BudgetValidation {
  valid: boolean;
  totalBudget: number;
  allocatedBudget: number;
  warnings: string[];
  suggestions: BudgetSuggestion[];
  breakdown: ChannelBudget[];
}

export interface MonthlyProjection {
  month: number;
  label: string;
  channels: {
    channel: string;
    budget: number;
    estimatedImpressions: number;
    estimatedClicks: number;
    estimatedConversions: number;
    estimatedRevenue: number;
  }[];
  totalBudget: number;
  totalRevenue: number;
  cumulativeBudget: number;
  cumulativeRevenue: number;
}

export interface MonthlyBreakdown {
  months: MonthlyProjection[];
  totalBudget: number;
  totalProjectedRevenue: number;
  estimatedROI: number;
}

export interface PrelaunchCheck {
  label: string;
  status: 'pass' | 'fail' | 'warning';
  detail: string;
}

export interface PrelaunchValidation {
  ready: boolean;
  checks: PrelaunchCheck[];
}

// --- Minimums per channel (daily in EUR) ---

const CHANNEL_MINIMUMS: Record<string, number> = {
  meta_ads: 5,
  google_ads: 10,
  linkedin_ads: 10,
  twitter_ads: 5,
  email: 0,
  seo: 0,
  social_organic: 0,
};

// --- Estimated performance multipliers (per EUR spent monthly) ---

const CHANNEL_ESTIMATES: Record<string, { impressionsPerEur: number; ctrPercent: number; conversionPercent: number; revenuePerConversion: number }> = {
  meta_ads: { impressionsPerEur: 80, ctrPercent: 2.5, conversionPercent: 3, revenuePerConversion: 50 },
  google_ads: { impressionsPerEur: 40, ctrPercent: 4, conversionPercent: 5, revenuePerConversion: 60 },
  linkedin_ads: { impressionsPerEur: 20, ctrPercent: 1.5, conversionPercent: 4, revenuePerConversion: 100 },
  twitter_ads: { impressionsPerEur: 60, ctrPercent: 1.8, conversionPercent: 2, revenuePerConversion: 40 },
  email: { impressionsPerEur: 200, ctrPercent: 15, conversionPercent: 5, revenuePerConversion: 45 },
  seo: { impressionsPerEur: 100, ctrPercent: 3, conversionPercent: 2, revenuePerConversion: 55 },
  social_organic: { impressionsPerEur: 150, ctrPercent: 2, conversionPercent: 1.5, revenuePerConversion: 35 },
};

export class BudgetValidator {
  /** Validate budget allocation for a project */
  async validateBudget(projectId: string): Promise<BudgetValidation> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { strategies: { take: 1, orderBy: { createdAt: 'desc' } } },
    });

    const budgetData = project.budget as Record<string, unknown>;
    const totalBudget = Number(budgetData?.total ?? 0);
    const allocation = (budgetData?.allocation ?? {}) as Record<string, number>;

    const warnings: string[] = [];
    const suggestions: BudgetSuggestion[] = [];
    const breakdown: ChannelBudget[] = [];

    // Calculate allocated total
    const totalPercent = Object.values(allocation).reduce((s, v) => s + v, 0);
    const allocatedBudget = Object.entries(allocation).reduce(
      (s, [, pct]) => s + (totalBudget * pct) / 100,
      0
    );

    // Check: total allocation does not exceed 100%
    if (totalPercent > 100) {
      warnings.push(`Channel allocations sum to ${totalPercent}%, which exceeds 100%.`);
    }

    if (totalPercent < 100 && totalPercent > 0) {
      warnings.push(`Only ${totalPercent}% of budget is allocated. ${(100 - totalPercent).toFixed(0)}% is unassigned.`);
    }

    // Check each channel
    for (const [channel, pct] of Object.entries(allocation)) {
      const amount = (totalBudget * pct) / 100;
      const dailyAmount = amount / 30;
      const minimumDaily = CHANNEL_MINIMUMS[channel] ?? 0;
      const valid = dailyAmount >= minimumDaily || minimumDaily === 0;

      breakdown.push({
        channel,
        percentage: pct,
        amount,
        minimumDaily,
        valid,
      });

      if (!valid) {
        warnings.push(
          `${formatChannel(channel)}: daily budget is ${dailyAmount.toFixed(2)} EUR, below minimum ${minimumDaily} EUR/day.`
        );
        suggestions.push({
          channel,
          currentPercent: pct,
          suggestedPercent: Math.ceil(((minimumDaily * 30) / totalBudget) * 100),
          reason: `Increase to meet minimum daily spend of ${minimumDaily} EUR.`,
        });
      }
    }

    // Check: realistic expectations
    if (totalBudget < 300 && Object.keys(allocation).some((ch) => ch.includes('ads'))) {
      warnings.push('Budget below 300 EUR/month may limit ad campaign effectiveness. Consider focusing on fewer channels.');
    }

    const valid = warnings.length === 0;

    return { valid, totalBudget, allocatedBudget, warnings, suggestions, breakdown };
  }

  /** Calculate monthly budget breakdown with projections */
  async getMonthlyBreakdown(projectId: string): Promise<MonthlyBreakdown> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const budgetData = project.budget as Record<string, unknown>;
    const totalMonthlyBudget = Number(budgetData?.total ?? 0);
    const allocation = (budgetData?.allocation ?? {}) as Record<string, number>;

    const months: MonthlyProjection[] = [];
    let cumulativeBudget = 0;
    let cumulativeRevenue = 0;

    for (let m = 1; m <= 6; m++) {
      // Progressive scaling: months 1-2 at 70%, months 3-4 at 85%, months 5-6 at 100%
      const scaleFactor = m <= 2 ? 0.7 : m <= 4 ? 0.85 : 1.0;
      // Learning bonus: performance improves over time
      const learningMultiplier = 1 + (m - 1) * 0.05;

      const channels = Object.entries(allocation).map(([channel, pct]) => {
        const budget = (totalMonthlyBudget * pct * scaleFactor) / 100;
        const est = CHANNEL_ESTIMATES[channel] ?? CHANNEL_ESTIMATES.meta_ads;

        const estimatedImpressions = Math.round(budget * est.impressionsPerEur * learningMultiplier);
        const estimatedClicks = Math.round(estimatedImpressions * (est.ctrPercent / 100));
        const estimatedConversions = Math.round(estimatedClicks * (est.conversionPercent / 100));
        const estimatedRevenue = Math.round(estimatedConversions * est.revenuePerConversion);

        return {
          channel,
          budget: Math.round(budget),
          estimatedImpressions,
          estimatedClicks,
          estimatedConversions,
          estimatedRevenue,
        };
      });

      const totalMonth = channels.reduce((s, c) => s + c.budget, 0);
      const totalRev = channels.reduce((s, c) => s + c.estimatedRevenue, 0);
      cumulativeBudget += totalMonth;
      cumulativeRevenue += totalRev;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = new Date().getMonth();

      months.push({
        month: m,
        label: `Month ${m} (${monthNames[(startMonth + m - 1) % 12]})`,
        channels,
        totalBudget: totalMonth,
        totalRevenue: totalRev,
        cumulativeBudget,
        cumulativeRevenue,
      });
    }

    return {
      months,
      totalBudget: cumulativeBudget,
      totalProjectedRevenue: cumulativeRevenue,
      estimatedROI: cumulativeBudget > 0 ? ((cumulativeRevenue - cumulativeBudget) / cumulativeBudget) * 100 : 0,
    };
  }

  /** Run pre-launch checks */
  async prelaunchCheck(projectId: string): Promise<PrelaunchValidation> {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        stripeData: true,
        contents: { where: { status: 'APPROVED' } },
        campaigns: true,
        emailSequences: { include: { _count: { select: { steps: true } } } },
        strategies: true,
      },
    });

    const budgetData = project.budget as Record<string, unknown>;
    const checks: PrelaunchCheck[] = [];

    // Stripe
    checks.push({
      label: 'Stripe Connected',
      status: project.stripeData ? 'pass' : 'fail',
      detail: project.stripeData ? 'Stripe account is connected.' : 'Connect your Stripe account to process payments.',
    });

    // Meta Ads
    const hasMetaCampaigns = project.campaigns.some((c) => c.platform === 'FACEBOOK' || c.platform === 'INSTAGRAM');
    checks.push({
      label: 'Meta Ads Ready',
      status: hasMetaCampaigns ? 'pass' : 'warning',
      detail: hasMetaCampaigns ? `${project.campaigns.filter((c) => c.platform === 'FACEBOOK' || c.platform === 'INSTAGRAM').length} campaigns configured.` : 'No Meta ad campaigns created yet.',
    });

    // Google Ads
    const hasGoogleCampaigns = project.campaigns.some((c) => c.platform === 'GOOGLE');
    checks.push({
      label: 'Google Ads Ready',
      status: hasGoogleCampaigns ? 'pass' : 'warning',
      detail: hasGoogleCampaigns ? `${project.campaigns.filter((c) => c.platform === 'GOOGLE').length} campaigns configured.` : 'No Google ad campaigns created yet.',
    });

    // Email / SMTP
    const hasEmailSequences = project.emailSequences.some((s) => s._count.steps > 0);
    checks.push({
      label: 'Email Sequences Ready',
      status: hasEmailSequences ? 'pass' : 'warning',
      detail: hasEmailSequences ? `${project.emailSequences.length} sequences with steps.` : 'No email sequences with steps configured.',
    });

    // Content readiness
    const approvedContent = project.contents.length;
    checks.push({
      label: 'Content Approved',
      status: approvedContent > 0 ? 'pass' : 'fail',
      detail: approvedContent > 0 ? `${approvedContent} content pieces approved.` : 'No content has been approved yet.',
    });

    // Budget approved
    const budgetApproved = (budgetData?.approved as boolean) === true;
    checks.push({
      label: 'Budget Approved',
      status: budgetApproved ? 'pass' : 'fail',
      detail: budgetApproved ? 'Budget has been approved.' : 'Budget needs approval before launch.',
    });

    // Strategy exists
    checks.push({
      label: 'Strategy Generated',
      status: project.strategies.length > 0 ? 'pass' : 'fail',
      detail: project.strategies.length > 0 ? 'Marketing strategy is generated.' : 'Generate a strategy first.',
    });

    const ready = checks.every((c) => c.status !== 'fail');

    return { ready, checks };
  }
}

function formatChannel(channel: string): string {
  return channel
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
