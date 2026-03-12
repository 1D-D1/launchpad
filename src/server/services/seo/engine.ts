/**
 * SEO Engine Service.
 * Orchestrates keyword research, blog post generation with internal linking,
 * content calendars, GEO optimization, and SEO audits.
 */

import { prisma } from '@/server/db/prisma';
import { generateJSON } from '@/server/services/ai/claude';
import {
  buildKeywordResearchSystemPrompt,
  buildKeywordResearchUserPrompt,
  buildBlogPostSystemPrompt,
  buildBlogPostUserPrompt,
  buildContentCalendarSystemPrompt,
  buildContentCalendarUserPrompt,
  buildGeoOptimizationSystemPrompt,
  buildGeoOptimizationUserPrompt,
  type ProjectData,
  type CompetitiveAnalysisData,
  type ExistingPost,
  type KeywordInput,
} from '@/server/services/ai/prompts/seo';
import { internalLinker, type PostSummary } from './internal-linker';
import { logger } from '@/lib/logger';

const log = logger.child({ service: 'seo-engine' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeywordResearchResult {
  keywords: Array<{
    keyword: string;
    searchVolume: number;
    difficulty: number;
    intent: string;
    cluster: string;
    priority: number;
    rationale: string;
  }>;
}

interface BlogPostResult {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  excerpt: string;
  internalLinks: Array<{ url: string; anchor: string; targetPostId?: string }>;
  externalLinks: Array<{ url: string; anchor: string }>;
  secondaryKeywords: string[];
  seoScore: number;
  structuredData?: unknown;
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

interface ContentCalendarResult {
  calendar: CalendarEntry[];
}

interface GeoOptimizationResult {
  optimizedContent: string;
  geoScore: number;
  changes: Array<{ type: string; description: string }>;
  recommendations: string[];
  structuredDataSuggestions?: unknown[];
}

export type { CalendarEntry };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function estimateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 250));
}

async function getProjectData(projectId: string): Promise<ProjectData> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      vertical: true,
      targetAudience: true,
      objectives: true,
    },
  });

  return {
    name: project.name,
    description: project.description,
    vertical: project.vertical,
    targetAudience: project.targetAudience,
    objectives: project.objectives,
  };
}

async function getCompetitiveData(projectId: string): Promise<CompetitiveAnalysisData[]> {
  const analyses = await prisma.competitiveAnalysis.findMany({
    where: { projectId },
    select: {
      competitorName: true,
      competitorUrl: true,
      strengths: true,
      weaknesses: true,
      serpData: true,
    },
  });

  return analyses.map((a) => ({
    competitorName: a.competitorName,
    competitorUrl: a.competitorUrl ?? undefined,
    strengths: a.strengths ?? undefined,
    weaknesses: a.weaknesses ?? undefined,
    serpData: a.serpData ?? undefined,
  }));
}

function postsToExisting(posts: PostSummary[]): ExistingPost[] {
  return posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    targetKeyword: p.targetKeyword,
    excerpt: p.excerpt ?? undefined,
    secondaryKeywords: p.secondaryKeywords,
  }));
}

// ---------------------------------------------------------------------------
// SEO Engine
// ---------------------------------------------------------------------------

export class SeoEngine {
  /**
   * Generate a keyword strategy from project data and competitive analysis.
   */
  async generateKeywordStrategy(projectId: string) {
    log.info({ projectId }, 'Generating keyword strategy');

    const projectData = await getProjectData(projectId);
    const competitiveData = await getCompetitiveData(projectId);

    const result = await generateJSON<KeywordResearchResult>(
      buildKeywordResearchSystemPrompt(),
      buildKeywordResearchUserPrompt(projectData, competitiveData),
      8192,
    );

    // Upsert keywords into the database
    const created = [];
    for (const kw of result.keywords) {
      const record = await prisma.keywordStrategy.upsert({
        where: {
          projectId_keyword: { projectId, keyword: kw.keyword },
        },
        update: {
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
          intent: kw.intent,
          cluster: kw.cluster,
          priority: kw.priority,
        },
        create: {
          projectId,
          keyword: kw.keyword,
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
          intent: kw.intent,
          cluster: kw.cluster,
          priority: kw.priority,
        },
      });
      created.push(record);
    }

    log.info({ projectId, keywordsCount: created.length }, 'Keyword strategy generated');
    return created;
  }

