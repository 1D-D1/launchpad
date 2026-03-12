'use client';

import { useState, useCallback } from 'react';
import MetricCard from '@/components/shared/metric-card';
import StatusBadge from '@/components/shared/status-badge';
import LineChartComponent from '@/components/charts/line-chart';
import PieChartComponent from '@/components/charts/pie-chart';
import BarChartComponent from '@/components/charts/bar-chart';

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: 'active' | 'paused' | 'ended';
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  roas: number;
  project: string;
  projectId?: string;
}

const campaigns: Campaign[] = [
  { id: '1', name: 'Lead Gen - Decision Makers', platform: 'Meta', status: 'active', spend: 620, impressions: 45200, clicks: 1085, conversions: 42, ctr: 2.4, roas: 3.2, project: 'SaaS Growth', projectId: 'demo-project-1' },
  { id: '2', name: 'Brand Awareness - SMB', platform: 'Meta', status: 'active', spend: 380, impressions: 89100, clicks: 1247, conversions: 18, ctr: 1.4, roas: 2.1, project: 'SaaS Growth', projectId: 'demo-project-1' },
  { id: '3', name: 'Search - Marketing Automation', platform: 'Google', status: 'active', spend: 420, impressions: 28100, clicks: 1152, conversions: 67, ctr: 4.1, roas: 4.5, project: 'SaaS Growth', projectId: 'demo-project-1' },
  { id: '4', name: 'Holiday Sale - Retargeting', platform: 'Meta', status: 'paused', spend: 1200, impressions: 125000, clicks: 3750, conversions: 189, ctr: 3.0, roas: 5.8, project: 'E-commerce Holiday', projectId: 'demo-project-2' },
  { id: '5', name: 'Shopping Ads - Bestsellers', platform: 'Google', status: 'ended', spend: 800, impressions: 52000, clicks: 2600, conversions: 104, ctr: 5.0, roas: 6.2, project: 'E-commerce Holiday', projectId: 'demo-project-2' },
];

const performanceOverTime = [
  { name: 'Week 1', cpc: 1.2, ctr: 2.1, conversions: 18 },
  { name: 'Week 2', cpc: 1.05, ctr: 2.4, conversions: 24 },
  { name: 'Week 3', cpc: 0.98, ctr: 2.8, conversions: 31 },
  { name: 'Week 4', cpc: 0.92, ctr: 3.1, conversions: 38 },
  { name: 'Week 5', cpc: 0.88, ctr: 3.4, conversions: 42 },
  { name: 'Week 6', cpc: 0.82, ctr: 3.6, conversions: 48 },
  { name: 'Week 7', cpc: 0.78, ctr: 3.9, conversions: 52 },
  { name: 'Week 8', cpc: 0.75, ctr: 4.1, conversions: 56 },
];

const budgetDistribution = [
  { name: 'Meta - Lead Gen', value: 620 },
  { name: 'Meta - Brand', value: 380 },
  { name: 'Google - Search', value: 420 },
  { name: 'Meta - Retargeting', value: 1200 },
  { name: 'Google - Shopping', value: 800 },
];

const campaignComparison = [
  { name: 'Lead Gen', spend: 620, conversions: 42, roas: 3.2 },
  { name: 'Brand', spend: 380, conversions: 18, roas: 2.1 },
  { name: 'Search', spend: 420, conversions: 67, roas: 4.5 },
  { name: 'Retarget', spend: 1200, conversions: 189, roas: 5.8 },
  { name: 'Shopping', spend: 800, conversions: 104, roas: 6.2 },
];

