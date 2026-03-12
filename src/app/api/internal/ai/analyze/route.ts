/**
 * Internal AI endpoint: Competitive Analysis
 * POST /api/internal/ai/analyze
 *
 * Receives project data + scraped competitor info, calls Claude for analysis,
 * stores results in CompetitiveAnalysis table.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { validateInternalRequest } from '@/lib/internal-api';
import { generateJSON } from '@/server/services/ai/claude';
import { WebsiteAnalyzer } from '@/server/services/scraping/website-analyzer';
import { GoogleSerpScraper } from '@/server/services/scraping/google-serp';
import { SocialProfileScraper } from '@/server/services/scraping/social-profiles';
import {
  buildCompetitiveAnalysisSystemPrompt,
  buildCompetitiveAnalysisUserPrompt,
  type CompetitiveAnalysisInput,
  type CompetitiveAnalysisResult,
} from '@/server/services/ai/prompts/competitive-analysis';

const log = logger.child({ route: '/api/internal/ai/analyze' });

export async function POST(req: Request) {
  // Auth check
  if (!validateInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    log.info({ projectId }, 'Starting competitive analysis');

    // 1. Fetch project + competitors
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const competitors = (project.competitors as Array<{ name: string; url?: string }>) || [];
    const targetAudience = (project.targetAudience as Record<string, unknown>) || {};
    const objectives = (project.objectives as Record<string, unknown>) || {};

    // 2. Run scrapers for each competitor URL
    const websiteAnalyzer = new WebsiteAnalyzer();
    const serpScraper = new GoogleSerpScraper();
    const socialScraper = new SocialProfileScraper();

    const scraperResults = await Promise.allSettled(
      competitors
        .filter((c) => c.url)
        .map(async (competitor) => {
          log.info({ competitor: competitor.name, url: competitor.url }, 'Analyzing competitor');

          const [websiteData, socialData] = await Promise.allSettled([
            websiteAnalyzer.analyze(competitor.url!),
            (async () => {
              const platform = socialScraper.detectPlatform(competitor.url!);
              if (platform) {
                return socialScraper.analyzeProfile(platform, competitor.url!);
              }
              return null;
            })(),
          ]);

          return {
            name: competitor.name,
            url: competitor.url,
            website: websiteData.status === 'fulfilled' ? websiteData.value : null,
            social: socialData.status === 'fulfilled' ? socialData.value : null,
          };
        }),
    );

    const competitorData = scraperResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<{ name: string; url?: string; website: unknown; social: unknown }>).value);

    // 3. Search SERP for project keywords
    const keywords: string[] = [];
    if (project.name) keywords.push(project.name);
    if (project.vertical) keywords.push(project.vertical);
    if (typeof objectives === 'object' && objectives && 'primary' in objectives) {
      keywords.push(String(objectives.primary));
    }

    const serpData = keywords.length > 0
      ? await serpScraper.searchKeywords(keywords).catch((err) => {
          log.warn({ err }, 'SERP search failed, continuing without');
          return [];
        })
      : [];

    // 4. Build prompt and call Claude
    const analysisInput: CompetitiveAnalysisInput = {
      projectName: project.name,
      vertical: project.vertical,
      description: project.description,
      competitors: competitors.map((c) => ({ name: c.name, url: c.url })),
      targetAudience: {
        demographics: targetAudience.demographics as string | undefined,
        interests: targetAudience.interests as string[] | undefined,
        location: targetAudience.location as string | undefined,
        ageRange: targetAudience.ageRange as string | undefined,
      },
      objectives: {
        primary: (objectives as Record<string, unknown>).primary as string || 'Grow market presence',
        secondary: (objectives as Record<string, unknown>).secondary as string[] | undefined,
      },
    };

    const systemPrompt = buildCompetitiveAnalysisSystemPrompt();
    const userPrompt = buildCompetitiveAnalysisUserPrompt(analysisInput) +
      `\n\nADDITIONAL SCRAPED DATA:\n${JSON.stringify({ competitorData, serpData }, null, 2).slice(0, 8000)}`;

    log.info({ projectId }, 'Calling Claude for competitive analysis');

    const analysisResult = await generateJSON<CompetitiveAnalysisResult>(
      systemPrompt,
      userPrompt,
      8192,
      { temperature: 0.3 },
    );

    // 5. Store results in CompetitiveAnalysis table
    for (const competitor of competitors) {
      const competitorScrapedData = competitorData.find((c) => c.name === competitor.name);

      await prisma.competitiveAnalysis.create({
        data: {
          projectId,
          competitorName: competitor.name,
          competitorUrl: competitor.url ?? null,
          serpData: serpData as any,
          socialData: (competitorScrapedData?.social ?? null) as any,
          websiteData: (competitorScrapedData?.website ?? null) as any,
          fullReport: JSON.stringify(analysisResult),
        },
      });
    }

    log.info({ projectId, competitorCount: competitors.length }, 'Competitive analysis completed');

    return NextResponse.json(analysisResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, 'Competitive analysis failed');

    // Handle Claude-specific errors
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
      { error: 'Competitive analysis failed', details: message },
      { status: 500 },
    );
  }
}