  /**
   * Generate a single blog post targeting a keyword, with intelligent internal linking.
   */
  async generateBlogPost(projectId: string, keyword: string) {
    log.info({ projectId, keyword }, 'Generating blog post');

    const projectData = await getProjectData(projectId);
    const existingPosts = await internalLinker.getExistingPosts(projectId);

    // Generate the article via Claude
    const result = await generateJSON<BlogPostResult>(
      buildBlogPostSystemPrompt(),
      buildBlogPostUserPrompt(keyword, postsToExisting(existingPosts), projectData),
      8192,
    );

    // Run internal linker to ensure/enhance links
    const { content: linkedContent, links: insertedLinks } = await internalLinker.addInternalLinks(
      result.content,
      existingPosts,
      {
        title: result.title,
        slug: result.slug,
        targetKeyword: keyword,
        secondaryKeywords: result.secondaryKeywords,
      },
    );

    // Merge AI-generated links with linker-inserted links
    const allInternalLinks = [
      ...(result.internalLinks || []),
      ...insertedLinks,
    ];

    // Deduplicate by URL
    const uniqueLinks = Array.from(
      new Map(allInternalLinks.map((l) => [l.url, l])).values(),
    );

    const wordCount = countWords(linkedContent);

    // Store the blog post
    const blogPost = await prisma.blogPost.create({
      data: {
        projectId,
        title: result.title,
        slug: result.slug,
        metaTitle: result.metaTitle,
        metaDescription: result.metaDescription,
        content: linkedContent,
        excerpt: result.excerpt,
        targetKeyword: keyword,
        secondaryKeywords: result.secondaryKeywords,
        internalLinks: uniqueLinks as unknown as object[],
        externalLinks: (result.externalLinks || []) as unknown as object[],
        wordCount,
        readingTime: estimateReadingTime(wordCount),
        seoScore: result.seoScore ?? null,
        status: 'DRAFT',
      },
    });

    // Mark the keyword as assigned
    await prisma.keywordStrategy.updateMany({
      where: { projectId, keyword },
      data: { assignedPostId: blogPost.id },
    });

    // Update backlinks in existing posts (they now link to the new post)
    const newPostSummary: PostSummary = {
      id: blogPost.id,
      slug: blogPost.slug,
      title: blogPost.title,
      targetKeyword: blogPost.targetKeyword,
      excerpt: blogPost.excerpt,
      secondaryKeywords: result.secondaryKeywords || [],
    };
    await internalLinker.updateBacklinks(newPostSummary, existingPosts);

    log.info(
      {
        projectId,
        postId: blogPost.id,
        slug: blogPost.slug,
        wordCount,
        internalLinks: uniqueLinks.length,
      },
      'Blog post generated with internal linking',
    );

    return blogPost;
  }

  /**
   * Generate a 30-day content calendar based on keyword strategy.
   */
  async generateContentCalendar(projectId: string): Promise<CalendarEntry[]> {
    log.info({ projectId }, 'Generating content calendar');

    const keywords = await prisma.keywordStrategy.findMany({
      where: { projectId, assignedPostId: null },
      orderBy: { priority: 'desc' },
    });

    if (keywords.length === 0) {
      log.warn({ projectId }, 'No unassigned keywords found for calendar');
      return [];
    }

    const existingPosts = await internalLinker.getExistingPosts(projectId);

    const keywordInputs: KeywordInput[] = keywords.map((k) => ({
      keyword: k.keyword,
      searchVolume: k.searchVolume ?? undefined,
      difficulty: k.difficulty ?? undefined,
      intent: k.intent ?? undefined,
      cluster: k.cluster ?? undefined,
      priority: k.priority,
    }));

    const clusters = [...new Set(keywords.map((k) => k.cluster).filter(Boolean))] as string[];

    const result = await generateJSON<ContentCalendarResult>(
      buildContentCalendarSystemPrompt(),
      buildContentCalendarUserPrompt(keywordInputs, postsToExisting(existingPosts), {
        clusters,
        postsPerWeek: 3,
      }),
      8192,
    );

    log.info({ projectId, entries: result.calendar.length }, 'Content calendar generated');
    return result.calendar;
  }

