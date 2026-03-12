/**
 * Email tracking service.
 * Generates tracking pixels, wraps links for click tracking, and records events.
 */

import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export class EmailTracker {
  private readonly log = logger.child({ service: 'EmailTracker' });

  /**
   * Generate a 1x1 transparent tracking pixel URL for open tracking.
   * The pixel is served by an API route that records the open event.
   */
  generateTrackingPixel(leadId: string, emailStepId: string): string {
    const params = new URLSearchParams({
      lid: leadId,
      sid: emailStepId,
    });

    const pixelUrl = `${APP_URL}/api/track/open?${params.toString()}`;

    this.log.debug(
      { leadId, emailStepId },
      'Tracking pixel generated',
    );

    return `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px;" />`;
  }

  /**
   * Replace all links in the HTML with tracked redirect URLs.
   * Preserves unsubscribe links and mailto links as-is.
   */
  wrapLinks(html: string, leadId: string): string {
    this.log.debug({ leadId }, 'Wrapping links for tracking');

    let wrappedCount = 0;

    const result = html.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (_match, url: string) => {
        // Skip tracking for unsubscribe links and known tracking URLs
        if (
          url.includes('/unsubscribe') ||
          url.includes('/api/track/') ||
          url.startsWith('mailto:')
        ) {
          return `href="${url}"`;
        }

        const params = new URLSearchParams({
          lid: leadId,
          url,
        });

        wrappedCount++;
        return `href="${APP_URL}/api/track/click?${params.toString()}"`;
      },
    );

    this.log.debug({ leadId, wrappedCount }, 'Links wrapped for tracking');
    return result;
  }

  /**
   * Record an email open event.
   */
  async recordOpen(leadId: string, emailStepId: string): Promise<void> {
    this.log.info({ leadId, emailStepId }, 'Recording email open');

    try {
      await prisma.leadEvent.create({
        data: {
          leadId,
          type: 'EMAIL_OPENED',
          metadata: {
            emailStepId,
            openedAt: new Date().toISOString(),
          },
        },
      });

      // Update lead status if still at CONTACTED
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { status: true },
      });

      if (lead && lead.status === 'CONTACTED') {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: 'OPENED' },
        });
      }

      this.log.info({ leadId, emailStepId }, 'Email open recorded');
    } catch (err) {
      this.log.error({ err, leadId, emailStepId }, 'Failed to record email open');
    }
  }

  /**
   * Record a link click event and redirect to the original URL.
   */
  async recordClick(leadId: string, url: string): Promise<void> {
    this.log.info({ leadId, url }, 'Recording link click');

    try {
      await prisma.leadEvent.create({
        data: {
          leadId,
          type: 'LINK_CLICKED',
          metadata: {
            url,
            clickedAt: new Date().toISOString(),
          },
        },
      });

      // Update lead status if not already past CLICKED
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { status: true },
      });

      const earlyStatuses = ['NEW', 'CONTACTED', 'OPENED'];
      if (lead && earlyStatuses.includes(lead.status)) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: 'CLICKED' },
        });
      }

      this.log.info({ leadId, url }, 'Link click recorded');
    } catch (err) {
      this.log.error({ err, leadId, url }, 'Failed to record link click');
    }
  }
}
