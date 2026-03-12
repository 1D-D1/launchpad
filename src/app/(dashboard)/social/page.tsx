'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import StatusBadge from '@/components/shared/status-badge';
import MetricCard from '@/components/shared/metric-card';
import CarouselPreview from '@/components/social/carousel-preview';
import InfographicPreview from '@/components/social/infographic-preview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'feed' | 'calendar' | 'generate' | 'performance';
type PostStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED';
type PostType = 'CAROUSEL' | 'SINGLE_IMAGE' | 'INFOGRAPHIC' | 'TEXT_ONLY' | 'VIDEO_SCRIPT' | 'STORY' | 'REEL_SCRIPT';
type PlatformKey = 'LINKEDIN' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'TWITTER';

interface MockPost {
  id: string;
  platform: PlatformKey;
  postType: PostType;
  caption: string;
  captionVariantB?: string;
  hashtags: string[];
  carouselSlides?: { slideNumber: number; headline: string; body: string; visualPrompt: string }[];
  infographicData?: { title: string; subtitle: string; sections: { heading: string; stat: string; description: string; iconSuggestion: string }[]; colorScheme: string };
  status: PostStatus;
  bestTimeToPost: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Static data (will be replaced by tRPC calls)
// ---------------------------------------------------------------------------

const PLATFORMS: PlatformKey[] = ['LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'TWITTER'];

const statusConfig: Record<PostStatus, { label: string; variant: 'neutral' | 'warning' | 'success' | 'info' | 'running' }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  PENDING_REVIEW: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  SCHEDULED: { label: 'Scheduled', variant: 'info' },
  PUBLISHED: { label: 'Published', variant: 'running' },
};

const platformIcons: Record<PlatformKey, { color: string; label: string }> = {
  LINKEDIN: { color: 'bg-blue-600/20 text-blue-400', label: 'LinkedIn' },
  INSTAGRAM: { color: 'bg-pink-600/20 text-pink-400', label: 'Instagram' },
  FACEBOOK: { color: 'bg-blue-500/20 text-blue-300', label: 'Facebook' },
  TIKTOK: { color: 'bg-zinc-600/20 text-zinc-300', label: 'TikTok' },
  TWITTER: { color: 'bg-sky-600/20 text-sky-400', label: 'Twitter' },
};

const postTypeLabels: Record<PostType, string> = {
  CAROUSEL: 'Carousel',
  SINGLE_IMAGE: 'Image',
  INFOGRAPHIC: 'Infographic',
  TEXT_ONLY: 'Text',
  VIDEO_SCRIPT: 'Video',
  STORY: 'Story',
  REEL_SCRIPT: 'Reel',
};

const mockPosts: MockPost[] = [
  {
    id: '1',
    platform: 'LINKEDIN',
    postType: 'CAROUSEL',
    caption: '5 AI Marketing Strategies That Actually Work in 2026\n\nMost companies are using AI wrong. Here\'s what the top 1% do differently...',
    hashtags: ['#AIMarketing', '#DigitalStrategy', '#B2B', '#MarketingAutomation', '#Growth'],
    carouselSlides: [
      { slideNumber: 1, headline: 'AI Marketing Is Broken', body: 'Most teams automate the wrong things. Here are 5 strategies that actually move the needle.', visualPrompt: 'Bold text on dark gradient' },
      { slideNumber: 2, headline: 'Strategy 1: Predictive Audiences', body: 'Use AI to find customers before they know they need you. 73% higher conversion rates.', visualPrompt: 'Data visualization with upward trend' },
      { slideNumber: 3, headline: 'Strategy 2: Content Atoms', body: 'One idea, 12 formats. AI repurposes your best content across every channel automatically.', visualPrompt: 'Network diagram showing content distribution' },
      { slideNumber: 4, headline: 'Strategy 3: Dynamic Pricing', body: 'Real-time price optimization based on demand signals. Average 18% revenue lift.', visualPrompt: 'Price optimization chart' },
      { slideNumber: 5, headline: 'Strategy 4: Sentiment Loops', body: 'Monitor brand sentiment and auto-adjust messaging in real-time. Never miss a trend.', visualPrompt: 'Sentiment analysis dashboard' },
      { slideNumber: 6, headline: 'Strategy 5: AI-First SEO', body: 'Optimize for AI assistants, not just search engines. The next frontier of discovery.', visualPrompt: 'AI search interface mockup' },
      { slideNumber: 7, headline: 'Start Today', body: 'Follow for more AI marketing strategies. Save this post. Share with your team.', visualPrompt: 'CTA with follow button design' },
    ],
    status: 'APPROVED',
    bestTimeToPost: 'Tuesday 10:00 AM',
    createdAt: '2h ago',
  },
  {
    id: '2',
    platform: 'INSTAGRAM',
    postType: 'CAROUSEL',
    caption: 'Stop scrolling. This will change how you think about marketing forever.\n\nWe analyzed 10,000 campaigns and found the #1 factor behind viral growth...',
    hashtags: ['#marketing', '#growth', '#startup', '#business', '#ai'],
    carouselSlides: [
      { slideNumber: 1, headline: 'The #1 Growth Factor', body: 'We analyzed 10,000 campaigns. One factor predicted success 89% of the time.', visualPrompt: 'Eye-catching stat on gradient' },
      { slideNumber: 2, headline: 'It\'s Not What You Think', body: 'It\'s not budget. Not timing. Not even the product. It\'s STORY.', visualPrompt: 'Dramatic reveal slide' },
      { slideNumber: 3, headline: 'Save & Share', body: 'Follow @launchpad for more marketing insights that actually work.', visualPrompt: 'CTA slide with brand colors' },
    ],
    status: 'DRAFT',
    bestTimeToPost: 'Wednesday 12:00 PM',
    createdAt: '4h ago',
  },
  {
    id: '3',
    platform: 'LINKEDIN',
    postType: 'INFOGRAPHIC',
    caption: 'The State of AI Marketing in 2026 — Key statistics every marketer needs to know.',
    hashtags: ['#AIMarketing', '#MarketingStats', '#DataDriven'],
    infographicData: {
      title: 'AI Marketing in 2026',
      subtitle: 'Key Statistics Every Marketer Needs',
      sections: [
        { heading: 'AI Adoption', stat: '78%', description: 'of companies now use AI in marketing', iconSuggestion: 'robot' },
        { heading: 'ROI Increase', stat: '3.2x', description: 'average return on AI marketing investment', iconSuggestion: 'trending-up' },
        { heading: 'Time Saved', stat: '22hrs', description: 'per week saved through automation', iconSuggestion: 'clock' },
        { heading: 'Content Output', stat: '5x', description: 'more content produced with same team', iconSuggestion: 'layers' },
      ],
      colorScheme: 'deep navy with gold accents',
    },
    status: 'PENDING_REVIEW',
    bestTimeToPost: 'Thursday 9:00 AM',
    createdAt: '1d ago',
  },
  {
    id: '4',
    platform: 'TIKTOK',
    postType: 'TEXT_ONLY',
    caption: 'POV: You just automated your entire marketing stack and now you have nothing to do at work\n\n(jk the AI needs babysitting too)',
    hashtags: ['#marketinghumor', '#aimarketing', '#startup', '#tech'],
    status: 'DRAFT',
    bestTimeToPost: 'Thursday 7:00 PM',
    createdAt: '1d ago',
  },
  {
    id: '5',
    platform: 'FACEBOOK',
    postType: 'SINGLE_IMAGE',
    caption: 'What\'s the biggest marketing challenge your business faces right now?\n\nA) Not enough leads\nB) Low conversion rates\nC) Content creation bottleneck\nD) Measuring ROI\n\nDrop your answer below!',
    hashtags: ['#marketing', '#business', '#poll'],
    status: 'SCHEDULED',
    bestTimeToPost: 'Wednesday 2:00 PM',
    createdAt: '2d ago',
  },
  {
    id: '6',
    platform: 'TWITTER',
    postType: 'TEXT_ONLY',
    caption: 'Hot take: 90% of "AI marketing tools" are just ChatGPT with a pretty UI.\n\nThe real value is in the workflow automation, not the text generation.',
    hashtags: ['#AI', '#marketing'],
    status: 'PUBLISHED',
    bestTimeToPost: 'Monday 9:00 AM',
    createdAt: '3d ago',
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SocialMediaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [filterPlatform, setFilterPlatform] = useState<PlatformKey | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<PostStatus | 'all'>('all');

  // Generate tab state
  const [genPlatforms, setGenPlatforms] = useState<Set<PlatformKey>>(new Set(['LINKEDIN', 'INSTAGRAM']));
  const [genType, setGenType] = useState<PostType>('CAROUSEL');
  const [genTopic, setGenTopic] = useState('');

  const filtered = mockPosts.filter((p) => {
    if (filterPlatform !== 'all' && p.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'feed', label: 'Feed Preview' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'generate', label: 'Generate' },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Social Media</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {mockPosts.length} posts across {PLATFORMS.length} platforms
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Feed Preview */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value as PlatformKey | 'all')}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{platformIcons[p].label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as PostStatus | 'all')}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              {Object.entries(statusConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Post cards */}
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((post) => {
              const sc = statusConfig[post.status];
              const pi = platformIcons[post.platform];
              return (
                <div
                  key={post.id}
                  className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700"
                >
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', pi.color, 'ring-current/30')}>
                      {pi.label}
                    </span>
                    <StatusBadge label={postTypeLabels[post.postType]} variant="info" />
                    <StatusBadge label={sc.label} variant={sc.variant} />
                  </div>

                  {/* Caption */}
                  <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line line-clamp-4">
                    {post.caption}
                  </p>

                  {/* Hashtags */}
                  {post.hashtags.length > 0 && (
                    <p className="mt-2 text-xs text-blue-400/70 line-clamp-1">
                      {post.hashtags.join(' ')}
                    </p>
                  )}

                  {/* Carousel preview */}
                  {post.postType === 'CAROUSEL' && post.carouselSlides && (
                    <div className="mt-3">
                      <CarouselPreview slides={post.carouselSlides} platform={post.platform} />
                    </div>
                  )}

                  {/* Infographic preview */}
                  {post.postType === 'INFOGRAPHIC' && post.infographicData && (
                    <div className="mt-3">
                      <InfographicPreview data={post.infographicData} />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
                    <span className="text-xs text-zinc-500">
                      {post.bestTimeToPost} &middot; {post.createdAt}
                    </span>
                    <div className="flex gap-1">
                      {['DRAFT', 'PENDING_REVIEW'].includes(post.status) && (
                        <button className="rounded-md bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                          Approve
                        </button>
                      )}
                      <button className="rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                        Edit
                      </button>
                      <button className="rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                        Schedule
                      </button>
                      <button className="rounded-md px-2.5 py-1 text-xs text-red-400/70 hover:bg-red-600/10 hover:text-red-400 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-500">
              No posts match your filters.
            </div>
          )}
        </div>
      )}

      {/* Tab: Calendar */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr>
                  <th className="border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-left text-xs font-medium text-zinc-400 w-24">
                    Platform
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-center text-xs font-medium text-zinc-400"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([...PLATFORMS.filter((p) => p !== 'TWITTER'), 'TWITTER'] as PlatformKey[]).map((platform) => {
                  const pi = platformIcons[platform];
                  return (
                    <tr key={platform}>
                      <td className="border border-zinc-800 bg-zinc-900/30 px-3 py-3">
                        <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', pi.color)}>
                          {pi.label}
                        </span>
                      </td>
                      {DAYS.map((day) => {
                        // Mock: distribute posts across days
                        const dayPosts = mockPosts.filter(
                          (p) => p.platform === platform,
                        );
                        const postsForDay = dayPosts.filter(
                          (_, idx) => idx % 7 === DAYS.indexOf(day) % dayPosts.length,
                        );
                        return (
                          <td
                            key={day}
                            className="border border-zinc-800 px-2 py-2 align-top min-w-[100px]"
                          >
                            {postsForDay.length > 0 ? (
                              <div className="space-y-1">
                                {postsForDay.map((p) => (
                                  <div
                                    key={p.id}
                                    className="rounded-md bg-zinc-800/50 px-2 py-1 text-xs text-zinc-300 cursor-pointer hover:bg-zinc-700/50 transition-colors"
                                    title={p.caption.slice(0, 100)}
                                  >
                                    <span className="font-medium">{postTypeLabels[p.postType]}</span>
                                    <span className="ml-1 text-zinc-500">
                                      {statusConfig[p.status].label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-700">--</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Generate */}
      {activeTab === 'generate' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Controls */}
          <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white">Generate Content</h2>

            {/* Platform selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const selected = genPlatforms.has(p);
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        const next = new Set(genPlatforms);
                        if (selected) next.delete(p);
                        else next.add(p);
                        setGenPlatforms(next);
                      }}
                      className={clsx(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors border',
                        selected
                          ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600',
                      )}
                    >
                      {platformIcons[p].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Post type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Post Type
              </label>
              <select
                value={genType}
                onChange={(e) => setGenType(e.target.value as PostType)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(postTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-400">
                Topic
              </label>
              <textarea
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="e.g. 5 AI marketing strategies for B2B SaaS companies..."
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                Generate Single Post
              </button>
              <button className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors">
                Generate Week
              </button>
            </div>
          </div>

          {/* Preview area */}
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              <p className="mt-4 text-sm text-zinc-500">
                Generated content will appear here.
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Select platforms, choose a type, enter a topic, and click Generate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Performance */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Reach"
              value="124.5K"
              trend={{ value: 18, isPositive: true }}
            />
            <MetricCard
              label="Avg Engagement Rate"
              value="4.7%"
              trend={{ value: 0.8, isPositive: true }}
            />
            <MetricCard
              label="Best Platform"
              value="LinkedIn"
            />
            <MetricCard
              label="Top Post Type"
              value="Carousel"
            />
          </div>

          {/* Platform comparison placeholder */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Platform Comparison</h3>
            <div className="space-y-4">
              {PLATFORMS.map((platform) => {
                const pi = platformIcons[platform];
                const mockEngagement = { LINKEDIN: 72, INSTAGRAM: 65, FACEBOOK: 48, TIKTOK: 58, TWITTER: 35 };
                const pct = mockEngagement[platform];
                return (
                  <div key={platform} className="flex items-center gap-4">
                    <span className={clsx('inline-flex w-20 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium', pi.color)}>
                      {pi.label}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-zinc-300 w-12 text-right">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engagement by post type */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Engagement by Post Type</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                { type: 'Carousel', rate: '6.2%', posts: 12, color: 'text-blue-400' },
                { type: 'Infographic', rate: '5.1%', posts: 5, color: 'text-emerald-400' },
                { type: 'Single Image', rate: '3.8%', posts: 18, color: 'text-amber-400' },
                { type: 'Text Only', rate: '2.4%', posts: 8, color: 'text-zinc-400' },
              ] as const).map((item) => (
                <div key={item.type} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                  <p className="text-xs text-zinc-500">{item.type}</p>
                  <p className={clsx('mt-1 text-2xl font-semibold', item.color)}>{item.rate}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.posts} posts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
