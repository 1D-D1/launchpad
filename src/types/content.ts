/**
 * Content-related types for the content management system.
 */

export type ContentType =
  | 'SOCIAL_POST'
  | 'AD_COPY'
  | 'EMAIL'
  | 'LANDING_PAGE'
  | 'BLOG_POST';

export type Platform =
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'LINKEDIN'
  | 'TWITTER'
  | 'GOOGLE'
  | 'EMAIL';

export type ContentStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED';

/** Content item with its optional A/B variant */
export interface ContentWithVariant {
  id: string;
  projectId: string;
  type: ContentType;
  platform: Platform | null;
  title: string | null;
  body: string;
  bodyVariantB: string | null;
  visualPrompt: string | null;
  visualUrl: string | null;
  status: ContentStatus;
  metrics: ContentMetrics | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentMetrics {
  impressions?: number;
  reach?: number;
  engagement?: number;
  clicks?: number;
  shares?: number;
  comments?: number;
  likes?: number;
}

/** Filters for querying content lists */
export interface ContentFilter {
  projectId: string;
  type?: ContentType;
  platform?: Platform;
  status?: ContentStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

/** Batch content generation request */
export interface ContentBatchRequest {
  projectId: string;
  types: ContentType[];
  platforms: Platform[];
  count: number;
  tone?: string;
  language?: string;
}

/** Content calendar entry */
export interface ContentCalendarEntry {
  id: string;
  title: string | null;
  type: ContentType;
  platform: Platform | null;
  status: ContentStatus;
  scheduledAt: Date | null;
}
