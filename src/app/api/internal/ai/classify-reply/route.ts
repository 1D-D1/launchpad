/**
 * Internal AI endpoint: Reply Classification
 * POST /api/internal/ai/classify-reply
 *
 * Classifies an email reply using Claude to determine lead intent,
 * updates lead status accordingly.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { validateInternalRequest } from '@/lib/internal-api';
import { generateCompletion } from '@/server/services/ai/claude';
import type { LeadStatus } from '@prisma/client';

const log = logger.child({ route: '/api/internal/ai/classify-reply' });

type ReplyClassification = 'INTERESTED' | 'NOT_INTERESTED' | 'OOO' | 'UNSUBSCRIBE' | 'QUESTION';

const VALID_CLASSIFICATIONS: ReplyClassification[] = [
  'INTERESTED',
  'NOT_INTERESTED',
  'OOO',
  'UNSUBSCRIBE',
  'QUESTION',
];

// Map classification to lead status
const CLASSIFICATION_TO_STATUS: Record<ReplyClassification, LeadStatus> = {
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  OOO: 'REPLIED',        // OOO is still a reply, keep them in pipeline
  UNSUBSCRIBE: 'OPTED_OUT',
  QUESTION: 'REPLIED',   // Questions indicate engagement
};

export async function POST(req: Request) {
  if (!validateInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { replyText, leadId } = body as { replyText: string; leadId: string };

    if (!replyText || !leadId) {
      return NextResponse.json(
        { error: 'replyText and leadId are required' },
        { status: 400 },
      );
    }

    log.info({ leadId }, 'Classifying email reply');

    // 1. Verify the lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 2. Classify with Claude
    const systemPrompt = `You are an email reply classifier for a sales outreach system.
Classify the reply into exactly ONE of these categories:
- INTERESTED: The person shows interest, wants to learn more, or is open to a meeting/call
- NOT_INTERESTED: The person explicitly declines, says no, or asks to stop
- OOO: Out of office / vacation auto-reply
- UNSUBSCRIBE: Explicitly asks to be removed from the mailing list
- QUESTION: Asks a question about the product/service without clear interest or disinterest

Respond with ONLY the classification word, nothing else.`;

    let classification: ReplyClassification = 'QUESTION'; // default

    try {
      const result = await generateCompletion(
        systemPrompt,
        `Classify this email reply:\n\n${replyText.slice(0, 2000)}`,
        50,
        { temperature: 0 },
      );

      const parsed = result.trim().toUpperCase() as ReplyClassification;
      if (VALID_CLASSIFICATIONS.includes(parsed)) {
        classification = parsed;
      } else {
        log.warn({ rawResult: result }, 'Unexpected classification result, defaulting to QUESTION');
      }
    } catch (err) {
      log.error({ err }, 'Claude classification failed, defaulting to QUESTION');
    }

    // 3. Update lead status
    const newStatus = CLASSIFICATION_TO_STATUS[classification];

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        optedOut: classification === 'UNSUBSCRIBE',
      },
    });

    // 4. Record the classification event
    await prisma.leadEvent.create({
      data: {
        leadId,
        type: 'REPLY_CLASSIFIED',
        metadata: {
          classification,
          replyPreview: replyText.slice(0, 200),
          classifiedAt: new Date().toISOString(),
        },
      },
    });

    log.info({ leadId, classification, newStatus }, 'Reply classified and lead updated');

    return NextResponse.json({
      classification,
      leadStatus: newStatus,
      leadId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err }, 'Reply classification failed');

    return NextResponse.json(
      { error: 'Reply classification failed', details: message },
      { status: 500 },
    );
  }
}
