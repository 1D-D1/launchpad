/**
 * Stripe checkout service.
 * Creates checkout sessions for project subscriptions.
 */

import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { createCheckoutSession, getOrCreateCustomer } from './client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Create a Stripe checkout session for a project.
 * If the user doesn't have a Stripe customer ID, one is created.
 * If the project doesn't have a StripeProject record, one is created.
 */
export async function createProjectCheckout(
  projectId: string,
  userId: string,
): Promise<{ checkoutUrl: string }> {
  const log = logger.child({ service: 'StripeCheckout', projectId, userId });

  log.info('Creating project checkout session');

  // Fetch the project and user
  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: { stripeData: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    }),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  if (project.userId !== userId) {
    throw new Error('User does not own this project');
  }

  // Get the price ID from environment or StripeProject
  const priceId =
    project.stripeData?.stripePriceId || process.env.STRIPE_DEFAULT_PRICE_ID;

  if (!priceId) {
    throw new Error(
      'No Stripe price configured. Set STRIPE_DEFAULT_PRICE_ID or create a StripeProject record with a stripePriceId.',
    );
  }

  // Ensure the user has a Stripe customer
  const customer = await getOrCreateCustomer({
    customerId: project.stripeData?.stripeCustomerId || undefined,
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: user.id },
  });

  // Ensure StripeProject record exists
  if (!project.stripeData) {
    await prisma.stripeProject.create({
      data: {
        projectId,
        stripeCustomerId: customer.id,
        stripePriceId: priceId,
        status: 'PENDING',
      },
    });
  } else if (!project.stripeData.stripeCustomerId) {
    await prisma.stripeProject.update({
      where: { id: project.stripeData.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  // Create checkout session
  const session = await createCheckoutSession({
    customerId: customer.id,
    priceId,
    projectId,
    successUrl: `${APP_URL}/projects/${projectId}?checkout=success`,
    cancelUrl: `${APP_URL}/projects/${projectId}?checkout=cancelled`,
    trialDays: parseInt(process.env.STRIPE_TRIAL_DAYS || '0', 10) || undefined,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  // Store the checkout URL
  await prisma.stripeProject.update({
    where: { projectId },
    data: { checkoutUrl: session.url },
  });

  log.info(
    { sessionId: session.id, customerId: customer.id },
    'Checkout session created',
  );

  return { checkoutUrl: session.url };
}
