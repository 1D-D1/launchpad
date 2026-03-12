import { Worker } from 'bullmq';
import http from 'http';
import {
  getRedisConnection,
  QUEUE_COMPETITIVE_ANALYSIS,
  QUEUE_STRATEGY_GENERATION,
  QUEUE_CONTENT_GENERATION,
  QUEUE_SOCIAL_PUBLISHING,
  QUEUE_ADS_CAMPAIGN,
  QUEUE_EMAIL_CAMPAIGN,
  QUEUE_PIPELINE_ORCHESTRATOR,
} from '../queue';
import { logger } from '@/lib/logger';

// Import worker factory functions
import { createCompetitiveAnalysisWorker } from './competitive-analysis.worker';
import { createStrategyGenerationWorker } from './strategy-generation.worker';
import { createContentGenerationWorker } from './content-generation.worker';
import { createSocialPublishingWorker } from './social-publishing.worker';
import { createAdsCampaignWorker } from './ads-campaign.worker';
import { createEmailCampaignWorker } from './email-campaign.worker';
import { createPipelineOrchestratorWorker } from './pipeline-orchestrator.worker';
import { createSeoContentWorker } from './seo-content.worker';

const workers: Worker[] = [];

function startWorkers() {
  logger.info('Starting all workers...');

  workers.push(createCompetitiveAnalysisWorker());
  workers.push(createStrategyGenerationWorker());
  workers.push(createContentGenerationWorker());
  workers.push(createSocialPublishingWorker());
  workers.push(createAdsCampaignWorker());
  workers.push(createEmailCampaignWorker());
  workers.push(createPipelineOrchestratorWorker());
  workers.push(createSeoContentWorker());

  logger.info({ count: workers.length }, 'All workers started');
}

// Health check server
const healthServer = http.createServer((_req, res) => {
  const healthy = workers.every((w) => w.isRunning());
  res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      workers: workers.length,
      timestamp: new Date().toISOString(),
    })
  );
});

async function shutdown() {
  logger.info('Shutting down workers...');
  healthServer.close();
  await Promise.all(workers.map((w) => w.close()));
  const conn = getRedisConnection();
  await conn.quit();
  logger.info('All workers stopped');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startWorkers();
healthServer.listen(3001, () => {
  logger.info('Worker health check listening on port 3001');
});
