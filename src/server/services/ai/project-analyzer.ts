/**
 * AI Project Analyzer.
 * Uses Claude to analyze project data and generate comprehensive insights,
 * pricing recommendations, ideal client profiles, and revision prompts.
 */

import { generateJSON } from './claude';
import { logger } from '@/lib/logger';
import { prisma } from '@/server/db/prisma';
import {
  buildProjectAnalysisSystemPrompt,
  buildProjectAnalysisUserPrompt,
  buildPricingAnalysisSystemPrompt,
  buildIdealClientSystemPrompt,
  type ProjectAnalysis,
  type ProjectAnalysisInput,
  type PricingAnalysis,
  type IdealClientProfile,
} from './prompts/project-analysis';

const log = logger.child({ service: 'ProjectAnalyzer' });

export class ProjectAnalyzer {
  /**
   * Run a full AI-powered project analysis.
   * Fetches all project data, sends to Claude, and returns structured insights.
   */
  async analyzeProject(projectId: string): Promise<ProjectAnalysis> {
    log.info({ projectId }, 'Starting full project analysis');

    const input = await this.gatherProjectData(projectId);

    const systemPrompt = buildProjectAnalysisSystemPrompt();
    const userPrompt = buildProjectAnalysisUserPrompt(input);

    log.debug({ projectId }, 'Sending project data to Claude for analysis');

    const analysis = await generateJSON<ProjectAnalysis>(
      systemPrompt,
      userPrompt,
      8192,
      { temperature: 0.3 },
    );

    log.info(
      {
        projectId,
        actionItems: analysis.actionItems.length,
        riskFactors: analysis.riskFactors.length,
        validationScore: analysis.targetClient.validationScore,
      },
      'Project analysis completed',
    );

    return analysis;
  }

  /**
   * Generate a Claude Code prompt for project revision based on analysis results.
   */
  async generateRevisionPrompt(
    projectId: string,
    analysis: ProjectAnalysis,
  ): Promise<string> {
    log.info({ projectId }, 'Generating revision prompt');

    // If the analysis already includes a revision prompt, enhance it with context
    if (analysis.claudeCodeRevisionPrompt) {
      const input = await this.gatherProjectData(projectId);

      const enhancedPrompt = `# Project Revision Prompt for "${input.project.name}"
# Generated from AI Analysis on ${new Date().toISOString().split('T')[0]}

## Context
- Vertical: ${input.project.vertical}
- Budget: ${input.budget.total} ${input.budget.currency}
- Primary Objective: ${input.objectives.primary}
- Current Revenue: ${input.revenue} ${input.budget.currency}

## Analysis Summary
- Business Model Strengths: ${analysis.businessModel.strengths.join(', ')}
- Business Model Weaknesses: ${analysis.businessModel.weaknesses.join(', ')}
- Target Client Validation Score: ${analysis.targetClient.validationScore}/100
- Top Channels: ${analysis.channelStrategy.bestChannels.join(', ')}
- Risk Count: ${analysis.riskFactors.length}

## Revision Instructions

${analysis.claudeCodeRevisionPrompt}

## Priority Action Items
${analysis.actionItems
  .slice(0, 5)
  .map((a) => `${a.priority}. [${a.effort}] ${a.action} -> ${a.expectedImpact}`)
  .join('\n')}

## Budget Reallocation
${analysis.channelStrategy.budgetReallocation
  .map((b) => `- ${b.channel}: ${b.currentPct}% -> ${b.suggestedPct}% (${b.reason})`)
  .join('\n')}

## Content Gaps to Fill
${analysis.contentStrategy.contentGaps.map((g) => `- ${g}`).join('\n')}
`;

      log.info({ projectId }, 'Enhanced revision prompt generated');
      return enhancedPrompt;
    }

    return analysis.claudeCodeRevisionPrompt;
  }

  /**
   * Validate and analyze pricing strategy.
   */
  async validatePricing(projectId: string): Promise<PricingAnalysis> {
    log.info({ projectId }, 'Starting pricing analysis');

    const input = await this.gatherProjectData(projectId);

    const systemPrompt = buildPricingAnalysisSystemPrompt();
    const userPrompt = buildProjectAnalysisUserPrompt(input);

    const analysis = await generateJSON<PricingAnalysis>(
      systemPrompt,
      userPrompt,
      4096,
      { temperature: 0.3 },
    );

    log.info(
      {
        projectId,
        tiers: analysis.suggestedTiers.length,
        alignment: analysis.valuePropositionAlignment,
      },
      'Pricing analysis completed',
    );

    return analysis;
  }

