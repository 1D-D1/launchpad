/**
 * Social profile scraper service.
 * Extracts basic profile data from social media URLs.
 */

import { logger } from '@/lib/logger';

export interface SocialProfileData {
  platform: string;
  username: string;
  url: string;
  followers: number | null;
  postsPerWeek: number | null;
  engagementRate: number | null;
  note: string;
}

const PLATFORM_PATTERNS: Record<string, RegExp> = {
  facebook: /(?:facebook\.com|fb\.com)\/(?:pages\/)?([^/?#]+)/i,
  instagram: /instagram\.com\/([^/?#]+)/i,
  linkedin: /linkedin\.com\/(?:company|in)\/([^/?#]+)/i,
  twitter: /(?:twitter\.com|x\.com)\/([^/?#]+)/i,
  tiktok: /tiktok\.com\/@?([^/?#]+)/i,
  youtube: /youtube\.com\/(?:@|channel\/|c\/)?([^/?#]+)/i,
  pinterest: /pinterest\.com\/([^/?#]+)/i,
};

export class SocialProfileScraper {
  private readonly log = logger.child({ service: 'SocialProfileScraper' });

  /**
   * Extract basic profile data from a social media URL.
   * Full scraping requires platform API access; this returns structural data only.
   */
  async analyzeProfile(
    platform: string,
    url: string,
  ): Promise<SocialProfileData> {
    this.log.info({ platform, url }, 'Analyzing social profile');

    const normalizedPlatform = platform.toLowerCase().trim();
    const username = this.extractUsername(normalizedPlatform, url);

    if (!username) {
      this.log.warn({ platform, url }, 'Could not extract username from URL');
      return {
        platform: normalizedPlatform,
        username: 'unknown',
        url,
        followers: null,
        postsPerWeek: null,
        engagementRate: null,
        note: `Could not parse username from URL. Verify the URL format for ${platform}.`,
      };
    }

    this.log.info(
      { platform: normalizedPlatform, username },
      'Profile data extracted (structural only)',
    );

    return {
      platform: normalizedPlatform,
      username,
      url,
      followers: null,
      postsPerWeek: null,
      engagementRate: null,
      note: `Full metrics require ${this.getApiName(normalizedPlatform)} access. ` +
        `Username "${username}" was extracted from the URL. ` +
        `Configure the appropriate API credentials to retrieve follower counts, posting frequency, and engagement rates.`,
    };
  }

  /**
   * Detect the platform from a URL if not explicitly provided.
   */
  detectPlatform(url: string): string | null {
    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      if (pattern.test(url)) {
        return platform;
      }
    }
    return null;
  }

  private extractUsername(platform: string, url: string): string | null {
    const pattern = PLATFORM_PATTERNS[platform];
    if (pattern) {
      const match = url.match(pattern);
      return match?.[1]?.replace(/^@/, '') || null;
    }

    // Fallback: try to extract the path segment after the domain
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments[0]?.replace(/^@/, '') || null;
    } catch {
      return null;
    }
  }

  private getApiName(platform: string): string {
    const apiNames: Record<string, string> = {
      facebook: 'Meta Graph API',
      instagram: 'Instagram Graph API',
      linkedin: 'LinkedIn API',
      twitter: 'Twitter/X API',
      tiktok: 'TikTok API',
      youtube: 'YouTube Data API',
      pinterest: 'Pinterest API',
    };
    return apiNames[platform] || `${platform} API`;
  }
}
