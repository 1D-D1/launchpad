/**
 * Worker: seo-content
 * Generates SEO blog posts with internal linking and GEO optimization.
 *
 * Flow:
 * 1. Receives projectId and optional keyword
 * 2. If no keyword: picks the next priority keyword from KeywordStrategy
 * 3. Fetches all existing blog posts for the project
 * 4. Calls Claude to generate article with internal linking context
 * 5. Runs GEO optimization pass
 * 6. Stores in BlogPost with all metadata
 * 7. Updates internal links in existing posts (backlinks)
 * 8. Updates keyword as "assigned"
 * 9. Logs everything
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { getRedisConnection, QUEUE_SEO_CONTENT } from '@/server/jobs/queue';
import { seoEngine } from '@/server/services/seo/engine';

export interface SeoContentJobData {
  projectId: string;
  keyword?: string;
  optimizeGeo?: boolean;
  pipelineJobId?: string;
}

const log = logger.child({ worker: QUEUE_SEO_CONTENT });

async function processSeoContent(job: Job<SeoContentJobData>): Promise<void> {
  const { projectId, keyword: inputKeyword, optimizeGeo = true } = job.data;
  log.info({ projectId, keyword: inputKeyword, jobId: job.id }, 'Starting SEO content generation');

  // 1. Determine which keyword to target
  let keyword = inputKeyword;

  if (!keyword) {
    log.info({ projectId }, 'No keyword specified, picking next priority keyword');

    const nextKeyword = await prisma.keywordStrategy.findFirst({
      where: { projectId, assignedPostId: null },
      orderBy: { priority: 'desc' },
    });

    if (!nextKeyword) {
      log.warn({ projectId }, 'No unassigned keywords found. Generate keywords first.');
      throw new Error('No unassigned keywords available. Run keyword research first.');
    }

    keyword = nextKeyword.keyword;
    log.info({ keyword, priority: nextKeyword.priority }, 'Selected keyword');
  }

  job.updateProgress(10);

  // 2. Generate the blog post (includes internal linking)
  log.info({ keyword }, 'Generating blog post with internal linking');
  const post = await seoEngine.generateBlogPost(projectId, keyword);

  job.updateProgress(60);

  log.info(
    {
      postId: post.id,
      slug: post.slug,
      wordCount: post.wordCount,
      seoScore: post.seoScore,
    },
    'Blog post generated',
  );

  // 3. Optional GEO optimization pass
  if (optimizeGeo) {
    log.info({ postId: post.id }, 'Running GEO optimization');
    const optimized = await seoEngine.optimizeForGeo(post.id);

    log.info(
      { postId: optimized.id, geoScore: optimized.geoScore },
      'GEO optimization completed',
    );
  }

  job.updateProgress(90);

  // 4. Log summary
  const finalPost = await prisma.blogPost.findUnique({ where: { id: post.id } });

  log.info(
    {
      projectId,
      postId: post.id,
      title: finalPost?.title,
      slug: finalPost?.slug,
      wordCount: finalPost?.wordCount,
      seoScore: finalPost?.seoScore,
      geoScore: finalPost?.geoScore,
      status: finalPost?.status,
    },
    'SEO content generation completed successfully',
  );

  job.updateProgress(100);
}

export function createSeoContentWorker(): Worker<SeoContentJobData> {
  const worker = new Worker<SeoContentJobData>(
    QUEUE_SEO_CONTENT,
    processSeoContent,
    {
      connection: getRedisConnection(),
      concurrency: 1, // Sequential to maintain internal linking order
    },
  );

  worker.on('completed', (job) => {
    log.info(
      { jobId: job.id, projectId: job.data.projectId, keyword: job.data.keyword },
      'SEO content job completed',
    );
  });

  worker.on('failed', (job, err) => {
    log.error(
      { jobId: job?.id, projectId: job?.data.projectId, keyword: job?.data.keyword, err },
      'SEO content job failed',
    );
  });

  worker.on('error', (err) => {
    log.error({ err }, 'SEO content worker error');
  });

  return worker;
}
