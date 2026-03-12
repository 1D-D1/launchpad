/**
 * Internal Linker Service.
 * Manages internal linking between blog posts - the core differentiator.
 * Every generated post MUST reference existing posts for topical authority.
 */

import { prisma } from '@/server/db/prisma';
import { generateJSON } from '@/server/services/ai/claude';
import {
  buildInternalLinkingSystemPrompt,
  buildInternalLinkingUserPrompt,
  type ExistingPost,
} from '@/server/services/ai/prompts/seo';
import { logger } from '@/lib/logger';

const log = logger.child({ service: 'internal-linker' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  targetKeyword: string;
  excerpt: string | null;
  secondaryKeywords: string[];
  content?: string;
}

export interface InternalLink {
  url: string;
  anchor: string;
  targetPostId?: string;
}

export interface LinkSuggestion {
  targetSlug: string;
  anchorText: string;
  insertAfterParagraph: number;
  relevanceScore: number;
  rationale: string;
}

export interface BacklinkUpdate {
  sourcePostId: string;
  sourceSlug: string;
  anchorText: string;
  insertAfterParagraph: number;
}

interface LinkAnalysisResult {
  outgoingLinks: LinkSuggestion[];
  incomingLinks: Array<{
    sourceSlug: string;
    anchorText: string;
    insertAfterParagraph: number;
    relevanceScore: number;
    rationale: string;
  }>;
}

// ---------------------------------------------------------------------------
// Internal Linker
// ---------------------------------------------------------------------------

export class InternalLinker {
  /**
   * Fetch all published/draft blog posts for a project (summaries only).
   */
  async getExistingPosts(projectId: string): Promise<PostSummary[]> {
    const posts = await prisma.blogPost.findMany({
      where: { projectId },
      select: {
        id: true,
        slug: true,
        title: true,
        targetKeyword: true,
        excerpt: true,
        secondaryKeywords: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return posts.map((p) => ({
      ...p,
      secondaryKeywords: Array.isArray(p.secondaryKeywords)
        ? (p.secondaryKeywords as string[])
        : [],
    }));
  }

  /**
   * Analyze a new post and insert internal links into its content.
   * Returns the updated content with links embedded and the link metadata.
   */
  async addInternalLinks(
    content: string,
    existingPosts: PostSummary[],
    newPostMeta: { title: string; slug: string; targetKeyword: string; secondaryKeywords?: string[] },
  ): Promise<{ content: string; links: InternalLink[] }> {
    if (existingPosts.length === 0) {
      log.info('No existing posts to link to, returning content as-is');
      return { content, links: [] };
    }

    const existingPostsForPrompt: ExistingPost[] = existingPosts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      targetKeyword: p.targetKeyword,
      excerpt: p.excerpt ?? undefined,
      secondaryKeywords: p.secondaryKeywords,
    }));

    const analysis = await generateJSON<LinkAnalysisResult>(
      buildInternalLinkingSystemPrompt(),
      buildInternalLinkingUserPrompt(
        {
          id: 'new-post',
          slug: newPostMeta.slug,
          title: newPostMeta.title,
          targetKeyword: newPostMeta.targetKeyword,
          secondaryKeywords: newPostMeta.secondaryKeywords,
          content,
        },
        existingPostsForPrompt,
      ),
      4096,
    );

    // Insert outgoing links into the content
    let linkedContent = content;
    const insertedLinks: InternalLink[] = [];

    // Sort by paragraph index descending so insertions don't shift later indices
    const sortedLinks = [...(analysis.outgoingLinks || [])].sort(
      (a, b) => b.insertAfterParagraph - a.insertAfterParagraph,
    );

    const paragraphs = linkedContent.split('\n\n');

    for (const link of sortedLinks) {
      if (link.insertAfterParagraph < 1 || link.insertAfterParagraph > paragraphs.length) {
        continue;
      }

      const targetPost = existingPosts.find((p) => p.slug === link.targetSlug);
      if (!targetPost) continue;

      const linkUrl = `/blog/${link.targetSlug}`;
      const markdownLink = `[${link.anchorText}](${linkUrl})`;

      // Check if the paragraph already contains a link to this slug
      const paraIdx = link.insertAfterParagraph - 1;
      if (paragraphs[paraIdx] && !paragraphs[paraIdx].includes(linkUrl)) {
        // Append a contextual sentence with the link at the end of the paragraph
        paragraphs[paraIdx] = `${paragraphs[paraIdx]} For more details, see our guide on ${markdownLink}.`;
        insertedLinks.push({
          url: linkUrl,
          anchor: link.anchorText,
          targetPostId: targetPost.id,
        });
      }
    }

    linkedContent = paragraphs.join('\n\n');

    log.info(
      { linksInserted: insertedLinks.length, totalSuggested: analysis.outgoingLinks?.length ?? 0 },
      'Internal links added to new post',
    );

    return { content: linkedContent, links: insertedLinks };
  }

  /**
   * Determine which existing posts should link BACK to the new post.
   * Returns update instructions for each source post.
   */
  async updateBacklinks(
    newPost: PostSummary,
    existingPosts: PostSummary[],
  ): Promise<BacklinkUpdate[]> {
    if (existingPosts.length === 0) return [];

    const existingPostsForPrompt: ExistingPost[] = existingPosts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      targetKeyword: p.targetKeyword,
      excerpt: p.excerpt ?? undefined,
      secondaryKeywords: p.secondaryKeywords,
    }));

    const analysis = await generateJSON<LinkAnalysisResult>(
      buildInternalLinkingSystemPrompt(),
      buildInternalLinkingUserPrompt(
        {
          id: newPost.id,
          slug: newPost.slug,
          title: newPost.title,
          targetKeyword: newPost.targetKeyword,
          secondaryKeywords: newPost.secondaryKeywords,
        },
        existingPostsForPrompt,
      ),
      4096,
    );

    const backlinks: BacklinkUpdate[] = [];

    for (const incoming of analysis.incomingLinks || []) {
      const sourcePost = existingPosts.find((p) => p.slug === incoming.sourceSlug);
      if (!sourcePost) continue;

      // Update the source post's content in the DB
      const fullSourcePost = await prisma.blogPost.findUnique({
        where: { id: sourcePost.id },
        select: { id: true, content: true, internalLinks: true },
      });

      if (!fullSourcePost) continue;

      const linkUrl = `/blog/${newPost.slug}`;
      // Skip if source post already links to the new post
      if (fullSourcePost.content.includes(linkUrl)) continue;

      const paragraphs = fullSourcePost.content.split('\n\n');
      const paraIdx = incoming.insertAfterParagraph - 1;

      if (paraIdx >= 0 && paraIdx < paragraphs.length) {
        const markdownLink = `[${incoming.anchorText}](${linkUrl})`;
        paragraphs[paraIdx] = `${paragraphs[paraIdx]} You might also find ${markdownLink} helpful.`;

        const updatedContent = paragraphs.join('\n\n');

        // Update existing internalLinks metadata
        const existingLinks: InternalLink[] = Array.isArray(fullSourcePost.internalLinks)
          ? (fullSourcePost.internalLinks as unknown as InternalLink[])
          : [];

        existingLinks.push({
          url: linkUrl,
          anchor: incoming.anchorText,
          targetPostId: newPost.id,
        });

        await prisma.blogPost.update({
          where: { id: sourcePost.id },
          data: {
            content: updatedContent,
            internalLinks: existingLinks as unknown as object[],
          },
        });

        backlinks.push({
          sourcePostId: sourcePost.id,
          sourceSlug: sourcePost.slug,
          anchorText: incoming.anchorText,
          insertAfterParagraph: incoming.insertAfterParagraph,
        });
      }
    }

    log.info(
      { backlinksCreated: backlinks.length },
      'Backlinks updated in existing posts',
    );

    return backlinks;
  }

  /**
   * Calculate the internal link health score for a project.
   * Score based on: average links per post, orphan pages, link reciprocity.
   */
  async calculateLinkScore(projectId: string): Promise<number> {
    const posts = await prisma.blogPost.findMany({
      where: { projectId },
      select: { id: true, internalLinks: true, content: true },
    });

    if (posts.length === 0) return 0;
    if (posts.length === 1) return 50; // Single post can't have internal links

    let totalOutgoingLinks = 0;
    let postsWithLinks = 0;
    const linkedToSet = new Set<string>();

    for (const post of posts) {
      const links: InternalLink[] = Array.isArray(post.internalLinks)
        ? (post.internalLinks as unknown as InternalLink[])
        : [];

      if (links.length > 0) {
        postsWithLinks++;
        totalOutgoingLinks += links.length;
        for (const link of links) {
          if (link.targetPostId) linkedToSet.add(link.targetPostId);
        }
      }
    }

    const avgLinksPerPost = totalOutgoingLinks / posts.length;
    const percentWithLinks = postsWithLinks / posts.length;
    const percentLinkedTo = linkedToSet.size / posts.length;

    // Score components (weighted):
    // - avgLinksPerPost: ideal is 3-5 (30 points max)
    // - percentWithLinks: ideal is 100% (35 points max)
    // - percentLinkedTo: ideal is 100% (35 points max)

    const avgScore = Math.min(avgLinksPerPost / 4, 1) * 30;
    const withLinksScore = percentWithLinks * 35;
    const linkedToScore = percentLinkedTo * 35;

    return Math.round(avgScore + withLinksScore + linkedToScore);
  }
}

export const internalLinker = new InternalLinker();