  /**
   * Optimize an existing blog post for GEO (Generative Engine Optimization).
   */
  async optimizeForGeo(postId: string) {
    log.info({ postId }, 'Optimizing post for GEO');

    const post = await prisma.blogPost.findUniqueOrThrow({
      where: { id: postId },
    });

    const result = await generateJSON<GeoOptimizationResult>(
      buildGeoOptimizationSystemPrompt(),
      buildGeoOptimizationUserPrompt({
        title: post.title,
        content: post.content,
        targetKeyword: post.targetKeyword,
      }),
      8192,
    );

    const wordCount = countWords(result.optimizedContent);

    const updatedPost = await prisma.blogPost.update({
      where: { id: postId },
      data: {
        content: result.optimizedContent,
        geoScore: result.geoScore,
        wordCount,
        readingTime: estimateReadingTime(wordCount),
      },
    });

    log.info(
      { postId, geoScore: result.geoScore, changes: result.changes.length },
      'GEO optimization completed',
    );

    return updatedPost;
  }

  /**
   * Recalculate and refresh internal links across all posts for a project.
   */
  async recalculateInternalLinks(projectId: string): Promise<void> {
    log.info({ projectId }, 'Recalculating internal links');

    const posts = await prisma.blogPost.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    if (posts.length < 2) {
      log.info({ projectId }, 'Not enough posts to recalculate links');
      return;
    }

    const allPostSummaries: PostSummary[] = posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      targetKeyword: p.targetKeyword,
      excerpt: p.excerpt,
      secondaryKeywords: Array.isArray(p.secondaryKeywords)
        ? (p.secondaryKeywords as string[])
        : [],
    }));

    // For each post, re-run the internal linker
    for (const post of posts) {
      const otherPosts = allPostSummaries.filter((p) => p.id !== post.id);

      const { content: linkedContent, links } = await internalLinker.addInternalLinks(
        post.content,
        otherPosts,
        {
          title: post.title,
          slug: post.slug,
          targetKeyword: post.targetKeyword,
          secondaryKeywords: Array.isArray(post.secondaryKeywords)
            ? (post.secondaryKeywords as string[])
            : [],
        },
      );

      if (links.length > 0) {
        const existingLinks = Array.isArray(post.internalLinks)
          ? (post.internalLinks as Array<{ url: string; anchor: string; targetPostId?: string }>)
          : [];

        const mergedLinks = [...existingLinks, ...links];
        const uniqueLinks = Array.from(
          new Map(mergedLinks.map((l) => [l.url, l])).values(),
        );

        await prisma.blogPost.update({
          where: { id: post.id },
          data: {
            content: linkedContent,
            internalLinks: uniqueLinks as unknown as object[],
          },
        });
      }
    }

    log.info({ projectId, postsProcessed: posts.length }, 'Internal links recalculated');
  }

  /**
   * Run a full SEO audit for a project.
   */
  async runAudit(projectId: string) {
    log.info({ projectId }, 'Running SEO audit');

    const [posts, keywords, linkScore] = await Promise.all([
      prisma.blogPost.findMany({ where: { projectId } }),
      prisma.keywordStrategy.findMany({ where: { projectId } }),
      internalLinker.calculateLinkScore(projectId),
    ]);

    const totalKeywords = keywords.length;
    const assignedKeywords = keywords.filter((k) => k.assignedPostId).length;
    const contentCoverage = totalKeywords > 0
      ? Math.round((assignedKeywords / totalKeywords) * 100)
      : 0;

    // Calculate average SEO and GEO scores
    const seoScores = posts.map((p) => p.seoScore).filter((s): s is number => s !== null);
    const geoScores = posts.map((p) => p.geoScore).filter((s): s is number => s !== null);

    const avgSeoScore = seoScores.length > 0
      ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length)
      : 0;
    const avgGeoScore = geoScores.length > 0
      ? Math.round(geoScores.reduce((a, b) => a + b, 0) / geoScores.length)
      : 0;

    // Generate recommendations
    const recommendations: string[] = [];

    if (posts.length === 0) {
      recommendations.push('No blog posts yet. Generate your first post from the keyword strategy.');
    }

    if (totalKeywords === 0) {
      recommendations.push('No keyword strategy found. Run keyword research to get started.');
    } else if (contentCoverage < 30) {
      recommendations.push(`Only ${contentCoverage}% of keywords have assigned posts. Generate more content to increase coverage.`);
    }

    if (linkScore < 50) {
      recommendations.push('Internal link score is low. Run "Recalculate Internal Links" to improve link structure.');
    }

    if (avgGeoScore < 60 && geoScores.length > 0) {
      recommendations.push('GEO readiness is below 60. Optimize existing posts for Generative Engine Optimization.');
    }

    const postsWithoutGeo = posts.filter((p) => p.geoScore === null);
    if (postsWithoutGeo.length > 0) {
      recommendations.push(`${postsWithoutGeo.length} posts have not been GEO-optimized yet.`);
    }

    const avgWordCount = posts.length > 0
      ? Math.round(posts.reduce((a, p) => a + p.wordCount, 0) / posts.length)
      : 0;

    if (avgWordCount > 0 && avgWordCount < 1500) {
      recommendations.push('Average word count is below 1500. Longer, more comprehensive content tends to rank better.');
    }

    // Overall score: weighted average of all sub-scores
    const overallScore = Math.round(
      avgSeoScore * 0.3 +
      avgGeoScore * 0.2 +
      linkScore * 0.25 +
      contentCoverage * 0.25,
    );

    const audit = await prisma.seoAudit.create({
      data: {
        projectId,
        overallScore,
        geoReadiness: avgGeoScore,
        internalLinkScore: linkScore,
        contentCoverage,
        recommendations: recommendations,
        details: {
          totalPosts: posts.length,
          totalKeywords,
          assignedKeywords,
          avgSeoScore,
          avgGeoScore,
          avgWordCount,
          linkScore,
          postsWithoutGeo: postsWithoutGeo.length,
        },
      },
    });

    log.info(
      { projectId, overallScore, geoReadiness: avgGeoScore, linkScore, contentCoverage },
      'SEO audit completed',
    );

    return audit;
  }

  /**
   * Generate a batch of blog posts from the keyword strategy.
   */
  async generateBatch(projectId: string, count: number) {
    log.info({ projectId, count }, 'Generating batch of blog posts');

    // Get next priority keywords that don't have posts yet
    const keywords = await prisma.keywordStrategy.findMany({
      where: { projectId, assignedPostId: null },
      orderBy: { priority: 'desc' },
      take: count,
    });

    if (keywords.length === 0) {
      log.warn({ projectId }, 'No unassigned keywords available for batch generation');
      return [];
    }

    const posts = [];

    // Generate sequentially so each new post can link to the previously generated ones
    for (const kw of keywords) {
      try {
        const post = await this.generateBlogPost(projectId, kw.keyword);
        posts.push(post);
        log.info({ keyword: kw.keyword, postId: post.id }, 'Batch post generated');
      } catch (err) {
        log.error({ keyword: kw.keyword, err }, 'Failed to generate batch post, continuing');
      }
    }

    log.info({ projectId, generated: posts.length, requested: count }, 'Batch generation completed');
    return posts;
  }
}

export const seoEngine = new SeoEngine();
