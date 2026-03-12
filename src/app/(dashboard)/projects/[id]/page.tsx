'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { clsx } from 'clsx';
import StatusBadge, { statusToVariant } from '@/components/shared/status-badge';
import PipelineStepper from '@/components/shared/pipeline-stepper';
import MetricCard from '@/components/shared/metric-card';
import { trpc } from '@/lib/trpc';
import { PIPELINE_STAGES } from '@/types/pipeline';
import type { PipelineStatus } from '@/types/pipeline';

const TABS = ['Overview', 'Strategy', 'Content', 'Ads', 'Emails', 'Revenue'] as const;

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-72 animate-pulse rounded-lg bg-zinc-800" />
      <div className="h-6 w-48 animate-pulse rounded bg-zinc-800" />
      <div className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        ))}
      </div>
    </div>
  );
}

function derivePipelineSteps(pipelineStatus: unknown): { label: string; status: PipelineStatus }[] {
  const ps = (pipelineStatus ?? {}) as Record<string, string>;
  return PIPELINE_STAGES.map((stage) => {
    const stageStatus = ps[stage.key];
    let status: PipelineStatus = 'PENDING';
    if (stageStatus === 'COMPLETED' || stageStatus === 'RUNNING' || stageStatus === 'FAILED' || stageStatus === 'SKIPPED') {
      status = stageStatus;
    }
    return { label: stage.label, status };
  });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview');

  const projectQuery = trpc.project.getById.useQuery({ id });
  const metricsQuery = trpc.analytics.getProjectMetrics.useQuery(
    { projectId: id },
    { enabled: !!id },
  );
  const contentQuery = trpc.content.listByProject.useQuery(
    { projectId: id, limit: 20 },
    { enabled: activeTab === 'Content' },
  );

  if (projectQuery.isLoading) return <PageSkeleton />;

  if (projectQuery.error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-red-400">
            {projectQuery.error.data?.code === 'NOT_FOUND'
              ? 'Project not found'
              : 'Failed to load project'}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{projectQuery.error.message}</p>
        </div>
      </div>
    );
  }

  const project = projectQuery.data as any;
  if (!project) return null;

  const budget = project.budget as { total?: number; currency?: string } | null;
  const pipelineSteps = derivePipelineSteps(project.pipelineStatus);
  const metrics = metricsQuery.data;

  const contentStatusConfig: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'info' }> = {
    DRAFT: { label: 'Draft', variant: 'neutral' },
    PENDING_REVIEW: { label: 'Pending Review', variant: 'warning' },
    APPROVED: { label: 'Approved', variant: 'success' },
    SCHEDULED: { label: 'Scheduled', variant: 'info' },
    PUBLISHED: { label: 'Published', variant: 'info' },
    FAILED: { label: 'Failed', variant: 'neutral' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <StatusBadge
              label={project.status.replace(/_/g, ' ')}
              variant={statusToVariant(project.status)}
              size="md"
            />
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {project.vertical} &middot; ${(budget?.total ?? 0).toLocaleString()} {budget?.currency ?? 'USD'} &middot; Created{' '}
            {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
            Edit
          </button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            Run Pipeline
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {/* Pipeline */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Pipeline Progress</h2>
            <PipelineStepper steps={pipelineSteps} />
          </div>

          {/* Metrics */}
          {metricsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
              ))}
            </div>
          ) : metrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Content Pieces" value={metrics.content.total} />
              <MetricCard label="Ad Spend" value={`$${metrics.ads.metrics.spend.toLocaleString()}`} />
              <MetricCard label="Leads Generated" value={metrics.email.totalLeads} />
              <MetricCard label="Revenue" value={`$${metrics.revenue.toLocaleString()}`} />
            </div>
          ) : null}

          {/* Description */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-2 text-lg font-semibold text-white">Description</h2>
            <p className="text-sm text-zinc-400">{project.description}</p>
          </div>
        </div>
      )}

      {activeTab === 'Strategy' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Marketing Strategy</h2>
          {project.strategies && project.strategies.length > 0 ? (
            <div className="space-y-4">
              {project.strategies.map((strategy: any) => (
                <div key={strategy.id} className="space-y-4">
                  {strategy.positioning && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                      <h3 className="text-sm font-medium text-blue-400">Positioning</h3>
                      <p className="mt-1 text-sm text-zinc-300">{strategy.positioning}</p>
                    </div>
                  )}
                  {strategy.channels && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                      <h3 className="text-sm font-medium text-blue-400">Channels</h3>
                      <p className="mt-1 text-sm text-zinc-300">
                        Strategy generated. Click to view channel details.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-zinc-500">
                    Generated {new Date(strategy.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
              No strategy generated yet. Submit the project to start the AI pipeline.
            </div>
          )}
        </div>
      )}

      {activeTab === 'Content' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Generated Content</h2>
            <span className="text-sm text-zinc-500">
              {contentQuery.data?.contents.length ?? 0} items
            </span>
          </div>
          {contentQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
              ))}
            </div>
          ) : contentQuery.data?.contents.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
              No content generated yet.
            </div>
          ) : (
            (contentQuery.data?.contents as any[])?.map((item: any) => {
              const sc = contentStatusConfig[item.status] ?? { label: item.status, variant: 'neutral' as const };
              return (
                <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge label={item.type.replace(/_/g, ' ')} variant="info" />
                    {item.platform && <StatusBadge label={item.platform} variant="neutral" />}
                    <StatusBadge label={sc.label} variant={sc.variant} />
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {item.title || item.body}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'Ads' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Ad Campaigns</h2>
          {project.campaigns && project.campaigns.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {project.campaigns.map((campaign: any) => {
                const m = campaign.metrics as Record<string, number> | null;
                return (
                  <div key={campaign.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-white">{campaign.name}</h3>
                      <StatusBadge label={campaign.status} variant={campaign.status === 'ACTIVE' ? 'success' : 'neutral'} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-zinc-500">Budget:</span> <span className="text-zinc-300">${campaign.budget.toLocaleString()}</span></div>
                      <div><span className="text-zinc-500">Platform:</span> <span className="text-zinc-300">{campaign.platform}</span></div>
                      {m && (
                        <>
                          <div><span className="text-zinc-500">Impressions:</span> <span className="text-zinc-300">{(m.impressions ?? 0).toLocaleString()}</span></div>
                          <div><span className="text-zinc-500">Clicks:</span> <span className="text-zinc-300">{(m.clicks ?? 0).toLocaleString()}</span></div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
              No ad campaigns set up yet.
            </div>
          )}
        </div>
      )}

      {activeTab === 'Emails' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Email Sequences</h2>
          {project.emailSequences && project.emailSequences.length > 0 ? (
            project.emailSequences.map((sequence: any) => (
              <div key={sequence.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h3 className="font-medium text-white mb-3">
                  {sequence.name} ({sequence._count.steps} emails)
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold text-white">{sequence._count.leads}</p>
                    <p className="text-xs text-zinc-500">Leads</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-white">{sequence._count.steps}</p>
                    <p className="text-xs text-zinc-500">Steps</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
              No email sequences set up yet.
            </div>
          )}
        </div>
      )}

      {activeTab === 'Revenue' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Revenue Attribution</h2>
          {metricsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
              ))}
            </div>
          ) : metrics ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Total Revenue" value={`$${metrics.revenue.toLocaleString()}`} />
              <MetricCard label="Total Ad Spend" value={`$${metrics.ads.metrics.spend.toLocaleString()}`} />
              <MetricCard
                label="ROI"
                value={
                  metrics.ads.metrics.spend > 0
                    ? `${Math.round(((metrics.revenue - metrics.ads.metrics.spend) / metrics.ads.metrics.spend) * 100)}%`
                    : 'N/A'
                }
              />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
              No revenue data available yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