  /**
   * Generate a detailed Ideal Client Profile.
   */
  async identifyIdealClient(projectId: string): Promise<IdealClientProfile> {
    log.info({ projectId }, 'Starting ideal client identification');

    const input = await this.gatherProjectData(projectId);

    const systemPrompt = buildIdealClientSystemPrompt();
    const userPrompt = buildProjectAnalysisUserPrompt(input);

    const profile = await generateJSON<IdealClientProfile>(
      systemPrompt,
      userPrompt,
      4096,
      { temperature: 0.4 },
    );

    log.info(
      {
        projectId,
        painPoints: profile.painPoints.length,
        channels: profile.whereToFindThem.onlineChannels.length,
      },
      'Ideal client profile generated',
    );

    return profile;
  }

  // ---------------------------------------------------------------------------
  // Private: data gathering
  // ---------------------------------------------------------------------------

  private async gatherProjectData(
    projectId: string,
  ): Promise<ProjectAnalysisInput> {
    log.debug({ projectId }, 'Gathering project data for analysis');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        strategies: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        contents: {
          select: { id: true, type: true, status: true, metrics: true },
        },
        campaigns: {
          select: {
            id: true,
            platform: true,
            status: true,
            budget: true,
            metrics: true,
          },
        },
        emailSequences: {
          select: {
            id: true,
            status: true,
            metrics: true,
            _count: { select: { leads: true, steps: true } },
          },
        },
        stripeData: {
          select: { revenue: true },
        },
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Aggregate content metrics
    const contentByType: Record<string, number> = {};
    const contentByStatus: Record<string, number> = {};
    for (const c of project.contents) {
      contentByType[c.type] = (contentByType[c.type] || 0) + 1;
      contentByStatus[c.status] = (contentByStatus[c.status] || 0) + 1;
    }

    // Aggregate ad metrics
    const adMetrics = project.campaigns.reduce(
      (acc, c) => {
        const m = c.metrics as Record<string, number> | null;
        if (m) {
          acc.impressions += m.impressions || 0;
          acc.clicks += m.clicks || 0;
          acc.conversions += m.conversions || 0;
          acc.spend += m.spend || 0;
        }
        acc.totalBudget += c.budget;
        if (c.status === 'ACTIVE') acc.activeCampaigns++;
        return acc;
      },
      {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        totalBudget: 0,
        activeCampaigns: 0,
      },
    );

    // Total leads across sequences
    const totalLeads = project.emailSequences.reduce(
      (sum, s) => sum + s._count.leads,
      0,
    );

    // Extract competitor data from analyses
    const competitors = project.analyses.map((a) => ({
      name: a.competitorName,
      url: a.competitorUrl ?? undefined,
      strengths: (a.strengths as string[]) ?? [],
      weaknesses: (a.weaknesses as string[]) ?? [],
      score: a.score ?? undefined,
    }));

    // Extract strategy data
    const latestStrategy = project.strategies[0];
    const strategy = latestStrategy
      ? {
          positioning: latestStrategy.positioning ?? undefined,
          channels: latestStrategy.channels ?? undefined,
          personas: latestStrategy.personas ?? undefined,
          valueProps: latestStrategy.valueProps ?? undefined,
        }
      : undefined;

    const targetAudience = project.targetAudience as {
      demographics?: string;
      interests?: string[];
      location?: string;
      ageRange?: string;
    };

    const budget = project.budget as {
      total: number;
      currency: string;
      allocation?: Record<string, number>;
    };

    const objectives = project.objectives as {
      primary: string;
      secondary?: string[];
      kpis?: string[];
    };

    const input: ProjectAnalysisInput = {
      project: {
        name: project.name,
        description: project.description,
        vertical: project.vertical,
        status: project.status,
      },
      targetAudience,
      budget,
      objectives,
      competitors,
      strategy,
      contentMetrics: {
        totalContent: project.contents.length,
        byType: contentByType,
        byStatus: contentByStatus,
      },
      adMetrics: {
        totalCampaigns: project.campaigns.length,
        activeCampaigns: adMetrics.activeCampaigns,
        totalBudget: adMetrics.totalBudget,
        impressions: adMetrics.impressions,
        clicks: adMetrics.clicks,
        conversions: adMetrics.conversions,
        spend: adMetrics.spend,
        ctr:
          adMetrics.impressions > 0
            ? (adMetrics.clicks / adMetrics.impressions) * 100
            : 0,
      },
      emailMetrics: {
        totalSequences: project.emailSequences.length,
        totalLeads,
      },
      revenue: project.stripeData?.revenue ?? 0,
    };

    log.debug(
      {
        projectId,
        contentPieces: input.contentMetrics.totalContent,
        campaigns: input.adMetrics.totalCampaigns,
        competitors: input.competitors.length,
      },
      'Project data gathered',
    );

    return input;
  }
}
