/**
 * Stripe client singleton with helper methods for checkout, subscriptions, and webhooks.
 */

import Stripe from 'stripe';
import { logger } from '@/lib/logger';

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

export { getStripe };

/**
 * Create a Stripe Checkout session for a project subscription.
 */
export async function createCheckoutSession(params: {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  projectId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(params.customerId
      ? { customer: params.customerId }
      : { customer_email: params.customerEmail }),
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { projectId: params.projectId },
    ...(params.trialDays && {
      subscription_data: { trial_period_days: params.trialDays },
    }),
  });

  logger.info({
    msg: 'Stripe checkout session created',
    sessionId: session.id,
    projectId: params.projectId,
  });

  return session;
}

/**
 * Retrieve a customer by ID, or create one if email is provided and no ID exists.
 */
export async function getOrCreateCustomer(params: {
  customerId?: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();

  if (params.customerId) {
    const existing = await stripe.customers.retrieve(params.customerId);
    if (!existing.deleted) {
      return existing as Stripe.Customer;
    }
  }

  // Search by email
  const found = await stripe.customers.list({ email: params.email, limit: 1 });
  if (found.data.length > 0) {
    return found.data[0];
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });

  logger.info({ msg: 'Stripe customer created', customerId: customer.id, email: params.email });

  return customer;
}

/**
 * Cancel a subscription immediately or at period end.
 */
export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean = true,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  if (atPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Retrieve subscription details.
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Create a billing portal session so the customer can manage their subscription.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Verify a Stripe webhook signature and parse the event.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * List invoices for a customer.
 */
export async function listInvoices(
  customerId: string,
  limit: number = 10,
): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();

  const response = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return response.data;
}
