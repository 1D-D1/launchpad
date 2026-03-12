'use client';

import MetricCard from '@/components/shared/metric-card';
import ExportToolbar from '@/components/shared/export-toolbar';
import PieChartComponent from '@/components/charts/pie-chart';
import LineChartComponent from '@/components/charts/line-chart';
import BarChartComponent from '@/components/charts/bar-chart';
import FunnelChartComponent from '@/components/charts/funnel-chart';

const metrics = [
  { label: 'Total Impressions', value: '284K', trend: { value: 18, isPositive: true } },
  { label: 'Total Clicks', value: '12,340', trend: { value: 24, isPositive: true } },
  { label: 'Avg. CTR', value: '4.3%', trend: { value: 0.8, isPositive: true } },
  { label: 'Conversions', value: '342', trend: { value: 12, isPositive: true } },
  { label: 'Cost per Lead', value: '$14.20', trend: { value: -8, isPositive: true } },
  { label: 'ROAS', value: '3.8x', trend: { value: 15, isPositive: true } },
  { label: 'Email Open Rate', value: '38%', trend: { value: 2.1, isPositive: true } },
  { label: 'Revenue', value: '$24,580', trend: { value: 32, isPositive: true } },
];

const trafficSources = [
  { name: 'Organic Search', value: 38 },
  { name: 'Paid Ads', value: 28 },
  { name: 'Social Media', value: 18 },
  { name: 'Email', value: 10 },
  { name: 'Direct', value: 6 },
];

const engagementData = [
  { name: 'Jan', likes: 1200, comments: 340, shares: 180, clicks: 2800 },
  { name: 'Feb', likes: 1450, comments: 420, shares: 210, clicks: 3100 },
  { name: 'Mar', likes: 1680, comments: 380, shares: 260, clicks: 3400 },
  { name: 'Apr', likes: 1320, comments: 510, shares: 290, clicks: 2900 },
  { name: 'May', likes: 1900, comments: 480, shares: 320, clicks: 3800 },
  { name: 'Jun', likes: 2100, comments: 560, shares: 380, clicks: 4200 },
  { name: 'Jul', likes: 2400, comments: 620, shares: 410, clicks: 4600 },
];

const conversionFunnel = [
  { name: 'Visitors', count: 48200 },
  { name: 'Engaged', count: 18400 },
  { name: 'Leads', count: 4820 },
  { name: 'Qualified', count: 1240 },
  { name: 'Converted', count: 342 },
];

const platformComparison = [
  { name: 'Meta', impressions: 89000, clicks: 4200, conversions: 142 },
  { name: 'Google', impressions: 62000, clicks: 5100, conversions: 118 },
  { name: 'LinkedIn', impressions: 28000, clicks: 1400, conversions: 48 },
  { name: 'Twitter', impressions: 45000, clicks: 1640, conversions: 34 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-400">Performance overview across all projects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors first:bg-zinc-800 first:text-white"
              >
                {range}
              </button>
            ))}
          </div>
          <ExportToolbar projectId="current" pdfType="analytics" />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} trend={m.trend} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Traffic Sources</h2>
          <PieChartComponent data={trafficSources} height={280} />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Engagement Over Time</h2>
          <LineChartComponent
            data={engagementData}
            series={[
              { dataKey: 'likes', name: 'Likes', color: '#3b82f6' },
              { dataKey: 'comments', name: 'Comments', color: '#10b981' },
              { dataKey: 'shares', name: 'Shares', color: '#f59e0b' },
              { dataKey: 'clicks', name: 'Clicks', color: '#8b5cf6' },
            ]}
            height={280}
          />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Conversion Funnel</h2>
          <FunnelChartComponent data={conversionFunnel} height={280} />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Platform Comparison</h2>
          <BarChartComponent
            data={platformComparison}
            series={[
              { dataKey: 'clicks', name: 'Clicks', color: '#3b82f6' },
              { dataKey: 'conversions', name: 'Conversions', color: '#10b981' },
            ]}
            height={280}
          />
        </div>
      </div>
    </div>
  );
}
