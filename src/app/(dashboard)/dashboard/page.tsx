'use client';

import Link from 'next/link';
import MetricCard from '@/components/shared/metric-card';
import StatusBadge, { statusToVariant } from '@/components/shared/status-badge';
import AreaChartComponent from '@/components/charts/area-chart';
import BarChartComponent from '@/components/charts/bar-chart';
import PieChartComponent from '@/components/charts/pie-chart';
import ExportToolbar from '@/components/shared/export-toolbar';
import { trpc } from '@/lib/trpc';

// Mock data for charts (will be replaced by API data)
const revenueVsExpenses = [
  { name: 'Jan', value: 4200, value2: 2800 },
  { name: 'Feb', value: 5100, value2: 3100 },
  { name: 'Mar', value: 6400, value2: 3400 },
  { name: 'Apr', value: 5800, value2: 3200 },
  { name: 'May', value: 7200, value2: 3600 },
  { name: 'Jun', value: 8100, value2: 3900 },
  { name: 'Jul', value: 9400, value2: 4100 },
  { name: 'Aug', value: 8800, value2: 4300 },
];

const postsPerWeek = [
  { name: 'W1', facebook: 5, instagram: 8, linkedin: 3, twitter: 12 },
  { name: 'W2', facebook: 7, instagram: 10, linkedin: 4, twitter: 9 },
  { name: 'W3', facebook: 4, instagram: 6, linkedin: 5, twitter: 11 },
  { name: 'W4', facebook: 8, instagram: 12, linkedin: 3, twitter: 14 },
  { name: 'W5', facebook: 6, instagram: 9, linkedin: 6, twitter: 10 },
  { name: 'W6', facebook: 9, instagram: 11, linkedin: 4, twitter: 13 },
];

const channelDistribution = [
  { name: 'Meta Ads', value: 35 },
  { name: 'Google Ads', value: 28 },
  { name: 'Email', value: 18 },
  { name: 'Social Organic', value: 12 },
  { name: 'SEO', value: 7 },
];

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      ))}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-zinc-800 bg-zinc-800/30" />
      ))}
    </div>
  );
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function DashboardPage() {
  const statsQuery = trpc.analytics.getDashboardStats.useQuery();
  const projectsQuery = trpc.project.list.useQuery({ limit: 5 });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Welcome back. Here is what is happening with your projects.</p>
        </div>
        {projectsQuery.data?.projects?.[0]?.id && (
          <ExportToolbar projectId={projectsQuery.data.projects[0].id} />
        )}
      </div>

      {/* Metrics */}
      {statsQuery.isLoading ? (
        <MetricsSkeleton />
      ) : statsQuery.error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          Failed to load dashboard stats. Please try refreshing the page.
        </div>
      ) : statsQuery.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Active Projects"
            value={statsQuery.data.projects.active}
          />
          <MetricCard
            label="Total Revenue"
            value={formatCurrency(statsQuery.data.revenue.total)}
          />
          <MetricCard
            label="Published Content"
            value={statsQuery.data.content.published}
          />
          <MetricCard
            label="Total Leads"
            value={statsQuery.data.email.totalLeads}
          />
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Revenue vs Expenses</h2>
          <AreaChartComponent
            data={revenueVsExpenses}
            color="#3b82f6"
            color2="#ef4444"
            label="Revenue"
            label2="Expenses"
            height={280}
          />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Posts Published per Week</h2>
          <BarChartComponent
            data={postsPerWeek}
            series={[
              { dataKey: 'facebook', name: 'Facebook', color: '#3b82f6' },
              { dataKey: 'instagram', name: 'Instagram', color: '#ec4899' },
              { dataKey: 'linkedin', name: 'LinkedIn', color: '#6366f1' },
              { dataKey: 'twitter', name: 'Twitter', color: '#06b6d4' },
            ]}
            height={280}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Channel Distribution */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Channel Distribution</h2>
          <PieChartComponent data={channelDistribution} height={280} />
        </div>

        {/* Recent Projects */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
            <Link href="/projects" className="text-sm text-blue-400 hover:text-blue-300">
              View all
            </Link>
          </div>
          {projectsQuery.isLoading ? (
            <ProjectsSkeleton />
          ) : projectsQuery.error ? (
            <p className="text-sm text-red-400">Failed to load projects.</p>
          ) : projectsQuery.data?.projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-zinc-500">No projects yet.</p>
              <Link
                href="/projects/new"
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Create your first project
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(projectsQuery.data?.projects as any[])?.map((project: any) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3 hover:bg-zinc-800/60 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{project.name}</p>
                    <p className="text-xs text-zinc-500">
                      {project.vertical} &middot; {timeAgo(project.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge label={project.status.replace(/_/g, ' ')} variant={statusToVariant(project.status)} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
