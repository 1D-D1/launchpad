'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import PieChartComponent from '@/components/charts/pie-chart';
import AreaChartComponent from '@/components/charts/area-chart';

const CHANNEL_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  linkedin_ads: 'LinkedIn Ads',
  twitter_ads: 'Twitter Ads',
  email: 'Email',
  seo: 'SEO',
  social_organic: 'Social Organic',
};

const DEFAULT_CHANNELS = ['meta_ads', 'google_ads', 'email', 'seo', 'social_organic'];

export default function BudgetPage() {
  const params = useParams();
  const projectId = params.id as string;

  const validationQuery = trpc.budget.validateBudget.useQuery({ projectId });
  const breakdownQuery = trpc.budget.getBreakdown.useQuery({ projectId });
  const prelaunchQuery = trpc.budget.prelaunchCheck.useQuery({ projectId });
  const updateAllocation = trpc.budget.updateAllocation.useMutation();
  const approveBudget = trpc.budget.approveBudget.useMutation();
  const utils = trpc.useUtils();

  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);

  const validation = validationQuery.data;
  const breakdown = breakdownQuery.data;
  const prelaunch = prelaunchQuery.data;

  // Initialize sliders from validation data
  const currentAllocation = validation?.breakdown.reduce(
    (acc, b) => ({ ...acc, [b.channel]: b.percentage }),
    {} as Record<string, number>
  ) ?? {};

  const activeSliders = isEditing ? sliders : currentAllocation;
  const totalBudget = validation?.totalBudget ?? 0;

  function startEditing() {
    setSliders({ ...currentAllocation });
    setIsEditing(true);
  }

  function handleSliderChange(channel: string, value: number) {
    setSliders((prev) => ({ ...prev, [channel]: value }));
  }

  async function saveAllocation() {
    await updateAllocation.mutateAsync({ projectId, allocation: sliders });
    setIsEditing(false);
    utils.budget.validateBudget.invalidate({ projectId });
    utils.budget.getBreakdown.invalidate({ projectId });
  }

  async function handleApprove() {
    await approveBudget.mutateAsync({ projectId });
    utils.budget.prelaunchCheck.invalidate({ projectId });
    utils.budget.validateBudget.invalidate({ projectId });
  }

  const totalSliderPercent = Object.values(activeSliders).reduce((s, v) => s + v, 0);

  // Build chart data
  const pieData = Object.entries(activeSliders).map(([ch, pct]) => ({
    name: CHANNEL_LABELS[ch] || ch,
    value: Math.round((totalBudget * pct) / 100),
  }));

  const projectionChartData = breakdown?.months.map((m) => ({
    name: m.label.replace(/Month \d+ \(/, '').replace(')', ''),
    value: m.cumulativeBudget,
    value2: m.cumulativeRevenue,
  })) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Budget Validation</h1>
        <p className="mt-1 text-sm text-zinc-400">Review, validate, and approve your project budget allocation.</p>
      </div>

      {/* Section 1: Budget Overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Budget Overview</h2>
          <div className="mb-6 text-center">
            <p className="text-sm text-zinc-400">Total Monthly Budget</p>
            <p className="text-4xl font-bold text-white mt-1">
              ${totalBudget.toLocaleString()}
            </p>
          </div>

          {/* Sliders */}
          <div className="space-y-4">
            {(isEditing ? DEFAULT_CHANNELS : Object.keys(activeSliders)).map((channel) => {
              const pct = activeSliders[channel] ?? 0;
              const amount = Math.round((totalBudget * pct) / 100);
              return (
                <div key={channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-300">{CHANNEL_LABELS[channel] || channel}</span>
                    <span className="text-sm text-zinc-400">
                      {pct}% (${amount.toLocaleString()})
                    </span>
                  </div>
                  {isEditing ? (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onChange={(e) => handleSliderChange(channel, Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-zinc-700 accent-blue-500"
                    />
                  ) : (
                    <div className="h-2 w-full rounded-full bg-zinc-700">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}

            {isEditing && (
              <div className="flex items-center justify-between border-t border-zinc-700 pt-3">
                <span className={`text-sm font-medium ${totalSliderPercent > 100 ? 'text-red-400' : 'text-zinc-300'}`}>
                  Total: {totalSliderPercent}%
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAllocation}
                    disabled={totalSliderPercent > 100 || updateAllocation.isPending}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {updateAllocation.isPending ? 'Saving...' : 'Save Allocation'}
                  </button>
                </div>
              </div>
            )}

            {!isEditing && (
              <button
                onClick={startEditing}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Edit Allocation
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Channel Distribution</h2>
          {pieData.length > 0 ? (
            <PieChartComponent data={pieData} height={320} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              No budget allocation set yet.
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Validation */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Validation</h2>
        {validationQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-zinc-800/50" />
            ))}
          </div>
        ) : validation ? (
          <div className="space-y-4">
            {/* Status badge */}
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              validation.valid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              <span className={`h-2 w-2 rounded-full ${validation.valid ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {validation.valid ? 'Budget Valid' : 'Issues Found'}
            </div>

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                {validation.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-sm text-amber-300">{w}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {validation.suggestions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-300">AI Suggestions</h3>
                {validation.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <p className="text-sm text-blue-300">
                      <span className="font-medium">{CHANNEL_LABELS[s.channel] || s.channel}:</span> {s.reason} (Current: {s.currentPercent}% → Suggested: {s.suggestedPercent}%)
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Breakdown checklist */}
            <div className="space-y-1">
              {validation.breakdown.map((b) => (
                <div key={b.channel} className="flex items-center gap-2 text-sm">
                  <span className={`h-4 w-4 flex items-center justify-center rounded-full text-xs ${
                    b.valid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {b.valid ? '\u2713' : '\u2717'}
                  </span>
                  <span className="text-zinc-300">{CHANNEL_LABELS[b.channel] || b.channel}</span>
                  <span className="text-zinc-500">- ${b.amount.toLocaleString()}/mo ({b.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Section 3: Monthly Projection */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Monthly Projection (6 Months)</h2>
        {breakdownQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-zinc-800/50" />
        ) : breakdown ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 text-center">
                <p className="text-xs text-zinc-400">Total 6-Month Budget</p>
                <p className="text-2xl font-bold text-white">${breakdown.totalBudget.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 text-center">
                <p className="text-xs text-zinc-400">Projected Revenue</p>
                <p className="text-2xl font-bold text-emerald-400">${breakdown.totalProjectedRevenue.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4 text-center">
                <p className="text-xs text-zinc-400">Estimated ROI</p>
                <p className={`text-2xl font-bold ${breakdown.estimatedROI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {breakdown.estimatedROI.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Area chart */}
            <AreaChartComponent
              data={projectionChartData}
              color="#ef4444"
              color2="#10b981"
              label="Cumulative Spend"
              label2="Cumulative Revenue"
              height={300}
            />

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Month</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-400">Budget</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-400">Impressions</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-400">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-400">Conversions</th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-400">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {breakdown.months.map((m) => {
                    const totalImpressions = m.channels.reduce((s, c) => s + c.estimatedImpressions, 0);
                    const totalClicks = m.channels.reduce((s, c) => s + c.estimatedClicks, 0);
                    const totalConversions = m.channels.reduce((s, c) => s + c.estimatedConversions, 0);
                    return (
                      <tr key={m.month} className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-300">{m.label}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">${m.totalBudget.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-zinc-400">{totalImpressions.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-zinc-400">{totalClicks.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-zinc-400">{totalConversions.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">${m.totalRevenue.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Section 4: Pre-launch Checklist */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Pre-launch Checklist</h2>
        {prelaunchQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-800/50" />
            ))}
          </div>
        ) : prelaunch ? (
          <div className="space-y-6">
            {/* Checks */}
            <div className="space-y-2">
              {prelaunch.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    check.status === 'pass'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : check.status === 'warning'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {check.status === 'pass' ? '\u2713' : check.status === 'warning' ? '!' : '\u2717'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{check.label}</p>
                    <p className="text-xs text-zinc-500">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 border-t border-zinc-700 pt-4">
              {!validation?.totalBudget ? null : (
                <button
                  onClick={handleApprove}
                  disabled={approveBudget.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  {approveBudget.isPending ? 'Approving...' : 'Approve Budget'}
                </button>
              )}
              <button
                disabled={!prelaunch.ready}
                className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-colors ${
                  prelaunch.ready
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                LAUNCH
              </button>
              {!prelaunch.ready && (
                <p className="text-xs text-zinc-500">Resolve all failed checks before launching.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
