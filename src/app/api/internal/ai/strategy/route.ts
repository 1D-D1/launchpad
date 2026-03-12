/**
 * Internal AI endpoint: Strategy Generation
 * POST /api/internal/ai/strategy
 *
 * Fetches project + competitive analysis, calls Claude with strategy prompt,
 * stores result in Strategy table.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { validateInternalRequest } from '@/lib/internal-api';
import { generateJSON } from '@/server/services/ai/claude';
import {
  buildStrategySystemPrompt,
  buildStrategyUserPrompt,
  type StrategyInput,
  type StrategyResult,
} from '@/server/services/ai/prompts/strategy';
import type { CompetitiveAnalysisResult } from '@/server/services/ai/prompts/competitive-analysis';

const log = logger.child({ route: '/api/internal/ai/strategy' });

export async function POST(req: Request) {
  if (!validateInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    log.info({ projectId }, 'Starting strategy generation');

    // 1. Fetch project + competitive analysis
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const analyses = await prisma.competitiveAnalysis.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (analyses.length === 0) {
      return NextResponse.json(
        { error: 'No competitive analysis found for project. Run analysis first.' },
        { status: 400 },
      );
    }

    // Parse the most recent full report as the competitive analysis result
    const latestReport = analyses[0].fullReport;
    let competitiveAnalysis: CompetitiveAnalysisResult;

    try {
      competitiveAnalysis = typeof latestReport === 'string'
        ? JSON.parse(latestReport)
        : latestReport as unknown as CompetitiveAnalysisResult;
    } catch {
      log.warn({ projectId }, 'Could not parse competitive analysis report, using defaults');
      competitiveAnalysis = {
        summary: 'Analysis data not available in structured format.',
        marketOverview: { size: 'Unknown', trends: [], opportunities: [], threats: [] },
        competitors: [],
        positioning: {
          currentState: 'Unknown',
          recommendedPosition: 'To be determined',
          uniqueValueProposition: 'To be determined',
          differentiators: [],
        },
        swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
        recommendations: { immediate: [], shortTerm: [], longTerm: [] },
      };
    }

    // 2. Build prompt
    const targetAudience = (project.targetAudience as Record<string, unknown>) || {};
    const objectives = (project.objectives as Record<string, unknown>) || {};
    const budget = (project.budget as Record<string, unknown>) || {};

    const strategyInput: StrategyInput = {
      projectName: project.name,
      vertical: project.vertical,
      description: project.description,
      budget: {
        total: (budget.total as number) || 0,
        currency: (budget.currency as string) || 'USD',
        allocation: budget.allocation as Record<string, number> | undefined,
      },
      objectives: {
        primary: (objectives.primary as string) || 'Grow market presence',
        secondary: objectives.secondary as string[] | undefined,
        kpis: objectives.kpis as string[] | undefined,
      },
      targetAudience: {
        demographics: targetAudience.demographics as string | undefined,
        interests: targetAudience.interests as string[] | undefined,
        location: targetAudience.location as string | undefined,
        ageRange: targetAudience.ageRange as string | undefined,
      },
      competitiveAnalysis,
    };

    const systemPrompt = buildStrategySystemPrompt();
    const userPrompt = buildStrategyUserPrompt(strategyInput);

    log.info({ projectId }, 'Calling Claude for strategy generation');

    const strategyResult = await generateJSON<StrategyResult>(
      systemPrompt,
      userPrompt,
      8192,
      { temperature: 0.4 },
    );

    // 3. Store in Strategy table
    await prisma.strategy.create({
      data: {
        projectId,
        positioning: strategyResult.overview?.keyMessage ?? null,
        messaging: (strategyResult.overview ?? null) as any,
        channels: (strategyResult.channels ?? null) as any,
        calendar: (strategyResult.contentPlan?.calendarWeeks ?? null) as any,
        personas: undefined,
        valueProps: (strategyResult.contentPlan?.themes ?? null) as any,
        angles: (strategyResult.adStrategy ?? null) as any,
        fullDocument: JSON.stringify(strategyResult),
      },
    });

    log.info({ projectId }, 'Strategy generation completed');

    return NextResponse.json(strategyResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, 'Strategy generation failed');

    if (message.includes('rate_limit') || message.includes('429')) {
      return NextResponse.json(
        { error: 'AI rate limit exceeded, please retry', retryable: true },
        { status: 429, headers: { 'Retry-After': '30' } },
      );
    }

    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'AI request timed out, please retry', retryable: true },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: 'Strategy generation failed', details: message },
      { status: 500 },
    );
  }
}
