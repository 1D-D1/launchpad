import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const projectId = session.metadata?.projectId;
        if (projectId) {
          await prisma.stripeProject.update({
            where: { projectId },
            data: {
              status: 'ACTIVE',
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
            },
          });
          await prisma.project.update({
            where: { id: projectId },
            data: { status: 'ACTIVE' },
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const stripeProject = await prisma.stripeProject.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (stripeProject) {
          await prisma.stripeProject.update({
            where: { id: stripeProject.id },
            data: {
              revenue: { increment: (invoice.amount_paid || 0) / 100 },
            },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.warn({ invoiceId: invoice.id }, 'Payment failed');
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const sp = await prisma.stripeProject.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (sp) {
          await prisma.stripeProject.update({
            where: { id: sp.id },
            data: { status: 'CANCELLED' },
          });
          await prisma.project.update({
            where: { id: sp.projectId },
            data: { status: 'PAUSED' },
          });
        }
        break;
      }
    }
  } catch (err) {
    logger.error({ err, type: event.type }, 'Error processing webhook');
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
