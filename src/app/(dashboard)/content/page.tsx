'use client';

import { useState } from 'react';
import StatusBadge from '@/components/shared/status-badge';
import { trpc } from '@/lib/trpc';

type ContentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';

const statusConfig: Record<ContentStatus, { label: string; variant: 'neutral' | 'warning' | 'success' | 'info' }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  PENDING_REVIEW: { label: 'Pending Review', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  PUBLISHED: { label: 'Published', variant: 'info' },
  FAILED: { label: 'Failed', variant: 'neutral' },
};

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      ))}
    </div>
  );
}

export default function ContentPage() {
  const [filterStatus, setFilterStatus] = useState<ContentStatus | 'all'>('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Get all projects so we can list content across them
  const projectsQuery = trpc.project.list.useQuery({ limit: 100 });
  const projects = projectsQuery.data?.projects ?? [];

  // Pick the first project for now; in a full app, you'd aggregate or query without projectId
  const firstProjectId = projects[0]?.id;

  const statusInput = filterStatus === 'all' ? undefined : filterStatus;
  const typeInput = filterType === 'all' ? undefined : filterType as 'SOCIAL_POST' | 'AD_COPY' | 'EMAIL' | 'LANDING_PAGE' | 'BLOG_POST';

  const contentQuery = trpc.content.listByProject.useQuery(
    {
      projectId: firstProjectId ?? '',
      status: statusInput,
      type: typeInput,
      limit: 100,
    },
    { enabled: !!firstProjectId },
  );

  const utils = trpc.useUtils();

  const approveMutation = trpc.content.approve.useMutation({
    onSuccess: () => {
      if (firstProjectId) {
        utils.content.listByProject.invalidate({ projectId: firstProjectId });
      }
    },
  });

  const bulkApproveMutation = trpc.content.bulkApprove.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      if (firstProjectId) {
        utils.content.listByProject.invalidate({ projectId: firstProjectId });
      }
    },
  });

  const contentItems = (contentQuery.data?.contents ?? []) as unknown as Array<{
    id: string;
    type: string;
    platform: string | null;
    status: string;
    title: string | null;
    body: string;
    createdAt: string;
  }>;
  const uniqueTypes: string[] = [];
  for (const item of contentItems) {
    if (!uniqueTypes.includes(item.type)) uniqueTypes.push(item.type);
  }
  const types: string[] = ['all', ...uniqueTypes];

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkApproveMutation.mutate({ ids });
  }

  const pendingSelected = Array.from(selectedIds).filter((id) => {
    const item = contentItems.find((c) => c.id === id);
    return item && ['DRAFT', 'PENDING_REVIEW'].includes(item.status);
  });

  const isLoading = projectsQuery.isLoading || contentQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isLoading ? '...' : `${contentItems.length} content items`}
          </p>
        </div>
        {pendingSelected.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproveMutation.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {bulkApproveMutation.isPending
              ? 'Approving...'
              : `Approve Selected (${pendingSelected.length})`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ContentStatus | 'all')}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All Types' : t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <CardsSkeleton />
      ) : projects.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
          No projects yet. Create a project first to generate content.
        </div>
      ) : contentItems.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
          No content items match your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contentItems.map((item) => {
            const sc = statusConfig[item.status as ContentStatus] ?? { label: item.status, variant: 'neutral' as const };
            const isSelected = selectedIds.has(item.id);
            const isApprovable = ['DRAFT', 'PENDING_REVIEW'].includes(item.status);

            return (
              <div
                key={item.id}
                className={`flex flex-col rounded-xl border bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700 ${
                  isSelected ? 'border-blue-500/50' : 'border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {isApprovable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(item.id)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
                    />
                  )}
                  <StatusBadge label={item.type.replace(/_/g, ' ')} variant="info" />
                  {item.platform && <StatusBadge label={item.platform} variant="neutral" />}
                  <StatusBadge label={sc.label} variant={sc.variant} />
                </div>
                <p className="flex-1 text-sm leading-relaxed text-zinc-300 line-clamp-3">
                  {item.title || item.body}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
                  <span className="text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1">
                    {isApprovable && (
                      <button
                        onClick={() => approveMutation.mutate({ id: item.id })}
                        disabled={approveMutation.isPending}
                        className="rounded-md bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    <button className="rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
