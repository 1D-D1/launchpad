/**
 * Publishing scheduler service.
 * Checks for approved content that is due for publishing and dispatches to the appropriate platform.
 */

import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';
import { VistaSocialService } from './vista-social';
import { MetaGraphService } from './meta-graph';

export class PublishingScheduler {
  private readonly log = logger.child({ service: 'PublishingScheduler' });

  /**
   * Check for approved content with scheduledAt <= now and publish each piece.
   * Uses Vista Social as the primary publisher, falling back to Meta Graph API
   * for Facebook/Instagram if Vista Social is not configured.
   */
  async checkAndPublish(): Promise<void> {
    const now = new Date();
    this.log.info({ checkTime: now.toISOString() }, 'Checking for content to publish');

    const pendingContent = await prisma.content.findMany({
      where: {
        status: 'APPROVED',
        scheduledAt: { lte: now },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (pendingContent.length === 0) {
      this.log.debug('No content ready to publish');
      return;
    }

    this.log.info({ count: pendingContent.length }, 'Found content to publish');

    let vistaService: VistaSocialService | null = null;
    let metaService: MetaGraphService | null = null;

    // Try to initialize services (they may throw if not configured)
    try {
      vistaService = new VistaSocialService();
    } catch {
      this.log.debug('Vista Social not configured, will try Meta Graph API fallback');
    }

    try {
      metaService = new MetaGraphService();
    } catch {
      this.log.debug('Meta Graph API not configured');
    }

    for (const content of pendingContent) {
      try {
        await this.publishContent(content, vistaService, metaService);

        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });

        this.log.info(
          { contentId: content.id, platform: content.platform, projectName: content.project.name },
          'Content published successfully',
        );
      } catch (err) {
        this.log.error(
          { err, contentId: content.id, platform: content.platform },
          'Failed to publish content',
        );

        await prisma.content.update({
          where: { id: content.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  /**
   * Schedule a content piece for publishing at a specific time.
   */
  async scheduleContent(contentId: string, publishAt: Date): Promise<void> {
    this.log.info(
      { contentId, publishAt: publishAt.toISOString() },
      'Scheduling content for publishing',
    );

    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new Error(`Content ${contentId} not found`);
    }

    if (!['DRAFT', 'APPROVED'].includes(content.status)) {
      throw new Error(
        `Content ${contentId} has status "${content.status}" and cannot be scheduled. ` +
          'Only DRAFT or APPROVED content can be scheduled.',
      );
    }

    await prisma.content.update({
      where: { id: contentId },
      data: {
        status: 'APPROVED',
        scheduledAt: publishAt,
      },
    });

    this.log.info({ contentId, publishAt: publishAt.toISOString() }, 'Content scheduled');
  }

  private async publishContent(
    content: { id: string; body: string; platform: string | null; visualUrl: string | null; externalId: string | null },
    vistaService: VistaSocialService | null,
    metaService: MetaGraphService | null,
  ): Promise<void> {
    // Try Vista Social first (supports all platforms)
    if (vistaService && content.externalId) {
      const mediaUrls = content.visualUrl ? [content.visualUrl] : [];
      await vistaService.schedulePost(
        content.externalId,
        content.body,
        mediaUrls,
        new Date(), // publish immediately
      );
      return;
    }

    // Fallback to Meta Graph API for Facebook/Instagram
    if (
      metaService &&
      content.platform &&
      ['FACEBOOK', 'INSTAGRAM'].includes(content.platform)
    ) {
      if (!content.externalId) {
        throw new Error(
          `Content ${content.id} requires an externalId (page ID) for Meta Graph publishing`,
        );
      }
      await metaService.publishPost(
        content.externalId,
        content.body,
        content.visualUrl || undefined,
      );
      return;
    }

    throw new Error(
      `No publishing service available for platform "${content.platform}". ` +
        'Configure VISTA_SOCIAL_API_KEY or META_ACCESS_TOKEN.',
    );
  }
}
