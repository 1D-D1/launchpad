/**
 * Internal AI endpoint: Content Generation
 * POST /api/internal/ai/content
 *
 * Generates content batches (SOCIAL_POST, AD_COPY, EMAIL, BLOG_POST)
 * using Claude and stores them in the Content table as DRAFT.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { validateInternalRequest } from '@/lib/internal-api';
import { generateJSON } from '@/server/services/ai/claude';
import {
  buildContentGenerationSystemPrompt,
  buildContentGenerationUserPrompt,
  type ContentGenerationInput,
  type ContentGenerationResult,
} from '@/server/services/ai/prompts/content-generation';
import {
  buildAdCopySystemPrompt,
  buildAdCopyUserPrompt,
  type AdCopyInput,
  type AdCopyResult,
} from '@/server/services/ai/prompts/ad-copy';
import {
  buildEmailSequenceSystemPrompt,
  buildEmailSequenceUserPrompt,
  type EmailSequenceInput,
  type EmailSequenceResult,
} from '@/server/services/ai/prompts/email-sequences';
import type { ContentType } from '@prisma/client';

const log = logger.child({ route: '/api/internal/ai/content' });

// Map request type to Prisma ContentType
const TYPE_MAP: Record<string, ContentType> = {
  SOCIAL_POST: 'SOCIAL_POST',
  AD_COPY: 'AD_COPY',
  EMAIL: 'EMAIL',
  BLOG_POST: 'BLOG_POST',
  // Worker-style keys
  'social-posts': 'SOCIAL_POST',
  'ad-copy': 'AD_COPY',
  'email-sequences': 'EMAIL',
  'landing-page': 'LANDING_PAGE',
};

export async function POST(req: Request) {
  if (!validateInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      projectId,
      type,
      contentType: legacyType,
      platform,
      count = 5,
    } = body as {
      projectId: string;
      type?: string;
      contentType?: string;
      platform?: string;
      count?: number;
    };

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const requestedType = type || legacyType || 'SOCIAL_POST';
    const prismaType = TYPE_MAP[requestedType];

    if (!prismaType) {
      return NextResponse.json(
        { error: `Unknown content type: ${requestedType}. Valid types: ${Object.keys(TYPE_MAP).join(', ')}` },
        { status: 400 },
      );
    }

    log.info({ projectId, type: prismaType, count }, 'Starting content generation');

    // 1. Fetch project + strategy + existing content
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const strategy = await prisma.strategy.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const existingContent = await prisma.content.findMany({
      where: { projectId, type: prismaType },
      select: { body: true },
      take: 10,
    });

    // Parse strategy for context
    let strategyData: Record<string, unknown> = {};
    if (strategy?.fullDocument) {
      try {
        strategyData = typeof strategy.fullDocument === 'string'
          ? JSON.parse(strategy.fullDocument)
          : strategy.fullDocument as Record<string, unknown>;
      } catch {
        log.warn({ projectId }, 'Could not parse strategy document');
      }
    }

    const targetAudience = (project.targetAudience as Record<string, unknown>) || {};
    const objectives = (project.objectives as Record<string, unknown>) || {};
    const budget = (project.budget as Record<string, unknown>) || {};

    // 2. Generate content based on type
    let contentPieces: Array<{ title: string; body: string; bodyVariantB?: string; platform?: string; metadata?: Record<string, unknown> }> = [];

    if (prismaType === 'SOCIAL_POST' || prismaType === 'BLOG_POST') {
      contentPieces = await generateSocialContent(project, strategyData, targetAudience, existingContent, count, platform);
    } else if (prismaType === 'AD_COPY') {
      contentPieces = await generateAdContent(project, strategyData, targetAudience, budget);
    } else if (prismaType === 'EMAIL') {
      contentPieces = await generateEmailContent(project, strategyData, targetAudience);
    } else {
      // Generic content generation fallback
      contentPieces = await generateSocialContent(project, strategyData, targetAudience, existingContent, count, platform);
    }

    // 3. Store each content piece in DB
    const createdIds: string[] = [];

    for (const piece of contentPieces) {
      const created = await prisma.content.create({
        data: {
          projectId,
          type: prismaType,
          title: piece.title,
          body: piece.body,
          bodyVariantB: piece.bodyVariantB ?? null,
          status: 'DRAFT',
        },
      });
      createdIds.push(created.id);
    }

    log.info({ projectId, type: prismaType, generatedCount: contentPieces.length }, 'Content generation completed');

    return NextResponse.json({
      contentIds: createdIds,
      count: createdIds.length,
      type: prismaType,
      pieces: contentPieces,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, 'Content generation failed');

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
      { error: 'Content generation failed', details: message },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Content type-specific generators
// ---------------------------------------------------------------------------

async function generateSocialContent(
  project: { name: string; vertical: string; description: string },
  strategyData: Record<string, unknown>,
  targetAudience: Record<string, unknown>,
  existingContent: Array<{ body: string }>,
  count: number,
  platform?: string,
): Promise<Array<{ title: string; body: string; bodyVariantB?: string }>> {
  const overview = (strategyData.overview as Record<string, unknown>) || {};
  const contentPlan = (strategyData.contentPlan as Record<string, unknown>) || {};

  const input: ContentGenerationInput = {
    projectName: project.name,
    vertical: project.vertical,
    brandVoice: (overview.tone as string) || 'Professional yet approachable',
    keyMessage: (overview.keyMessage as string) || project.description,
    platforms: platform ? [platform] : ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'],
    contentTypes: ['SOCIAL_POST'],
    themes: (contentPlan.themes as string[]) || [project.vertical, 'Value proposition', 'Customer success'],
    targetAudience: (targetAudience.demographics as string) || 'General audience',
    count,
    includeVariantB: true,
    existingContent: existingContent.map((c) => c.body),
  };

  const systemPrompt = buildContentGenerationSystemPrompt();
  const userPrompt = buildContentGenerationUserPrompt(input);

  const result = await generateJSON<ContentGenerationResult>(
    systemPrompt,
    userPrompt,
    8192,
    { temperature: 0.7 },
  );

  return (result.contents || []).map((c) => ({
    title: c.title,
    body: c.body,
    bodyVariantB: c.bodyVariantB,
  }));
}

async function generateAdContent(
  project: { name: string; vertical: string; description: string },
  strategyData: Record<string, unknown>,
  targetAudience: Record<string, unknown>,
  budget: Record<string, unknown>,
): Promise<Array<{ title: string; body: string; bodyVariantB?: string }>> {
  const overview = (strategyData.overview as Record<string, unknown>) || {};

  const input: AdCopyInput = {
    projectName: project.name,
    vertical: project.vertical,
    productDescription: project.description,
    valueProposition: (overview.keyMessage as string) || project.description,
    targetAudience: (targetAudience.demographics as string) || 'General audience',
    platforms: ['META', 'GOOGLE'],
    objective: 'CONVERSION',
    budget: (budget.total as number) || 1000,
    currency: (budget.currency as string) || 'USD',
    brandTone: (overview.tone as string) || 'Professional',
  };

  const systemPrompt = buildAdCopySystemPrompt();
  const userPrompt = buildAdCopyUserPrompt(input);

  const result = await generateJSON<AdCopyResult>(
    systemPrompt,
    userPrompt,
    8192,
    { temperature: 0.5 },
  );

  const pieces: Array<{ title: string; body: string; bodyVariantB?: string }> = [];

  // Convert Meta ads to content pieces
  for (const ad of result.meta || []) {
    pieces.push({
      title: ad.headline,
      body: ad.primaryText,
      bodyVariantB: ad.variantB?.primaryText,
    });
  }

  // Convert Google ads to content pieces
  for (const ad of result.google || []) {
    pieces.push({
      title: ad.headlines?.[0] || 'Google Ad',
      body: ad.descriptions?.join('\n') || '',
    });
  }

  return pieces;
}

async function generateEmailContent(
  project: { name: string; vertical: string; description: string },
  strategyData: Record<string, unknown>,
  targetAudience: Record<string, unknown>,
): Promise<Array<{ title: string; body: string }>> {
  const overview = (strategyData.overview as Record<string, unknown>) || {};
  const emailStrategy = (strategyData.emailStrategy as Record<string, unknown>) || {};

  const input: EmailSequenceInput = {
    projectName: project.name,
    vertical: project.vertical,
    productDescription: project.description,
    targetSegment: (targetAudience.demographics as string) || 'Decision makers',
    valueProposition: (overview.keyMessage as string) || project.description,
    sequenceName: `${project.name} - Outreach`,
    stepCount: 5,
    cadence: 'Every 3 days',
    tone: 'conversational',
    senderName: 'Team',
    senderTitle: 'Growth Manager',
    companyName: project.name,
    includeFollowUps: true,
  };

  const systemPrompt = buildEmailSequenceSystemPrompt();
  const userPrompt = buildEmailSequenceUserPrompt(input);

  const result = await generateJSON<EmailSequenceResult>(
    systemPrompt,
    userPrompt,
    8192,
    { temperature: 0.5 },
  );

  return (result.steps || []).map((step) => ({
    title: step.subject,
    body: step.body,
  }));
}
