/**
 * Analytics and dashboard types for the reporting system.
 */

/** Top-level dashboard statistics shown on the main dashboard */
export interface DashboardStats {
  projects: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  content: {
    total: number;
    published: number;
    byStatus: Record<string, number>;
  };
  ads: {
    totalCampaigns: number;
    totalBudget: number;
  };
  email: {
    totalLeads: number;
  };
  revenue: {
    total: number;
  };
  recentProjects: RecentProject[];
}

export interface RecentProject {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  _count: {
    contents: number;
    campaigns: number;
  };
}

/** Per-project metrics aggregation */
export interface ProjectMetrics {
  projectId: string;
  projectStatus: string;
  content: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  ads: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalBudget: number;
    metrics: CampaignAggregateMetrics;
    ctr: number;
  };
  email: {
    totalSequences: number;
    totalLeads: number;
  };
  revenue: number;
}

export interface CampaignAggregateMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

/** Per-channel (platform) metrics breakdown */
export interface ChannelMetrics {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  contentCount: number;
  campaignCount: number;
}

/** Time-series data point for charts */
export interface MetricDataPoint {
  date: string;
  value: number;
}

/** Comparison between two time periods */
export interface MetricComparison {
  current: number;
  previous: number;
  changePercent: number;
  trend: 'up' | 'down' | 'flat';
}
