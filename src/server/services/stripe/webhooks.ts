/**
 * Stripe webhook event handler.
 * Processes incoming Stripe events and updates the database accordingly.
 */

import type Stripe from 'stripe';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

const log = logger.child({ service: 'StripeWebhooks' });

/**
 * Handle a verified Stripe webhook event.
 * Dispatches to the appropriate handler based on event type.
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  log.info({ type: event.type, id: event.id }, 'Processing Stripe webhook event');

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialEnding(event.data.object as Stripe.Subscription);
      break;

    default:
      log.debug({ type: event.type }, 'Unhandled Stripe event type');
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const projectId = session.metadata?.projectId;
  if (!projectId) {
    log.warn({ sessionId: session.id }, 'Checkout session has no projectId metadata');
    return;
  }

  log.info({ projectId, sessionId: session.id }, 'Checkout completed');

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

  log.info({ projectId }, 'Project activated after checkout');
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  const stripeProject = await prisma.stripeProject.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!stripeProject) {
    log.debug({ customerId }, 'No project found for customer');
    return;
  }

  const amountPaid = (invoice.amount_paid || 0) / 100;

  await prisma.stripeProject.update({
    where: { id: stripeProject.id },
    data: {
      revenue: { increment: amountPaid },
    },
  });

  log.info(
    { projectId: stripeProject.projectId, amountPaid, invoiceId: invoice.id },
    'Invoice paid, revenue updated',
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  const stripeProject = await prisma.stripeProject.findFirst({
    where: { stripeCustomerId: customerId },
    include: { project: { select: { id: true, name: true } } },
  });

  if (!stripeProject) {
    log.debug({ customerId }, 'No project found for customer');
    return;
  }

  log.warn(
    {
      projectId: stripeProject.projectId,
      projectName: stripeProject.project.name,
      invoiceId: invoice.id,
      attemptCount: invoice.attempt_count,
    },
    'Payment failed for project',
  );

  // After 3 failed attempts, pause the project
  if (invoice.attempt_count && invoice.attempt_count >= 3) {
    await prisma.stripeProject.update({
      where: { id: stripeProject.id },
      data: { status: 'PAST_DUE' },
    });

    await prisma.project.update({
      where: { id: stripeProject.projectId },
      data: { status: 'PAUSED' },
    });

    log.warn(
      { projectId: stripeProject.projectId },
      'Project paused after 3 failed payment attempts',
    );
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeProject = await prisma.stripeProject.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!stripeProject) {
    log.debug({ subscriptionId: subscription.id }, 'No project found for subscription');
    return;
  }

  const statusMap: Record<string, string> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELLED',
    unpaid: 'PAST_DUE',
    trialing: 'TRIALING',
  };

  const newStatus = statusMap[subscription.status] || 'ACTIVE';

  await prisma.stripeProject.update({
    where: { id: stripeProject.id },
    data: { status: newStatus },
  });

  log.info(
    { projectId: stripeProject.projectId, subscriptionStatus: subscription.status, internalStatus: newStatus },
    'Subscription updated',
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeProject = await prisma.stripeProject.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!stripeProject) {
    log.debug({ subscriptionId: subscription.id }, 'No project found for subscription');
    return;
  }

  await prisma.stripeProject.update({
    where: { id: stripeProject.id },
    data: { status: 'CANCELLED' },
  });

  await prisma.project.update({
    where: { id: stripeProject.projectId },
    data: { status: 'PAUSED' },
  });

  log.info(
    { projectId: stripeProject.projectId, subscriptionId: subscription.id },
    'Subscription cancelled, project paused',
  );
}

async function handleTrialEnding(
  subscription: Stripe.Subscription,
): Promise<void> {
  const stripeProject = await prisma.stripeProject.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      project: {
        select: { id: true, name: true, userId: true },
      },
    },
  });

  if (!stripeProject) {
    return;
  }

  log.info(
    {
      projectId: stripeProject.projectId,
      projectName: stripeProject.project.name,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    },
    'Trial ending soon for project',
  );
}
