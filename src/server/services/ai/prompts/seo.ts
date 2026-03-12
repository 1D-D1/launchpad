/**
 * SEO Engine AI prompts.
 * Generates keyword strategies, blog posts with internal linking,
 * content calendars, and GEO (Generative Engine Optimization) content.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectData {
  name: string;
  description: string;
  vertical: string;
  targetAudience: unknown;
  objectives: unknown;
}

export interface CompetitiveAnalysisData {
  competitorName: string;
  competitorUrl?: string;
  strengths?: unknown;
  weaknesses?: unknown;
  serpData?: unknown;
}

export interface ExistingPost {
  id: string;
  slug: string;
  title: string;
  targetKeyword: string;
  excerpt?: string;
  secondaryKeywords?: string[];
}

export interface KeywordInput {
  keyword: string;
  searchVolume?: number;
  difficulty?: number;
  intent?: string;
  cluster?: string;
  priority: number;
}

export interface CalendarStrategy {
  clusters: string[];
  postsPerWeek: number;
  focusArea?: string;
}

// ---------------------------------------------------------------------------
// Keyword Research Prompt
// ---------------------------------------------------------------------------

export function buildKeywordResearchSystemPrompt(): string {
  return `You are an expert SEO strategist and keyword researcher. Your goal is to generate a comprehensive keyword strategy that maximizes organic traffic and business impact.

Return a valid JSON object:

{
  "keywords": [
    {
      "keyword": "exact search keyword phrase",
      "searchVolume": 1200,
      "difficulty": 45,
      "intent": "informational|transactional|navigational|commercial",
      "cluster": "thematic cluster name",
      "priority": 8,
      "rationale": "why this keyword matters for the business"
    }
  ]
}

Guidelines:
- Group keywords into 3-6 thematic clusters for topical authority
- Include a mix of head terms (high volume) and long-tail keywords (low difficulty)
- Priority score: 1-10 (10 = highest business impact)
- Intent classification: informational (learning), transactional (buying), navigational (finding), commercial (comparing)
- Difficulty: 0-100 (estimate based on competition signals)
- Search volume: monthly estimated searches
- Focus on competition gaps where the business can realistically rank
- Include at least 20-30 keywords across all clusters
- Prioritize keywords with commercial or transactional intent higher if the business is revenue-focused`;
}

export function buildKeywordResearchUserPrompt(
  projectData: ProjectData,
  competitiveAnalysis: CompetitiveAnalysisData[],
): string {
  const competitorInfo = competitiveAnalysis.length > 0
    ? competitiveAnalysis.map((c) =>
        `- ${c.competitorName}${c.competitorUrl ? ` (${c.competitorUrl})` : ''}${c.strengths ? `\n  Strengths: ${JSON.stringify(c.strengths)}` : ''}${c.weaknesses ? `\n  Weaknesses: ${JSON.stringify(c.weaknesses)}` : ''}`
      ).join('\n')
    : 'No competitor data available';

  return `Generate a keyword strategy for this business:

BUSINESS: ${projectData.name}
DESCRIPTION: ${projectData.description}
VERTICAL: ${projectData.vertical}
TARGET AUDIENCE: ${JSON.stringify(projectData.targetAudience)}
OBJECTIVES: ${JSON.stringify(projectData.objectives)}

COMPETITOR ANALYSIS:
${competitorInfo}

Generate keywords that:
1. Address the target audience's search intent at every stage of the funnel
2. Exploit gaps where competitors are weak or absent
3. Build topical authority cluster by cluster
4. Include "People Also Ask" style question keywords (great for GEO)
5. Prioritize keywords where the business has unique expertise or differentiation`;
}

// ---------------------------------------------------------------------------
// Blog Post Generation Prompt (with internal linking)
// ---------------------------------------------------------------------------

export function buildBlogPostSystemPrompt(): string {
  return `You are an expert SEO content writer who creates high-quality, comprehensive blog posts optimized for both traditional search engines and AI-powered search (GEO - Generative Engine Optimization).

CRITICAL: You MUST naturally link to existing posts using markdown link syntax. Internal linking is your TOP priority.

Return a valid JSON object:

{
  "title": "SEO-optimized title with target keyword",
  "slug": "url-friendly-slug",
  "metaTitle": "Title tag (50-60 chars, includes keyword)",
  "metaDescription": "Meta description (150-160 chars, compelling, includes keyword)",
  "content": "Full markdown article content with internal links as [anchor text](/blog/slug)",
  "excerpt": "2-3 sentence summary for previews",
  "internalLinks": [
    {"url": "/blog/target-slug", "anchor": "anchor text used", "targetPostId": "post-id-if-known"}
  ],
  "externalLinks": [
    {"url": "https://example.com/source", "anchor": "source description"}
  ],
  "secondaryKeywords": ["keyword1", "keyword2"],
  "seoScore": 85,
  "structuredData": {
    "type": "FAQPage|HowTo|Article",
    "data": {}
  }
}

Content requirements:
- 1500-2500 words
- Proper heading hierarchy: single H1 (the title), H2 for major sections, H3-H4 for subsections
- Include a table of contents at the top
- Every 2-3 paragraphs, find a natural place to link to an existing post
- Include at least one FAQ section with 3-5 questions (Q&A format)
- Include "Key Takeaway" boxes formatted as blockquotes
- Start paragraphs with clear topic sentences (AI citation-friendly)
- Include specific data points, statistics, and numbers
- Use short paragraphs (2-4 sentences) for readability
- Include a compelling introduction with a hook
- End with a clear conclusion and call-to-action
- NO fluffy marketing language - be factually dense and authoritative`;
}

export function buildBlogPostUserPrompt(
  keyword: string,
  existingPosts: ExistingPost[],
  projectContext: ProjectData,
): string {
  const postsContext = existingPosts.length > 0
    ? existingPosts.map((p) =>
        `- Title: "${p.title}" | Slug: /blog/${p.slug} | Keyword: "${p.targetKeyword}" | ID: ${p.id}${p.excerpt ? `\n  Summary: ${p.excerpt}` : ''}`
      ).join('\n')
    : 'No existing posts yet (this is the first post).';

  return `Write a comprehensive SEO blog post targeting the keyword: "${keyword}"

BUSINESS CONTEXT:
- Name: ${projectContext.name}
- Vertical: ${projectContext.vertical}
- Description: ${projectContext.description}
- Audience: ${JSON.stringify(projectContext.targetAudience)}

EXISTING BLOG POSTS (you MUST link to relevant ones naturally):
${postsContext}

INTERNAL LINKING RULES:
${existingPosts.length > 0 ? `
- You MUST include at least ${Math.min(3, existingPosts.length)} internal links to existing posts
- Use varied, descriptive anchor text (not "click here" or the exact title)
- Place links where they add genuine value to the reader
- Link format: [descriptive anchor text](/blog/slug-here)
- Make links feel natural within the content flow
` : '- This is the first post. Focus on creating strong foundational content that future posts can link to.'}

Write the article now. Make it genuinely useful, not generic filler content.`;
}

// ---------------------------------------------------------------------------
// Content Calendar Prompt
// ---------------------------------------------------------------------------

export function buildContentCalendarSystemPrompt(): string {
  return `You are an SEO content strategist creating a 30-day editorial calendar. Your calendar builds topical authority systematically by clustering related posts and establishing progressive internal linking.

Return a valid JSON object:

{
  "calendar": [
    {
      "date": "2026-03-15",
      "keyword": "target keyword for this post",
      "title": "Proposed blog post title",
      "description": "2-3 sentence description of what this post covers",
      "cluster": "thematic cluster name",
      "linksTo": ["slug-of-previous-post-1", "slug-of-previous-post-2"],
      "priority": 8
    }
  ]
}

Calendar strategy:
- 1 post every 2-3 days (10-15 posts in 30 days)
- Group posts by cluster: complete one cluster's core topics before moving to the next
- Within a cluster, start with the broadest "pillar" post, then drill into subtopics
- Each new post MUST reference at least 1-2 earlier posts via linksTo
- Alternate between informational and commercial intent posts
- Schedule higher-priority keywords earlier in the calendar
- Include the date in YYYY-MM-DD format starting from today`;
}

export function buildContentCalendarUserPrompt(
  keywords: KeywordInput[],
  existingPosts: ExistingPost[],
  strategy: CalendarStrategy,
): string {
  const keywordList = keywords
    .sort((a, b) => b.priority - a.priority)
    .map((k) => `- "${k.keyword}" (volume: ${k.searchVolume ?? '?'}, difficulty: ${k.difficulty ?? '?'}, intent: ${k.intent ?? '?'}, cluster: ${k.cluster ?? 'uncategorized'}, priority: ${k.priority})`)
    .join('\n');

  const existingList = existingPosts.length > 0
    ? existingPosts.map((p) => `- "${p.title}" (slug: ${p.slug}, keyword: "${p.targetKeyword}")`).join('\n')
    : 'No existing posts yet.';

  return `Create a 30-day content calendar.

AVAILABLE KEYWORDS (pick the most impactful ones):
${keywordList}

EXISTING POSTS (new posts should link back to these):
${existingList}

STRATEGY:
- Clusters to focus on: ${strategy.clusters.join(', ')}
- Posts per week: ${strategy.postsPerWeek}
${strategy.focusArea ? `- Focus area: ${strategy.focusArea}` : ''}

Start the calendar from today's date. Ensure progressive internal linking: later posts reference earlier posts in the calendar as well as existing posts.`;
}

// ---------------------------------------------------------------------------
// GEO Optimization Prompt
// ---------------------------------------------------------------------------

export function buildGeoOptimizationSystemPrompt(): string {
  return `You are a GEO (Generative Engine Optimization) specialist. Your job is to optimize content so that AI systems (ChatGPT, Perplexity, Google AI Overviews, Claude) are more likely to cite it in their responses.

Return a valid JSON object:

{
  "optimizedContent": "Full optimized markdown content",
  "geoScore": 85,
  "changes": [
    {"type": "added_faq", "description": "Added FAQ section with 5 questions"},
    {"type": "added_key_takeaway", "description": "Added key takeaway box after section 2"},
    {"type": "improved_topic_sentence", "description": "Rewrote paragraph 3 opening for clarity"},
    {"type": "added_statistic", "description": "Added data point about market size"},
    {"type": "added_structured_data", "description": "Added FAQPage schema suggestion"}
  ],
  "recommendations": [
    "Add more specific numerical data points",
    "Include expert quotes or citations"
  ],
  "structuredDataSuggestions": [
    {
      "type": "FAQPage",
      "data": {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": []}
    }
  ]
}

GEO optimization principles:
1. FACTUAL DENSITY: Every paragraph should contain at least one specific fact, number, or data point
2. CLEAR Q&A: Add FAQ sections because AI loves citing direct Q&A pairs
3. TOPIC SENTENCES: Each paragraph must start with a clear, self-contained statement that could be quoted
4. KEY TAKEAWAYS: Add summary boxes that distill complex information into quotable nuggets
5. STRUCTURED FORMAT: Use tables, lists, and clear headings that AI can parse
6. AUTHORITATIVE TONE: Write as an expert, not a marketer. Be definitive, not hedging
7. SCHEMA.ORG: Suggest appropriate structured data markup
8. CONCISENESS: Remove fluff. Every sentence must earn its place
9. CITATIONS: Reference specific sources, studies, or data origins
10. DEFINITIONAL: Include clear definitions for key terms (AI often quotes definitions)`;
}

export function buildGeoOptimizationUserPrompt(article: {
  title: string;
  content: string;
  targetKeyword: string;
}): string {
  return `Optimize this article for GEO (Generative Engine Optimization):

TITLE: ${article.title}
TARGET KEYWORD: ${article.targetKeyword}

CURRENT CONTENT:
${article.content}

Optimize this content so AI systems will cite it. Keep the core message and internal links intact, but:
1. Add an FAQ section if one doesn't exist (at least 4 questions)
2. Add "Key Takeaway" blockquotes after major sections
3. Strengthen topic sentences to be self-contained, quotable statements
4. Add specific data points and statistics where claims are vague
5. Suggest schema.org structured data
6. Remove any fluffy or redundant language
7. Ensure every paragraph could stand alone as a cited snippet`;
}

// ---------------------------------------------------------------------------
// Internal Linking Analysis Prompt
// ---------------------------------------------------------------------------

export function buildInternalLinkingSystemPrompt(): string {
  return `You are an internal linking specialist. Your job is to analyze content and suggest the most relevant, natural internal links between blog posts. Great internal linking improves SEO, reduces bounce rate, and builds topical authority.

Return a valid JSON object:

{
  "outgoingLinks": [
    {
      "targetSlug": "slug-of-target-post",
      "anchorText": "descriptive anchor text to use",
      "insertAfterParagraph": 3,
      "relevanceScore": 0.9,
      "rationale": "Why this link makes sense here"
    }
  ],
  "incomingLinks": [
    {
      "sourceSlug": "slug-of-source-post",
      "anchorText": "anchor text to add in the source post",
      "insertAfterParagraph": 5,
      "relevanceScore": 0.85,
      "rationale": "Why the source post should link to this new post"
    }
  ]
}

Linking guidelines:
- Anchor text should be descriptive (2-5 words), not exact match keyword stuffing
- Only suggest links where there's genuine topical relevance (relevanceScore > 0.6)
- Aim for 3-5 outgoing links and 2-4 incoming links per new post
- Distribute links throughout the content, not clustered in one area
- Avoid linking from the introduction or conclusion paragraphs
- insertAfterParagraph is 1-based (paragraph 1 = first paragraph after H1)
- Prioritize posts in the same thematic cluster`;
}

export function buildInternalLinkingUserPrompt(
  newPost: ExistingPost & { content?: string },
  allExistingPosts: ExistingPost[],
): string {
  const newPostInfo = `NEW POST:
- Title: "${newPost.title}"
- Slug: ${newPost.slug}
- Keyword: "${newPost.targetKeyword}"
- Secondary keywords: ${newPost.secondaryKeywords?.join(', ') || 'none'}
${newPost.content ? `- Content preview (first 1000 chars): ${newPost.content.slice(0, 1000)}...` : ''}`;

  const existingInfo = allExistingPosts
    .filter((p) => p.id !== newPost.id)
    .map((p) =>
      `- "${p.title}" (slug: ${p.slug}, keyword: "${p.targetKeyword}"${p.secondaryKeywords?.length ? `, also covers: ${p.secondaryKeywords.join(', ')}` : ''}${p.excerpt ? `, summary: ${p.excerpt}` : ''})`
    )
    .join('\n');

  return `Analyze and suggest internal links:

${newPostInfo}

ALL EXISTING POSTS:
${existingInfo || 'No other posts exist yet.'}

For outgoing links: Where in the new post should we link to existing posts?
For incoming links: Which existing posts should be updated to link to this new post?

Only suggest high-relevance links that add genuine value for the reader.`;
}
