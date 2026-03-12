/**
 * Social Content Engine — orchestrates AI-powered social media content generation.
 * Handles carousel creation, infographics, weekly calendars, platform adaptation,
 * and A/B variant generation.
 */

import type { Platform, Prisma, SocialPost, SocialPostType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { generateJSON } from '@/server/services/ai/claude';
import {
  carouselSystemPrompt,
  carouselUserPrompt,
  infographicSystemPrompt,
  infographicUserPrompt,
  socialCalendarSystemPrompt,
  socialCalendarUserPrompt,
  platformAdaptSystemPrompt,
  platformAdaptUserPrompt,
  captionVariantSystemPrompt,
  captionVariantUserPrompt,
  type CarouselResult,
  type InfographicResult,
  type CalendarResult,
  type AdaptedPostResult,
  type CaptionVariantResult,
} from '@/server/services/ai/prompts/social-media';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSlot {
  day: string;
  time: string;
  score: number; // engagement likelihood 0-100
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch project with its latest strategy for context. */
async function getProjectContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      strategies: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project;
}

function buildPersona(project: { name: string; vertical: string; targetAudience: unknown }): string {
  const audience =
    typeof project.targetAudience === 'object'
      ? JSON.stringify(project.targetAudience)
      : String(project.targetAudience);
  return `Brand: ${project.name}, Vertical: ${project.vertical}, Target Audience: ${audience}`;
}

function buildStrategyContext(
  project: { strategies: { fullDocument?: string | null; messaging?: unknown }[] },
): string {
  const strategy = project.strategies[0];
  if (!strategy) return 'No strategy document available — use general best practices.';
  return strategy.fullDocument?.slice(0, 1500) ?? JSON.stringify(strategy.messaging ?? {}).slice(0, 1500);
}

// ---------------------------------------------------------------------------
// SocialContentEngine
// ---------------------------------------------------------------------------

export class SocialContentEngine {
  /**
   * Generate a single carousel post.
   */
  async generateCarousel(
    projectId: string,
    topic: string,
    platform: Platform,
  ): Promise<SocialPost> {
    const project = await getProjectContext(projectId);
    const persona = buildPersona(project);
    const strategy = buildStrategyContext(project);

    logger.info({ msg: 'Generating carousel', projectId, topic, platform });

    const result = await generateJSON<CarouselResult>(
      carouselSystemPrompt(),
      carouselUserPrompt(topic, platform, persona, strategy),
      8192,
    );

    const post = await prisma.socialPost.create({
      data: {
        projectId,
        platform,
        postType: 'CAROUSEL' as SocialPostType,
        caption: result.caption,
        hashtags: result.hashtags,
        carouselSlides: result.slides as unknown as Prisma.InputJsonValue,
        visualPrompt: result.slides.map((s) => s.visualPrompt).join('\n---\n'),
        bestTimeToPost: this.getDefaultTime(platform),
        status: 'DRAFT',
      },
    });

    logger.info({ msg: 'Carousel generated', postId: post.id, slideCount: result.slides.length });
    return post;
  }

  /**
   * Generate an infographic post.
   */
  async generateInfographic(
    projectId: string,
    topic: string,
    data?: Record<string, string>,
  ): Promise<SocialPost> {
    const project = await getProjectContext(projectId);

    logger.info({ msg: 'Generating infographic', projectId, topic });

    const result = await generateJSON<InfographicResult>(
      infographicSystemPrompt(),
      infographicUserPrompt(topic, data, project.name),
      4096,
    );

    const post = await prisma.socialPost.create({
      data: {
        projectId,
        platform: 'LINKEDIN',
        postType: 'INFOGRAPHIC' as SocialPostType,
        caption: `${result.title} — ${result.subtitle}`,
        infographicData: result as unknown as Prisma.InputJsonValue,
        visualPrompt: `Infographic: ${result.title}. Sections: ${result.sections.map((s) => s.heading).join(', ')}. Color scheme: ${result.colorScheme}`,
        bestTimeToPost: this.getDefaultTime('LINKEDIN'),
        status: 'DRAFT',
      },
    });

    logger.info({ msg: 'Infographic generated', postId: post.id });
    return post;
  }

  /**
   * Generate a full week of social content across platforms.
   */
  async generateWeeklyContent(
    projectId: string,
    platforms: Platform[],
  ): Promise<SocialPost[]> {
    const project = await getProjectContext(projectId);
    const strategy = buildStrategyContext(project);

    // Fetch existing recent posts to avoid duplication
    const existingPosts = await prisma.socialPost.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { caption: true },
    });

    const weekStart = new Date();
    const weekLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    logger.info({ msg: 'Generating weekly content', projectId, platforms, weekLabel });

    const result = await generateJSON<CalendarResult>(
      socialCalendarSystemPrompt(),
      socialCalendarUserPrompt(
        strategy,
        platforms,
        existingPosts.map((p) => p.caption),
        weekLabel,
      ),
      16384,
    );

    const posts: SocialPost[] = [];
    for (const item of result.posts) {
      const post = await prisma.socialPost.create({
        data: {
          projectId,
          platform: item.platform as Platform,
          postType: item.postType as SocialPostType,
          caption: item.caption,
          hashtags: item.hashtags,
          visualPrompt: item.visualBrief,
          bestTimeToPost: item.bestTimeToPost,
          status: 'DRAFT',
        },
      });
      posts.push(post);
    }

    logger.info({ msg: 'Weekly content generated', projectId, postCount: posts.length });
    return posts;
  }

  /**
   * Adapt an existing post to another platform.
   */
  async adaptToPlatform(
    postId: string,
    targetPlatform: Platform,
  ): Promise<SocialPost> {
    const source = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!source) throw new Error(`Post ${postId} not found`);

    logger.info({ msg: 'Adapting post', postId, from: source.platform, to: targetPlatform });

    const result = await generateJSON<AdaptedPostResult>(
      platformAdaptSystemPrompt(),
      platformAdaptUserPrompt(source.caption, source.platform, targetPlatform),
      4096,
    );

    const adapted = await prisma.socialPost.create({
      data: {
        projectId: source.projectId,
        platform: targetPlatform,
        postType: source.postType,
        caption: result.caption,
        hashtags: result.hashtags,
        carouselSlides: source.carouselSlides ?? undefined,
        infographicData: source.infographicData ?? undefined,
        visualPrompt: source.visualPrompt,
        bestTimeToPost: this.getDefaultTime(targetPlatform),
        status: 'DRAFT',
      },
    });

    logger.info({ msg: 'Post adapted', newPostId: adapted.id });
    return adapted;
  }

  /**
   * Generate an A/B caption variant.
   */
  async generateVariant(postId: string): Promise<SocialPost> {
    const source = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!source) throw new Error(`Post ${postId} not found`);

    const angles = ['curiosity', 'pain point', 'social proof', 'urgency', 'benefit', 'story'];
    const angle = angles[Math.floor(Math.random() * angles.length)];

    logger.info({ msg: 'Generating caption variant', postId, angle });

    const result = await generateJSON<CaptionVariantResult>(
      captionVariantSystemPrompt(),
      captionVariantUserPrompt(source.caption, source.platform, angle),
      4096,
    );

    // Store variant on the original post
    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: {
        captionVariantB: result.variantCaption,
      },
    });

    logger.info({ msg: 'Caption variant generated', postId, angle: result.angle });
    return updated;
  }

  /**
   * Get optimal posting schedule recommendations for a platform.
   */
  async getOptimalSchedule(platform: Platform, _timezone: string): Promise<TimeSlot[]> {
    const schedules: Record<string, TimeSlot[]> = {
      LINKEDIN: [
        { day: 'Tuesday', time: '8:00 AM', score: 92 },
        { day: 'Wednesday', time: '10:00 AM', score: 88 },
        { day: 'Thursday', time: '12:00 PM', score: 85 },
        { day: 'Tuesday', time: '12:00 PM', score: 82 },
        { day: 'Wednesday', time: '8:00 AM', score: 80 },
      ],
      INSTAGRAM: [
        { day: 'Monday', time: '11:00 AM', score: 90 },
        { day: 'Wednesday', time: '7:00 PM', score: 88 },
        { day: 'Friday', time: '12:00 PM', score: 85 },
        { day: 'Thursday', time: '1:00 PM', score: 83 },
        { day: 'Tuesday', time: '9:00 PM', score: 80 },
      ],
      FACEBOOK: [
        { day: 'Wednesday', time: '1:00 PM', score: 91 },
        { day: 'Thursday', time: '2:00 PM', score: 87 },
        { day: 'Friday', time: '3:00 PM', score: 84 },
        { day: 'Wednesday', time: '3:00 PM', score: 81 },
        { day: 'Thursday', time: '4:00 PM', score: 78 },
      ],
      TIKTOK: [
        { day: 'Tuesday', time: '7:00 PM', score: 93 },
        { day: 'Thursday', time: '8:00 PM', score: 89 },
        { day: 'Saturday', time: '11:00 AM', score: 86 },
        { day: 'Wednesday', time: '7:00 PM', score: 83 },
        { day: 'Friday', time: '9:00 PM', score: 80 },
      ],
      TWITTER: [
        { day: 'Monday', time: '8:00 AM', score: 88 },
        { day: 'Wednesday', time: '12:00 PM', score: 86 },
        { day: 'Tuesday', time: '10:00 AM', score: 84 },
        { day: 'Thursday', time: '9:00 AM', score: 81 },
        { day: 'Friday', time: '1:00 PM', score: 79 },
      ],
    };

    return schedules[platform] ?? schedules['INSTAGRAM'];
  }

  /**
   * Batch generate content for the next month (4 weeks).
   */
  async generateMonthlyPlan(
    projectId: string,
    platforms: Platform[],
  ): Promise<{ week: number; posts: SocialPost[] }[]> {
    const plan: { week: number; posts: SocialPost[] }[] = [];

    for (let week = 1; week <= 4; week++) {
      logger.info({ msg: 'Generating monthly plan week', projectId, week });
      const posts = await this.generateWeeklyContent(projectId, platforms);
      plan.push({ week, posts });
    }

    return plan;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getDefaultTime(platform: Platform | string): string {
    const defaults: Record<string, string> = {
      LINKEDIN: 'Tuesday 10:00 AM',
      INSTAGRAM: 'Wednesday 12:00 PM',
      FACEBOOK: 'Thursday 2:00 PM',
      TIKTOK: 'Thursday 7:00 PM',
      TWITTER: 'Monday 9:00 AM',
    };
    return defaults[platform] ?? 'Wednesday 10:00 AM';
  }
}

/** Singleton instance */
export const socialContentEngine = new SocialContentEngine();
