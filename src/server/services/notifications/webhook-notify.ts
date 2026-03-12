/**
 * Webhook notification service.
 * Sends event payloads to configured webhook URLs (Slack, Discord, custom endpoints).
 */

import { logger } from '@/lib/logger';
import crypto from 'crypto';

export type WebhookEventType =
  | 'project.created'
  | 'project.submitted'
  | 'pipeline.stage_completed'
  | 'pipeline.error'
  | 'content.generated'
  | 'content.approved'
  | 'campaign.launched'
  | 'campaign.paused'
  | 'email_sequence.started'
  | 'payment.received'
  | 'payment.failed';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events?: WebhookEventType[];
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * Generate an HMAC-SHA256 signature for webhook payload verification.
 */
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Send a webhook notification to a single endpoint.
 */
export async function sendWebhook(
  config: WebhookConfig,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<boolean> {
  // Skip if this config filters events and the event is not in the list
  if (config.events && config.events.length > 0 && !config.events.includes(event)) {
    return true; // Not an error, just filtered out
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);
  const maxRetries = config.retries ?? 3;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Launchpad-Webhook/1.0',
    ...config.headers,
  };

  if (config.secret) {
    headers['X-Webhook-Signature'] = `sha256=${signPayload(body, config.secret)}`;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        logger.info({
          msg: 'Webhook delivered',
          event,
          url: config.url,
          status: response.status,
          attempt,
        });
        return true;
      }

      // Non-retryable client errors
      if (response.status >= 400 && response.status < 500) {
        logger.warn({
          msg: 'Webhook rejected by server',
          event,
          url: config.url,
          status: response.status,
          attempt,
        });
        return false;
      }

      // Server errors are retryable
      logger.warn({
        msg: 'Webhook delivery failed, will retry',
        event,
        url: config.url,
        status: response.status,
        attempt,
        maxRetries,
      });
    } catch (err) {
      logger.warn({
        msg: 'Webhook delivery error',
        event,
        url: config.url,
        error: err instanceof Error ? err.message : String(err),
        attempt,
        maxRetries,
      });
    }

    // Exponential backoff before retry
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  logger.error({
    msg: 'Webhook delivery failed after all retries',
    event,
    url: config.url,
    maxRetries,
  });

  return false;
}

/**
 * Broadcast a webhook event to multiple configured endpoints.
 */
export async function broadcastWebhook(
  configs: WebhookConfig[],
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const results = await Promise.allSettled(
    configs.map((config) => sendWebhook(config, event, data)),
  );

  let succeeded = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { total: configs.length, succeeded, failed };
}

/**
 * Format a webhook payload for Slack's incoming webhook format.
 */
export function formatSlackMessage(event: WebhookEventType, data: Record<string, unknown>): Record<string, unknown> {
  const projectName = (data.projectName as string) || 'Unknown project';

  const eventLabels: Record<WebhookEventType, string> = {
    'project.created': `New project created: *${projectName}*`,
    'project.submitted': `Project submitted for processing: *${projectName}*`,
    'pipeline.stage_completed': `Pipeline stage completed for *${projectName}*: ${data.stageName || ''}`,
    'pipeline.error': `Pipeline error in *${projectName}*: ${data.error || ''}`,
    'content.generated': `${data.count || ''} content pieces generated for *${projectName}*`,
    'content.approved': `Content approved for *${projectName}*`,
    'campaign.launched': `Ad campaign launched for *${projectName}*: ${data.campaignName || ''}`,
    'campaign.paused': `Ad campaign paused for *${projectName}*: ${data.campaignName || ''}`,
    'email_sequence.started': `Email sequence started for *${projectName}*: ${data.sequenceName || ''}`,
    'payment.received': `Payment received for *${projectName}*: ${data.amount || ''}`,
    'payment.failed': `Payment failed for *${projectName}*`,
  };

  return {
    text: eventLabels[event] || `Event: ${event}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: eventLabels[event] || `Event: ${event}`,
        },
      },
    ],
  };
}
