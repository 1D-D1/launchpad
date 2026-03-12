'use client';

import { useState } from 'react';
import Link from 'next/link';
import StatusBadge, { statusToVariant } from '@/components/shared/status-badge';
import { trpc } from '@/lib/trpc';

const statuses = ['ALL', 'DRAFT', 'ACTIVE', 'ANALYZING', 'GENERATING_CONTENT', 'PUBLISHING', 'COMPLETED'] as const;

function TableSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded bg-zinc-800/40" />
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const statusInput = filterStatus === 'ALL' ? undefined : filterStatus as Parameters<typeof trpc.project.list.useQuery>[0] extends { status?: infer S } ? S : never;
  const projectsQuery = trpc.project.list.useQuery(
    { status: statusInput, limit: 100 },
  );

  const utils = trpc.useUtils();

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
    },
  });

  const createMutation = trpc.project.create.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
    },
  });

  const projects: any[] = projectsQuery.data?.projects ?? [];
  const filtered = projects.filter((p: any) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleDuplicate(project: any) {
    const budget = project.budget as { total?: number; currency?: string; allocation?: Record<string, number> } | null;
    const targetAudience = project.targetAudience as { demographics?: string; interests?: string[]; location?: string; ageRange?: string } | null;
    const objectives = project.objectives as { primary?: string; secondary?: string[]; kpis?: string[] } | null;
    const competitors = project.competitors as { name: string; url?: string }[] | null;

    createMutation.mutate({
      name: `${project.name} (Copy)`,
      description: project.description,
      vertical: project.vertical,
      budget: {
        total: budget?.total ?? 0,
        currency: budget?.currency ?? 'USD',
        allocation: budget?.allocation,
      },
      targetAudience: {
        demographics: targetAudience?.demographics,
        interests: targetAudience?.interests,
        location: targetAudience?.location,
        ageRange: targetAudience?.ageRange,
      },
      objectives: {
        primary: objectives?.primary ?? '',
        secondary: objectives?.secondary,
        kpis: objectives?.kpis,
      },
      competitors: competitors ?? [],
    });
  }

  function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteMutation.mutate({ id });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {projectsQuery.isLoading ? '...' : `${filtered.length} projects`}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {projectsQuery.isLoading ? (
        <div className="rounded-xl border border-zinc-800 p-4">
          <TableSkeleton />
        </div>
      ) : projectsQuery.error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-sm text-red-400">
          Failed to load projects. Please try refreshing the page.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Vertical</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Content</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">Created</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((project) => (
                <tr key={project.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${project.id}`} className="font-medium text-white hover:text-blue-400">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={project.status.replace(/_/g, ' ')}
                      variant={statusToVariant(project.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{project.vertical}</td>
                  <td className="px-4 py-3 text-zinc-300">{project._count.contents} items</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDuplicate(project)}
                        disabled={createMutation.isPending}
                        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        disabled={deleteMutation.isPending}
                        className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    {projects.length === 0
                      ? 'No projects yet. Create your first project to get started.'
                      : 'No projects found matching your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
