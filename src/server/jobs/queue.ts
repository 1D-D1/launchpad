/**
 * BullMQ queue configuration and shared Redis connection.
 * Central module for creating, retrieving, and configuring all job queues.
 */

import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Queue name constants
// ---------------------------------------------------------------------------

export const QUEUE_COMPETITIVE_ANALYSIS = 'competitive-analysis' as const;
export const QUEUE_STRATEGY_GENERATION = 'strategy-generation' as const;
export const QUEUE_CONTENT_GENERATION = 'content-generation' as const;
export const QUEUE_SOCIAL_PUBLISHING = 'social-publishing' as const;
export const QUEUE_ADS_CAMPAIGN = 'ads-campaign' as const;
export const QUEUE_EMAIL_CAMPAIGN = 'email-campaign' as const;
export const QUEUE_PIPELINE_ORCHESTRATOR = 'pipeline-orchestrator' as const;
export const QUEUE_SEO_CONTENT = 'seo-content' as const;

export const ALL_QUEUE_NAMES = [
  QUEUE_COMPETITIVE_ANALYSIS,
  QUEUE_STRATEGY_GENERATION,
  QUEUE_CONTENT_GENERATION,
  QUEUE_SOCIAL_PUBLISHING,
  QUEUE_ADS_CAMPAIGN,
  QUEUE_EMAIL_CAMPAIGN,
  QUEUE_PIPELINE_ORCHESTRATOR,
  QUEUE_SEO_CONTENT,
] as const;

export type QueueName = (typeof ALL_QUEUE_NAMES)[number];

// ---------------------------------------------------------------------------
// Shared Redis connection
// ---------------------------------------------------------------------------

let sharedConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!sharedConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    sharedConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        logger.warn({ times, delay }, 'Redis reconnecting');
        return delay;
      },
    });

    sharedConnection.on('connect', () => {
      logger.info('Redis connected');
    });

    sharedConnection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });
  }
  return sharedConnection;
}

// ---------------------------------------------------------------------------
// Default job options
// ---------------------------------------------------------------------------

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 50,
};

// ---------------------------------------------------------------------------
// Queue registry
// ---------------------------------------------------------------------------

const queueRegistry = new Map<string, Queue>();
const queueEventsRegistry = new Map<string, QueueEvents>();

/**
 * Create (or return existing) a BullMQ Queue for the given name.
 */
export function createQueue(name: QueueName): Queue {
  const existing = queueRegistry.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  queueRegistry.set(name, queue);
  logger.info({ queue: name }, 'Queue created');
  return queue;
}

/**
 * Retrieve an already-created queue by name. Creates it if not yet initialized.
 */
export function getQueue(name: QueueName): Queue {
  return createQueue(name);
}

/**
 * Get a QueueEvents instance for listening to job lifecycle events.
 */
export function getQueueEvents(name: QueueName): QueueEvents {
  const existing = queueEventsRegistry.get(name);
  if (existing) return existing;

  const queueEvents = new QueueEvents(name, {
    connection: getRedisConnection(),
  });

  queueEventsRegistry.set(name, queueEvents);
  return queueEvents;
}

/**
 * Gracefully close all queues and the shared Redis connection.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [name, queue] of queueRegistry) {
    logger.info({ queue: name }, 'Closing queue');
    closePromises.push(queue.close());
  }

  for (const [name, events] of queueEventsRegistry) {
    logger.info({ queue: name }, 'Closing queue events');
    closePromises.push(events.close());
  }

  await Promise.all(closePromises);
  queueRegistry.clear();
  queueEventsRegistry.clear();

  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
    logger.info('Redis connection closed');
  }
}
