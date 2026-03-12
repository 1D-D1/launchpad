import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import Redis from 'ioredis';

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // Check PostgreSQL
  const pgStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = { status: 'healthy', latency: Date.now() - pgStart };
  } catch (err) {
    logger.error({ err }, 'PostgreSQL health check failed');
    checks.postgres = { status: 'unhealthy', latency: Date.now() - pgStart };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    checks.redis = { status: 'unhealthy', latency: Date.now() - redisStart };
  }

  const allHealthy = Object.values(checks).every(
    (c) => c.status === 'healthy'
  );

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
