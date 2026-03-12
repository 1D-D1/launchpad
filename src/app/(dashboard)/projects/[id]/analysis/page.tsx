'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import type { ProjectAnalysis } from '@/server/services/ai/prompts/project-analysis';

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800 ${className}`} />;
}

function SectionSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score badge
// ---------------------------------------------------------------------------

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80
      ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
      : score >= 60
        ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
        : 'text-red-400 border-red-400/30 bg-red-400/10';

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${color}`}>
      <span className="text-lg font-bold">{score}</span>
      <span className="text-xs opacity-80">/100</span>
      <span className="ml-1 text-xs">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impact badge
// ---------------------------------------------------------------------------

function ImpactBadge({ impact }: { impact: string }) {
  const color =
    impact === 'HIGH'
      ? 'bg-red-500/20 text-red-400'
      : impact === 'MEDIUM'
        ? 'bg-amber-500/20 text-amber-400'
        : 'bg-emerald-500/20 text-emerald-400';

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {impact}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Effort badge
// ---------------------------------------------------------------------------

function EffortBadge({ effort }: { effort: string }) {
  const color =
    effort === 'HIGH'
      ? 'bg-purple-500/20 text-purple-400'
      : effort === 'MEDIUM'
        ? 'bg-blue-500/20 text-blue-400'
        : 'bg-zinc-500/20 text-zinc-400';

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {effort}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function BusinessModelCard({ data }: { data: ProjectAnalysis['businessModel'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Business Model Assessment</h2>
      <p className="text-sm text-zinc-300 mb-4">{data.assessment}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-emerald-400 mb-2">Strengths</h3>
          <ul className="space-y-1">
            {data.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium text-red-400 mb-2">Weaknesses</h3>
          <ul className="space-y-1">
            {data.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <h3 className="text-sm font-medium text-blue-400 mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {data.recommendations.map((r, i) => (
              <li key={i} className="text-sm text-zinc-300">
                {i + 1}. {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TargetClientCard({ data }: { data: ProjectAnalysis['targetClient'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Target Client Profile</h2>
        <ScoreBadge score={data.validationScore} label="Validation" />
      </div>

      {/* Persona card */}
      <div className="flex items-start gap-4 mb-4 p-4 rounded-lg bg-zinc-800/50">
        <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-medium text-white mb-1">Current Profile</h3>
          <p className="text-sm text-zinc-400">{data.currentProfile}</p>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-white mb-1">Ideal Client</h3>
        <p className="text-sm text-zinc-300">{data.idealClientDescription}</p>
      </div>

      {data.refinements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400 mb-2">Suggested Refinements</h3>
          <ul className="space-y-1">
            {data.refinements.map((r, i) => (
              <li key={i} className="text-sm text-zinc-300">- {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PricingCard({ data }: { data: ProjectAnalysis['pricing'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Pricing Recommendation</h2>

      <p className="text-sm text-zinc-300 mb-2">{data.currentPricing}</p>
      <p className="text-sm text-zinc-400 mb-4">{data.recommendation}</p>

      {data.competitorPricing.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2">Competitor Pricing</h3>
          <div className="flex flex-wrap gap-2">
            {data.competitorPricing.map((p, i) => (
              <span key={i} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.suggestedTiers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="pb-2 pr-4 text-xs font-medium text-zinc-500">Tier</th>
                <th className="pb-2 pr-4 text-xs font-medium text-zinc-500">Price</th>
                <th className="pb-2 text-xs font-medium text-zinc-500">Features</th>
              </tr>
            </thead>
            <tbody>
              {data.suggestedTiers.map((tier, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-medium text-white">{tier.name}</td>
                  <td className="py-2 pr-4 text-emerald-400">{tier.price}</td>
                  <td className="py-2 text-zinc-400">{tier.features.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChannelStrategyCard({ data }: { data: ProjectAnalysis['channelStrategy'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Channel Strategy</h2>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div>
          <h3 className="text-sm font-medium text-emerald-400 mb-2">Best Channels</h3>
          <div className="flex flex-wrap gap-2">
            {data.bestChannels.map((c, i) => (
              <span key={i} className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs text-emerald-400">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-red-400 mb-2">Underperforming</h3>
          <div className="flex flex-wrap gap-2">
            {data.underperforming.map((c, i) => (
              <span key={i} className="rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-xs text-red-400">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {data.budgetReallocation.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase mb-3">Budget Reallocation</h3>
          <div className="space-y-3">
            {data.budgetReallocation.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 text-sm text-zinc-300 shrink-0">{b.channel}</span>
                <div className="flex-1 relative h-6 rounded bg-zinc-800 overflow-hidden">
                  {/* Current */}
                  <div
                    className="absolute inset-y-0 left-0 bg-zinc-600 rounded-l"
                    style={{ width: `${b.currentPct}%` }}
                  />
                  {/* Suggested overlay */}
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500/40 border-r-2 border-blue-400"
                    style={{ width: `${b.suggestedPct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-24 shrink-0">
                  {b.currentPct}% &rarr; {b.suggestedPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GrowthProjectionsCard({ data }: { data: ProjectAnalysis['growthProjection'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Growth Projections</h2>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        {[
          { label: 'Month 1', value: data.month1, color: 'border-blue-500/30' },
          { label: 'Month 3', value: data.month3, color: 'border-emerald-500/30' },
          { label: 'Month 6', value: data.month6, color: 'border-purple-500/30' },
        ].map((item) => (
          <div key={item.label} className={`rounded-lg border ${item.color} bg-zinc-800/50 p-4`}>
            <h3 className="text-xs font-medium text-zinc-500 mb-1">{item.label}</h3>
            <p className="text-sm text-zinc-300">{item.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2">Assumptions</h3>
        <ul className="space-y-1">
          {data.assumptions.map((a, i) => (
            <li key={i} className="text-xs text-zinc-400">- {a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RiskMatrixCard({ data }: { data: ProjectAnalysis['riskFactors'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Risk Matrix</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500">Risk</th>
              <th className="pb-2 pr-4 text-xs font-medium text-zinc-500">Impact</th>
              <th className="pb-2 text-xs font-medium text-zinc-500">Mitigation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((risk, i) => (
              <tr key={i} className="border-b border-zinc-800/50">
                <td className="py-3 pr-4 text-zinc-300">{risk.risk}</td>
                <td className="py-3 pr-4">
                  <ImpactBadge impact={risk.impact} />
                </td>
                <td className="py-3 text-zinc-400">{risk.mitigation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionItemsCard({ data }: { data: ProjectAnalysis['actionItems'] }) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Action Items</h2>

      <div className="space-y-3">
        {data.map((item, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              checkedItems.has(i) ? 'bg-zinc-800/30 opacity-60' : 'bg-zinc-800/50'
            }`}
          >
            <button
              onClick={() => toggleItem(i)}
              className={`mt-0.5 h-5 w-5 shrink-0 rounded border ${
                checkedItems.has(i)
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                  : 'border-zinc-600 text-transparent hover:border-zinc-500'
              } flex items-center justify-center transition-colors`}
            >
              {checkedItems.has(i) && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-zinc-500">#{item.priority}</span>
                <EffortBadge effort={item.effort} />
              </div>
              <p className={`text-sm ${checkedItems.has(i) ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                {item.action}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{item.expectedImpact}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentStrategyCard({ data }: { data: ProjectAnalysis['contentStrategy'] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Content Strategy</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-medium text-emerald-400 mb-2">Top Performing Types</h3>
          <ul className="space-y-1">
            {data.topPerformingTypes.map((t, i) => (
              <li key={i} className="text-sm text-zinc-300">- {t}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium text-amber-400 mb-2">Improvement Areas</h3>
          <ul className="space-y-1">
            {data.improvementAreas.map((a, i) => (
              <li key={i} className="text-sm text-zinc-300">- {a}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium text-blue-400 mb-2">Content Gaps</h3>
          <ul className="space-y-1">
            {data.contentGaps.map((g, i) => (
              <li key={i} className="text-sm text-zinc-300">- {g}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RevisionPromptCard({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = prompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [prompt]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Claude Code Revision Prompt</h2>
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy Prompt
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto border border-zinc-800">
        {prompt}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProjectAnalysisPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analysisQuery = trpc.analysis.getAnalysis.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const analyzeMutation = trpc.analysis.analyzeProject.useMutation({
    onSuccess: () => {
      analysisQuery.refetch();
      setIsAnalyzing(false);
    },
    onError: () => {
      setIsAnalyzing(false);
    },
  });

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    analyzeMutation.mutate({ projectId });
  };

  const analysis = analysisQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Project Analysis</h1>
          <p className="mt-1 text-sm text-zinc-400">
            AI-powered insights and recommendations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 cursor-not-allowed opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Export as PDF
          </button>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Run Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {analyzeMutation.error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">
            {analyzeMutation.error.message}
          </p>
        </div>
      )}

      {/* Loading state */}
      {(analysisQuery.isLoading || isAnalyzing) && (
        <div className="space-y-6">
          {isAnalyzing && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <p className="text-sm text-blue-400">
                Running AI analysis... This may take 30-60 seconds.
              </p>
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      )}

      {/* No analysis yet */}
      {!analysisQuery.isLoading && !isAnalyzing && !analysis && (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <svg className="h-16 w-16 text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <h3 className="text-lg font-medium text-zinc-400 mb-2">No Analysis Yet</h3>
          <p className="text-sm text-zinc-500 mb-6 text-center max-w-md">
            Click &quot;Run Analysis&quot; to generate AI-powered insights about your project&apos;s
            business model, target client, pricing, channels, and growth potential.
          </p>
          <button
            onClick={handleRunAnalysis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Run Analysis
          </button>
        </div>
      )}

      {/* Analysis results */}
      {analysis && !isAnalyzing && (
        <div className="space-y-6">
          {/* Top row: Business Model + Target Client */}
          <div className="grid gap-6 lg:grid-cols-2">
            <BusinessModelCard data={analysis.businessModel} />
            <TargetClientCard data={analysis.targetClient} />
          </div>

          {/* Pricing */}
          <PricingCard data={analysis.pricing} />

          {/* Channel Strategy */}
          <ChannelStrategyCard data={analysis.channelStrategy} />

          {/* Content Strategy */}
          <ContentStrategyCard data={analysis.contentStrategy} />

          {/* Growth + Risk row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GrowthProjectionsCard data={analysis.growthProjection} />
            <RiskMatrixCard data={analysis.riskFactors} />
          </div>

          {/* Action Items */}
          <ActionItemsCard data={analysis.actionItems} />

          {/* Revision Prompt */}
          <RevisionPromptCard prompt={analysis.claudeCodeRevisionPrompt} />
        </div>
      )}
    </div>
  );
}