export default function AdsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'ended'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [exporting, setExporting] = useState<string | null>(null);

  const filtered = campaigns.filter(
    (c) => statusFilter === 'all' || c.status === statusFilter
  );

  const totalSpend = campaigns.filter((c) => c.status === 'active').reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.filter((c) => c.status === 'active').reduce((s, c) => s + c.impressions, 0);
  const totalConversions = campaigns.filter((c) => c.status === 'active').reduce((s, c) => s + c.conversions, 0);
  const avgRoas = campaigns.filter((c) => c.status === 'active').reduce((s, c) => s + c.roas, 0) / campaigns.filter((c) => c.status === 'active').length;

  const uniqueProjects = Array.from(new Set(campaigns.map((c) => c.project)));

  const handleExport = useCallback(async (type: 'meta-ads' | 'google-ads' | 'ads-brief') => {
    const projectId = selectedProject !== 'all'
      ? selectedProject
      : campaigns[0]?.projectId;
    if (!projectId) return;

    setExporting(type);
    try {
      const response = await fetch(`/api/projects/${projectId}/export/${type}`);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `export-${type}.${type === 'ads-brief' ? 'json' : 'csv'}`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert(`Failed to export ${type}. Please try again.`);
    } finally {
      setExporting(null);
    }
  }, [selectedProject]);

  function toggleCampaign(id: string) {
    alert(`Toggle campaign ${id} (wire to API)`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Ads</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your ad campaigns across platforms</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <span className="text-sm font-medium text-zinc-400">Export:</span>

        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">All Projects</option>
          {uniqueProjects.map((p) => (
            <option key={p} value={campaigns.find((c) => c.project === p)?.projectId ?? p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={() => handleExport('meta-ads')}
          disabled={exporting !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DownloadIcon />
          {exporting === 'meta-ads' ? 'Exporting...' : 'Export for Meta Ads Manager'}
        </button>

        <button
          onClick={() => handleExport('google-ads')}
          disabled={exporting !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DownloadIcon />
          {exporting === 'google-ads' ? 'Exporting...' : 'Export for Google Ads Editor'}
        </button>

        <button
          onClick={() => handleExport('ads-brief')}
          disabled={exporting !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DownloadIcon />
          {exporting === 'ads-brief' ? 'Exporting...' : 'Download Ads Brief'}
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Spend" value={`$${totalSpend.toLocaleString()}`} trend={{ value: 12, isPositive: true }} />
        <MetricCard label="Impressions" value={totalImpressions.toLocaleString()} trend={{ value: 18, isPositive: true }} />
        <MetricCard label="Conversions" value={totalConversions} trend={{ value: 24, isPositive: true }} />
        <MetricCard label="Avg. ROAS" value={`${avgRoas.toFixed(1)}x`} trend={{ value: 8, isPositive: true }} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Performance Over Time</h2>
          <LineChartComponent
            data={performanceOverTime}
            series={[
              { dataKey: 'ctr', name: 'CTR %', color: '#3b82f6' },
              { dataKey: 'cpc', name: 'CPC $', color: '#f59e0b', dashed: true },
            ]}
            height={260}
          />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Budget Distribution</h2>
          <PieChartComponent data={budgetDistribution} height={260} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Campaign Comparison</h2>
        <BarChartComponent
          data={campaignComparison}
          series={[
            { dataKey: 'spend', name: 'Spend ($)', color: '#ef4444' },
            { dataKey: 'conversions', name: 'Conversions', color: '#10b981' },
          ]}
          height={280}
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'active', 'paused', 'ended'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((campaign) => (
          <div
            key={campaign.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-white">{campaign.name}</h3>
                <p className="text-xs text-zinc-500">
                  {campaign.platform} &middot; {campaign.project}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  variant={
                    campaign.status === 'active'
                      ? 'success'
                      : campaign.status === 'paused'
                      ? 'warning'
                      : 'neutral'
                  }
                />
                {campaign.status !== 'ended' && (
                  <button
                    onClick={() => toggleCampaign(campaign.id)}
                    className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                    title={campaign.status === 'active' ? 'Pause' : 'Resume'}
                  >
                    {campaign.status === 'active' ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Spend</span>
                <span className="text-zinc-300">${campaign.spend.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Impressions</span>
                <span className="text-zinc-300">{campaign.impressions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">CTR</span>
                <span className="text-zinc-300">{campaign.ctr}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ROAS</span>
                <span className="text-emerald-400">{campaign.roas}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Clicks</span>
                <span className="text-zinc-300">{campaign.clicks.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Conversions</span>
                <span className="text-zinc-300">{campaign.conversions}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
