import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';
import { socialContentEngine } from '@/server/services/social/content-engine';
import type { Context } from '../context';

const platformEnum = z.enum([
  'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'TIKTOK', 'GOOGLE', 'EMAIL',
]);
const socialPostTypeEnum = z.enum([
  'SINGLE_IMAGE', 'CAROUSEL', 'INFOGRAPHIC', 'TEXT_ONLY', 'VIDEO_SCRIPT', 'STORY', 'REEL_SCRIPT',
]);
const contentStatusEnum = z.enum([
  'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED',
]);

/** Verify project ownership or admin role, return the project. */
async function verifyProjectAccess(
  ctx: Context & { user: { id: string } },
  projectId: string,
) {
  const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  if (project.userId !== ctx.user.id) requireRole(ctx, 'ADMIN');
  return project;
}

export const socialRouter = router({
  // -------------------------------------------------------------------------
  // listPosts — list social posts by project, platform, type, status
  // -------------------------------------------------------------------------
  listPosts: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        platform: platformEnum.optional(),
        postType: socialPostTypeEnum.optional(),
        status: contentStatusEnum.optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { projectId, platform, postType, status, limit, cursor } = input;
      await verifyProjectAccess(ctx, projectId);

      const posts = await ctx.prisma.socialPost.findMany({
        where: {
          projectId,
          ...(platform && { platform }),
          ...(postType && { postType }),
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (posts.length > limit) {
        const next = posts.pop()!;
        nextCursor = next.id;
      }

      return { posts, nextCursor };
    }),

  // -------------------------------------------------------------------------
  // getPost — get a single social post
  // -------------------------------------------------------------------------
  getPost: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.socialPost.findUnique({
        where: { id: input.id },
        include: { project: { select: { id: true, name: true, userId: true } } },
      });
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      if (post.project.userId !== ctx.user.id) requireRole(ctx, 'ADMIN');
      return post;
    }),

  // -------------------------------------------------------------------------
  // generateCarousel
  // -------------------------------------------------------------------------
  generateCarousel: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        topic: z.string().min(1).max(500),
        platform: platformEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyProjectAccess(ctx, input.projectId);
      const post = await socialContentEngine.generateCarousel(
        input.projectId,
        input.topic,
        input.platform,
      );
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'GENERATE_CAROUSEL',
          resource: `socialPost:${post.id}`,
          details: { topic: input.topic, platform: input.platform },
          ip: ctx.ip,
        },
      });
      return post;
    }),

  // -------------------------------------------------------------------------
  // generateInfographic
  // -------------------------------------------------------------------------
  generateInfographic: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        topic: z.string().min(1).max(500),
        data: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyProjectAccess(ctx, input.projectId);
      const post = await socialContentEngine.generateInfographic(
        input.projectId,
        input.topic,
        input.data,
      );
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'GENERATE_INFOGRAPHIC',
          resource: `socialPost:${post.id}`,
          details: { topic: input.topic },
          ip: ctx.ip,
        },
      });
      return post;
    }),

  // -------------------------------------------------------------------------
  // generateWeekly — generate full week of content
  // -------------------------------------------------------------------------
  generateWeekly: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        platforms: z.array(platformEnum).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyProjectAccess(ctx, input.projectId);
      const posts = await socialContentEngine.generateWeeklyContent(
        input.projectId,
        input.platforms,
      );
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'GENERATE_WEEKLY_CONTENT',
          resource: `project:${input.projectId}`,
          details: { platforms: input.platforms, postCount: posts.length },
          ip: ctx.ip,
        },
      });
      return posts;
    }),

  // -------------------------------------------------------------------------
  // adaptPost — adapt post to another platform
  // -------------------------------------------------------------------------
  adaptPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        targetPlatform: platformEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access through the post's project
      const source = await ctx.prisma.socialPost.findUnique({
        where: { id: input.postId },
        include: { project: { select: { userId: true } } },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      if (source.project.userId !== ctx.user.id) requireRole(ctx, 'ADMIN');

      return socialContentEngine.adaptToPlatform(input.postId, input.targetPlatform);
    }),

  // -------------------------------------------------------------------------
  // generateVariant — A/B variant
  // -------------------------------------------------------------------------
  generateVariant: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.socialPost.findUnique({
        where: { id: input.postId },
        include: { project: { select: { userId: true } } },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      if (source.project.userId !== ctx.user.id) requireRole(ctx, 'ADMIN');

      return socialContentEngine.generateVariant(input.postId);
    }),

  // -------------------------------------------------------------------------
  // approvePost — approve for publishing
  // -------------------------------------------------------------------------
  approvePost: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.socialPost.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      if (post.project.userId !== ctx.user.id) requireRole(ctx, 'ADMIN');
      if (!['DRAFT', 'PENDING_REVIEW'].includes(post.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Post must be in DRAFT or PENDING_REVIEW status to approve',
        });
      }

      const updated = await ctx.prisma.socialPost.update({
        where: { id: input.id },
        data: { status: 'APPROVED' },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'APPROVE_SOCIAL_POST',
          resource: `socialPost:${input.id}`,
          ip: ctx.ip,
        },
      });

      return updated;
    }),

  // -------------------------------------------------------------------------
  // schedulePost — schedule with datetime
  // -------------------------------------------------------------------------
  schedulePost: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.socialPost.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      if (post.project.userId !== ctx.user.id) requireRole(ctx, 'ADMIN');

      return ctx.prisma.socialPost.update({
        where: { id: input.id },
        data: {
          scheduledAt: new Date(input.scheduledAt),
          status: 'SCHEDULED',
        },
      });
    }),

  // -------------------------------------------------------------------------
  // bulkApprove — approve multiple posts
  // -------------------------------------------------------------------------
  bulkApprove: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const posts = await ctx.prisma.socialPost.findMany({
        where: { id: { in: input.ids } },
        include: { project: { select: { userId: true } } },
      });

      if (posts.length !== input.ids.length) {
        const foundIds = new Set(posts.map((p) => p.id));
        const missing = input.ids.filter((id) => !foundIds.has(id));
        throw new TRPCError({ code: 'NOT_FOUND', message: `Posts not found: ${missing.join(', ')}` });
      }

      for (const post of posts) {
        if (post.project.userId !== ctx.user.id) {
          requireRole(ctx, 'ADMIN');
          break;
        }
      }

      const approvable = posts.filter((p) => ['DRAFT', 'PENDING_REVIEW'].includes(p.status));
      if (approvable.length === 0) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No posts are in an approvable status' });
      }

      const result = await ctx.prisma.socialPost.updateMany({
        where: {
          id: { in: approvable.map((p) => p.id) },
          status: { in: ['DRAFT', 'PENDING_REVIEW'] },
        },
        data: { status: 'APPROVED' },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'BULK_APPROVE_SOCIAL',
          resource: 'socialPost',
          details: { count: result.count, ids: approvable.map((p) => p.id) },
          ip: ctx.ip,
        },
      });

      return { approved: result.count, skipped: posts.length - approvable.length };
    }),

  // -------------------------------------------------------------------------
  // getCalendar — get social content calendar view
  // -------------------------------------------------------------------------
  getCalendar: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        weekStart: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifyProjectAccess(ctx, input.projectId);

      const start = input.weekStart ? new Date(input.weekStart) : new Date();
      // Set to Monday of the current week
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(start.setDate(diff));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const posts = await ctx.prisma.socialPost.findMany({
        where: {
          projectId: input.projectId,
          createdAt: { gte: monday, lte: sunday },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Group posts by day
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const calendar = days.map((dayName, idx) => {
        const dayDate = new Date(monday);
        dayDate.setDate(dayDate.getDate() + idx);
        return {
          day: dayName,
          date: dayDate.toISOString().split('T')[0],
          posts: posts.filter((p) => {
            const postDay = new Date(p.createdAt).getDay();
            const targetDay = idx === 6 ? 0 : idx + 1; // Convert to JS day (0=Sun)
            return postDay === targetDay;
          }),
        };
      });

      return { weekStart: monday.toISOString(), calendar };
    }),
});
