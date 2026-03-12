/**
 * SEO tRPC router.
 * Exposes keyword research, blog post generation, content calendar,
 * GEO optimization, and SEO audit endpoints.
 */

import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';
import { seoEngine } from '@/server/services/seo/engine';

const contentStatusEnum = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'FAILED',
]);

export const seoRouter = router({
  // -----------------------------------------------------------------------
  // Keywords
  // -----------------------------------------------------------------------

  getKeywords: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        cluster: z.string().optional(),
        intent: z.string().optional(),
        unassignedOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return ctx.prisma.keywordStrategy.findMany({
        where: {
          projectId: input.projectId,
          ...(input.cluster && { cluster: input.cluster }),
          ...(input.intent && { intent: input.intent }),
          ...(input.unassignedOnly && { assignedPostId: null }),
        },
        orderBy: { priority: 'desc' },
      });
    }),

  generateKeywords: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const keywords = await seoEngine.generateKeywordStrategy(input.projectId);
      return { keywords, count: keywords.length };
    }),

  // -----------------------------------------------------------------------
  // Blog Posts
  // -----------------------------------------------------------------------

  getBlogPosts: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: contentStatusEnum.optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const posts = await ctx.prisma.blogPost.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status && { status: input.status }),
        },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (posts.length > input.limit) {
        const next = posts.pop()!;
        nextCursor = next.id;
      }

      return { posts, nextCursor };
    }),

  getBlogPost: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.blogPost.findUnique({
        where: { id: input.id },
        include: { project: { select: { id: true, name: true, userId: true } } },
      });

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Blog post not found' });
      }
      if (post.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return post;
    }),

  generatePost: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        keyword: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return seoEngine.generateBlogPost(input.projectId, input.keyword);
    }),

  generateBatch: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        count: z.number().min(1).max(10).default(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const posts = await seoEngine.generateBatch(input.projectId, input.count);
      return { posts, count: posts.length };
    }),

  // -----------------------------------------------------------------------
  // GEO Optimization
  // -----------------------------------------------------------------------

  optimizeForGeo: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.blogPost.findUnique({
        where: { id: input.postId },
        include: { project: { select: { userId: true } } },
      });

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Blog post not found' });
      }
      if (post.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return seoEngine.optimizeForGeo(input.postId);
    }),

  // -----------------------------------------------------------------------
  // Content Calendar
  // -----------------------------------------------------------------------

  getContentCalendar: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const calendar = await seoEngine.generateContentCalendar(input.projectId);
      return { calendar };
    }),

  // -----------------------------------------------------------------------
  // SEO Audit
  // -----------------------------------------------------------------------

  runAudit: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return seoEngine.runAudit(input.projectId);
    }),

  getAudit: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return ctx.prisma.seoAudit.findFirst({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  // -----------------------------------------------------------------------
  // Publish / Schedule
  // -----------------------------------------------------------------------

  publishPost: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.blogPost.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Blog post not found' });
      }
      if (post.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return ctx.prisma.blogPost.update({
        where: { id: input.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
    }),

  schedulePost: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.blogPost.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });

      if (!post) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Blog post not found' });
      }
      if (post.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return ctx.prisma.blogPost.update({
        where: { id: input.id },
        data: {
          status: 'SCHEDULED',
          scheduledAt: new Date(input.scheduledAt),
        },
      });
    }),
});
