/**
 * Vista Social API integration service.
 * Handles social media post scheduling, metrics retrieval, and profile listing.
 */

import { logger } from '@/lib/logger';

export interface PostMetrics {
  postId: string;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface VistaSocialProfile {
  id: string;
  name: string;
  platform: string;
  avatarUrl: string | null;
  connected: boolean;
}

const VISTA_API_BASE = 'https://api.vistasocial.com/v1';

export class VistaSocialService {
  private readonly apiKey: string;
  private readonly log = logger.child({ service: 'VistaSocialService' });

  constructor() {
    const apiKey = process.env.VISTA_SOCIAL_API_KEY;
    if (!apiKey) {
      throw new Error(
        'VISTA_SOCIAL_API_KEY is not configured. ' +
          'To schedule social media posts, sign up at https://vistasocial.com, ' +
          'generate an API key in Settings > API, and set the VISTA_SOCIAL_API_KEY environment variable.',
      );
    }
    this.apiKey = apiKey;
  }

  /**
   * Schedule a post for publishing at the given time.
   */
  async schedulePost(
    profileId: string,
    content: string,
    mediaUrls: string[],
    scheduledTime: Date,
  ): Promise<{ postId: string }> {
    this.log.info(
      { profileId, scheduledTime: scheduledTime.toISOString(), mediaCount: mediaUrls.length },
      'Scheduling post via Vista Social',
    );

    const response = await this.request('POST', '/posts', {
      profile_ids: [profileId],
      text: content,
      media_urls: mediaUrls,
      scheduled_at: scheduledTime.toISOString(),
      status: 'scheduled',
    });

    const postId = (response as { id?: string }).id;
    if (!postId) {
      throw new Error('Vista Social API did not return a post ID');
    }

    this.log.info({ postId, profileId }, 'Post scheduled successfully');
    return { postId };
  }

  /**
   * Retrieve performance metrics for a published post.
   */
  async getPostMetrics(postId: string): Promise<PostMetrics> {
    this.log.debug({ postId }, 'Fetching post metrics');

    const response = await this.request('GET', `/posts/${postId}/metrics`);
    const data = response as Record<string, unknown>;

    return {
      postId,
      impressions: (data.impressions as number) || 0,
      reach: (data.reach as number) || 0,
      engagement: (data.engagement as number) || 0,
      clicks: (data.clicks as number) || 0,
      likes: (data.likes as number) || 0,
      comments: (data.comments as number) || 0,
      shares: (data.shares as number) || 0,
    };
  }

  /**
   * List all connected social media profiles.
   */
  async listProfiles(): Promise<VistaSocialProfile[]> {
    this.log.debug('Listing Vista Social profiles');

    const response = await this.request('GET', '/profiles');
    const items = (response as { data?: Record<string, unknown>[] }).data || [];

    const profiles: VistaSocialProfile[] = items.map((item) => ({
      id: (item.id as string) || '',
      name: (item.name as string) || '',
      platform: (item.platform as string) || '',
      avatarUrl: (item.avatar_url as string) || null,
      connected: (item.connected as boolean) ?? true,
    }));

    this.log.info({ count: profiles.length }, 'Profiles retrieved');
    return profiles;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${VISTA_API_BASE}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.log.error(
        { status: response.status, path, errorBody },
        'Vista Social API error',
      );
      throw new Error(
        `Vista Social API error ${response.status}: ${errorBody}`,
      );
    }

    return response.json();
  }
}
