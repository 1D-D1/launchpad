'use client';

import { useState } from 'react';
import StatusBadge from '@/components/shared/status-badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'keywords' | 'posts' | 'calendar' | 'audit';

interface Keyword {
  id: string;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  intent: string | null;
  cluster: string | null;
  priority: number;
  assignedPostId: string | null;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  targetKeyword: string;
  wordCount: number;
  seoScore: number | null;
  geoScore: number | null;
  status: string;
  createdAt: string;
}

interface CalendarEntry {
  date: string;
  keyword: string;
  title: string;
  description: string;
  cluster: string;
  linksTo: string[];
  priority: number;
}

interface AuditResult {
  id: string;
  overallScore: number;
  geoReadiness: number;
  internalLinkScore: number;
  contentCoverage: number;
  recommendations: string[];
  details: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data (replaced by tRPC calls in production)
// ---------------------------------------------------------------------------

const mockKeywords: Keyword[] = [
  { id: '1', keyword: 'ai marketing automation', searchVolume: 2400, difficulty: 65, intent: 'commercial', cluster: 'AI Marketing', priority: 9, assignedPostId: 'p1' },
  { id: '2', keyword: 'how to automate social media', searchVolume: 1800, difficulty: 45, intent: 'informational', cluster: 'Social Media', priority: 8, assignedPostId: null },
  { id: '3', keyword: 'best marketing tools for startups', searchVolume: 3200, difficulty: 72, intent: 'commercial', cluster: 'Marketing Tools', priority: 7, assignedPostId: null },
  { id: '4', keyword: 'content marketing strategy guide', searchVolume: 1500, difficulty: 55, intent: 'informational', cluster: 'Content Strategy', priority: 6, assignedPostId: 'p2' },
  { id: '5', keyword: 'seo vs ppc for small business', searchVolume: 900, difficulty: 38, intent: 'informational', cluster: 'SEO', priority: 5, assignedPostId: null },
];

const mockPosts: BlogPost[] = [
  { id: 'p1', title: 'The Complete Guide to AI Marketing Automation in 2026', slug: 'ai-marketing-automation-guide-2026', targetKeyword: 'ai marketing automation', wordCount: 2150, seoScore: 87, geoScore: 72, status: 'PUBLISHED', createdAt: '2026-03-10T10:00:00Z' },
  { id: 'p2', title: 'How to Build a Content Marketing Strategy That Actually Works', slug: 'content-marketing-strategy-guide', targetKeyword: 'content marketing strategy guide', wordCount: 1890, seoScore: 79, geoScore: null, status: 'DRAFT', createdAt: '2026-03-11T14:00:00Z' },
];

const mockCalendar: CalendarEntry[] = [
  { date: '2026-03-14', keyword: 'how to automate social media', title: '10 Ways to Automate Your Social Media in 2026', description: 'Comprehensive guide covering tools and strategies', cluster: 'Social Media', linksTo: ['ai-marketing-automation-guide-2026'], priority: 8 },
  { date: '2026-03-17', keyword: 'best marketing tools for startups', title: 'The 15 Best Marketing Tools Every Startup Needs', description: 'Curated list with pricing and use cases', cluster: 'Marketing Tools', linksTo: ['ai-marketing-automation-guide-2026', 'content-marketing-strategy-guide'], priority: 7 },
  { date: '2026-03-20', keyword: 'seo vs ppc for small business', title: 'SEO vs PPC: Which Is Better for Your Small Business?', description: 'Data-driven comparison with real ROI numbers', cluster: 'SEO', linksTo: ['content-marketing-strategy-guide'], priority: 5 },
];

const mockAudit: AuditResult = {
  id: 'a1',
  overallScore: 58,
  geoReadiness: 36,
  internalLinkScore: 45,
  contentCoverage: 40,
  recommendations: [
    'Only 40% of keywords have assigned posts. Generate more content to increase coverage.',
    'Internal link score is low. Run "Recalculate Internal Links" to improve link structure.',
    'GEO readiness is below 60. Optimize existing posts for Generative Engine Optimization.',
    '1 post has not been GEO-optimized yet.',
  ],
  details: { totalPosts: 2, totalKeywords: 5, assignedKeywords: 2, avgSeoScore: 83, avgGeoScore: 72, avgWordCount: 2020, linkScore: 45, postsWithoutGeo: 1 },
  createdAt: '2026-03-12T08:00:00Z',
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function ScoreGauge({ label, score, max = 100 }: { label: string; score: number; max?: number }) {
  const pct = Math.round((score / max) * 100);
  const color =
    pct >= 75 ? 'text-emerald-400' :
    pct >= 50 ? 'text-amber-400' :
    'text-red-400';

  const ringColor =
    pct >= 75 ? 'stroke-emerald-400' :
    pct >= 50 ? 'stroke-amber-400' :
    'stroke-red-400';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#27272a" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            className={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 327} 327`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2 text-zinc-400">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
      </svg>
      <span className="text-sm">Processing...</span>
    </div>
  );
}

function intentBadgeVariant(intent: string | null): 'info' | 'success' | 'warning' | 'neutral' {
  switch (intent) {
    case 'transactional': return 'success';
    case 'commercial': return 'warning';
    case 'informational': return 'info';
    default: return 'neutral';
  }
}

function statusBadgeVariant(status: string): 'neutral' | 'warning' | 'success' | 'info' | 'error' {
  switch (status) {
    case 'PUBLISHED': return 'success';
    case 'SCHEDULED': return 'info';
    case 'APPROVED': return 'info';
    case 'DRAFT': return 'neutral';
    case 'FAILED': return 'error';
    default: return 'neutral';
  }
}

// ---------------------------------------------------------------------------
// Tab contents
// ---------------------------------------------------------------------------

function KeywordsTab({
  keywords,
  loading,
  onGenerate,
}: {
  keywords: Keyword[];
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{keywords.length} keywords in strategy</p>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating...' : 'Generate Keywords'}
        </button>
      </div>

      {loading && <LoadingSpinner />}

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs text-zinc-400">
              <th className="px-4 py-3 font-medium">Keyword</th>
              <th className="px-4 py-3 font-medium">Volume</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Intent</th>
              <th className="px-4 py-3 font-medium">Cluster</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {keywords.map((kw) => (
              <tr key={kw.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{kw.keyword}</td>
                <td className="px-4 py-3 text-zinc-300">{kw.searchVolume?.toLocaleString() ?? '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-zinc-700">
                      <div
                        className={`h-1.5 rounded-full ${
                          (kw.difficulty ?? 0) > 70 ? 'bg-red-400' :
                          (kw.difficulty ?? 0) > 40 ? 'bg-amber-400' :
                          'bg-emerald-400'
                        }`}
                        style={{ width: `${kw.difficulty ?? 0}%` }}
                      />
                    </div>
                    <span className="text-zinc-300">{kw.difficulty ?? '-'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={kw.intent ?? 'unknown'} variant={intentBadgeVariant(kw.intent)} />
                </td>
                <td className="px-4 py-3 text-zinc-300">{kw.cluster ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
                    {kw.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {kw.assignedPostId ? (
                    <StatusBadge label="Yes" variant="success" />
                  ) : (
                    <StatusBadge label="No" variant="neutral" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {keywords.length === 0 && !loading && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
          No keywords yet. Click &quot;Generate Keywords&quot; to start your SEO strategy.
        </div>
      )}
    </div>
  );
}

function BlogPostsTab({
  posts,
  loading,
  onGenerateNext,
  onGenerateBatch,
  onOptimizeGeo,
  onPublish,
}: {
  posts: BlogPost[];
  loading: boolean;
  onGenerateNext: () => void;
  onGenerateBatch: () => void;
  onOptimizeGeo: (id: string) => void;
  onPublish: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{posts.length} blog posts</p>
        <div className="flex gap-2">
          <button
            onClick={onGenerateNext}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            Generate Next Post
          </button>
          <button
            onClick={onGenerateBatch}
            disabled={loading}
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-600/10 disabled:opacity-50 transition-colors"
          >
            Generate Batch (5 posts)
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700"
          >
            <div className="mb-3 flex items-center gap-2">
              <StatusBadge label={post.status} variant={statusBadgeVariant(post.status)} />
            </div>

            <h3 className="mb-1 text-sm font-semibold text-white line-clamp-2">{post.title}</h3>
            <p className="mb-3 text-xs text-zinc-500">Keyword: {post.targetKeyword}</p>

            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-zinc-200">{post.wordCount.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500">Words</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${(post.seoScore ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {post.seoScore ?? '-'}
                </p>
                <p className="text-[10px] text-zinc-500">SEO</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${(post.geoScore ?? 0) >= 70 ? 'text-emerald-400' : post.geoScore ? 'text-amber-400' : 'text-zinc-600'}`}>
                  {post.geoScore ?? '-'}
                </p>
                <p className="text-[10px] text-zinc-500">GEO</p>
              </div>
            </div>

            <div className="mt-auto flex gap-1 border-t border-zinc-800 pt-3">
              {post.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => onPublish(post.id)}
                    className="rounded-md bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                  >
                    Publish
                  </button>
                  {!post.geoScore && (
                    <button
                      onClick={() => onOptimizeGeo(post.id)}
                      className="rounded-md bg-purple-600/20 px-2.5 py-1 text-xs font-medium text-purple-400 hover:bg-purple-600/30 transition-colors"
                    >
                      Optimize GEO
                    </button>
                  )}
                </>
              )}
              <button className="rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                View
              </button>
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && !loading && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
          No blog posts yet. Generate keywords first, then create posts.
        </div>
      )}
    </div>
  );
}

function CalendarTab({
  calendar,
  loading,
  onGenerate,
}: {
  calendar: CalendarEntry[];
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{calendar.length} scheduled posts</p>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating...' : 'Generate 30-Day Calendar'}
        </button>
      </div>

      {loading && <LoadingSpinner />}

      <div className="space-y-3">
        {calendar.map((entry, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
          >
            <div className="flex flex-col items-center rounded-lg bg-zinc-800 px-3 py-2">
              <span className="text-xs text-zinc-400">
                {new Date(entry.date).toLocaleDateString('en-US', { month: 'short' })}
              </span>
              <span className="text-lg font-bold text-white">
                {new Date(entry.date).getDate()}
              </span>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
              <p className="mt-0.5 text-xs text-zinc-400">{entry.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge label={entry.keyword} variant="info" />
                <StatusBadge label={entry.cluster} variant="neutral" />
                {entry.linksTo.length > 0 && (
                  <StatusBadge label={`Links to ${entry.linksTo.length} posts`} variant="success" />
                )}
              </div>
            </div>

            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-400">
              {entry.priority}
            </span>
          </div>
        ))}
      </div>

      {calendar.length === 0 && !loading && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
          No content calendar yet. Generate keywords first, then create a calendar.
        </div>
      )}
    </div>
  );
}

function AuditTab({
  audit,
  loading,
  onRunAudit,
}: {
  audit: AuditResult | null;
  loading: boolean;
  onRunAudit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {audit ? `Last audit: ${new Date(audit.createdAt).toLocaleDateString()}` : 'No audit run yet'}
        </p>
        <button
          onClick={onRunAudit}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Running...' : 'Run Audit'}
        </button>
      </div>

      {loading && <LoadingSpinner />}

      {audit && (
        <>
          {/* Score gauges */}
          <div className="flex flex-wrap justify-center gap-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <ScoreGauge label="Overall SEO" score={audit.overallScore} />
            <ScoreGauge label="Internal Links" score={audit.internalLinkScore} />
            <ScoreGauge label="GEO Readiness" score={audit.geoReadiness} />
            <ScoreGauge label="Content Coverage" score={audit.contentCoverage} />
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Recommendations</h3>
            <ul className="space-y-2">
              {audit.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(audit.details as Record<string, number | string>).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                <p className="text-lg font-bold text-zinc-200">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                <p className="text-[10px] text-zinc-500">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {!audit && !loading && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
          No audit data. Click &quot;Run Audit&quot; to analyze your SEO performance.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const tabs: { id: TabId; label: string }[] = [
  { id: 'keywords', label: 'Keywords' },
  { id: 'posts', label: 'Blog Posts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'audit', label: 'SEO Audit' },
];

export default function SeoPage() {
  const [activeTab, setActiveTab] = useState<TabId>('keywords');
  const [loading, setLoading] = useState(false);

  // In production these would come from tRPC queries
  const [keywords] = useState<Keyword[]>(mockKeywords);
  const [posts] = useState<BlogPost[]>(mockPosts);
  const [calendar] = useState<CalendarEntry[]>(mockCalendar);
  const [audit] = useState<AuditResult | null>(mockAudit);

  const handleAction = async (label: string) => {
    setLoading(true);
    // TODO: Wire up tRPC mutations
    // eslint-disable-next-line no-console
    console.log(`Action: ${label}`);
    // Simulate delay
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">SEO Engine</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Keyword strategy, blog generation with internal linking, and GEO optimization
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'keywords' && (
        <KeywordsTab
          keywords={keywords}
          loading={loading}
          onGenerate={() => handleAction('generateKeywords')}
        />
      )}

      {activeTab === 'posts' && (
        <BlogPostsTab
          posts={posts}
          loading={loading}
          onGenerateNext={() => handleAction('generateNextPost')}
          onGenerateBatch={() => handleAction('generateBatch')}
          onOptimizeGeo={(id) => handleAction(`optimizeGeo:${id}`)}
          onPublish={(id) => handleAction(`publish:${id}`)}
        />
      )}

      {activeTab === 'calendar' && (
        <CalendarTab
          calendar={calendar}
          loading={loading}
          onGenerate={() => handleAction('generateCalendar')}
        />
      )}

      {activeTab === 'audit' && (
        <AuditTab
          audit={audit}
          loading={loading}
          onRunAudit={() => handleAction('runAudit')}
        />
      )}
    </div>
  );
}
