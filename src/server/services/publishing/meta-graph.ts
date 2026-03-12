/**
 * Meta Graph API integration service.
 * Handles Facebook/Instagram page posting, post retrieval, and insights.
 */

import { logger } from '@/lib/logger';

export interface MetaPost {
  id: string;
  message: string;
  createdTime: string;
  permalink: string | null;
}

export interface MetaInsights {
  postId: string;
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  reactions: number;
  comments: number;
  shares: number;
}

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export class MetaGraphService {
  private readonly accessToken: string;
  private readonly log = logger.child({ service: 'MetaGraphService' });

  constructor() {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        'META_ACCESS_TOKEN is not configured. ' +
          'Create a Meta App at https://developers.facebook.com, ' +
          'generate a page access token with pages_manage_posts and pages_read_engagement permissions, ' +
          'and set the META_ACCESS_TOKEN environment variable.',
      );
    }
    this.accessToken = token;
  }

  /**
   * Publish a post to a Facebook page.
   */
  async publishPost(
    pageId: string,
    message: string,
    imageUrl?: string,
  ): Promise<{ id: string }> {
    this.log.info({ pageId, hasImage: !!imageUrl }, 'Publishing post to Facebook page');

    let endpoint: string;
    let body: Record<string, string>;

    if (imageUrl) {
      endpoint = `${GRAPH_API_BASE}/${pageId}/photos`;
      body = {
        message,
        url: imageUrl,
        access_token: this.accessToken,
      };
    } else {
      endpoint = `${GRAPH_API_BASE}/${pageId}/feed`;
      body = {
        message,
        access_token: this.accessToken,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      this.log.error({ pageId, error }, 'Failed to publish post');
      throw new Error(
        `Meta Graph API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`,
      );
    }

    const data = (await response.json()) as { id: string };
    this.log.info({ postId: data.id, pageId }, 'Post published successfully');
    return { id: data.id };
  }

  /**
   * Get recent posts from a Facebook page.
   */
  async getPagePosts(pageId: string, limit: number = 25): Promise<MetaPost[]> {
    this.log.debug({ pageId, limit }, 'Fetching page posts');

    const params = new URLSearchParams({
      fields: 'id,message,created_time,permalink_url',
      limit: String(limit),
      access_token: this.accessToken,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}/feed?${params.toString()}`,
    );

    if (!response.ok) {
      const error = await response.json();
      this.log.error({ pageId, error }, 'Failed to fetch page posts');
      throw new Error(
        `Meta Graph API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      data: { id: string; message?: string; created_time: string; permalink_url?: string }[];
    };

    const posts: MetaPost[] = (data.data || []).map((post) => ({
      id: post.id,
      message: post.message || '',
      createdTime: post.created_time,
      permalink: post.permalink_url || null,
    }));

    this.log.info({ pageId, count: posts.length }, 'Page posts retrieved');
    return posts;
  }

  /**
   * Get insights/metrics for a specific post.
   */
  async getPostInsights(postId: string): Promise<MetaInsights> {
    this.log.debug({ postId }, 'Fetching post insights');

    const metrics = [
      'post_impressions',
      'post_impressions_unique',
      'post_engaged_users',
      'post_clicks',
      'post_reactions_like_total',
    ].join(',');

    const params = new URLSearchParams({
      metric: metrics,
      access_token: this.accessToken,
    });

    const response = await fetch(
      `${GRAPH_API_BASE}/${postId}/insights?${params.toString()}`,
    );

    if (!response.ok) {
      const error = await response.json();
      this.log.error({ postId, error }, 'Failed to fetch post insights');
      throw new Error(
        `Meta Graph API error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      data: { name: string; values: { value: number }[] }[];
    };

    const metricsMap = new Map<string, number>();
    for (const item of data.data || []) {
      const value = item.values?.[0]?.value ?? 0;
      metricsMap.set(item.name, value);
    }

    const insights: MetaInsights = {
      postId,
      impressions: metricsMap.get('post_impressions') || 0,
      reach: metricsMap.get('post_impressions_unique') || 0,
      engagement: metricsMap.get('post_engaged_users') || 0,
      clicks: metricsMap.get('post_clicks') || 0,
      reactions: metricsMap.get('post_reactions_like_total') || 0,
      comments: 0,
      shares: 0,
    };

    this.log.info({ postId, impressions: insights.impressions }, 'Post insights retrieved');
    return insights;
  }
}
