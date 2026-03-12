import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Meta webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Meta webhook verified');
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Meta webhook events
export async function POST(req: Request) {
  const body = await req.json();
  logger.info({ type: body.object }, 'Meta webhook received');

  // Process ad insights, page events, etc.
  if (body.entry) {
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        logger.info(
          { field: change.field, value: change.value },
          'Meta webhook change'
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
