import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';

const contentTypeEnum = z.enum(['SOCIAL_POST', 'AD_COPY', 'EMAIL', 'LANDING_PAGE', 'BLOG_POST']);
const platformEnum = z.enum(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'GOOGLE', 'EMAIL']);
const contentStatusEnum = z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED']);

export const contentRouter = router({
  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: contentTypeEnum.optional(),
        platform: platformEnum.optional(),
        status: contentStatusEnum.optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, type, platform, status, limit, cursor } = input;

      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const contents = await ctx.prisma.content.findMany({
        where: {
          projectId,
          ...(type && { type }),
          ...(platform && { platform }),
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (contents.length > limit) {
        const next = contents.pop()!;
        nextCursor = next.id;
      }

      return { contents, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.id },
        include: { project: { select: { id: true, name: true, userId: true } } },
      });

      if (!content) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
      }
      if (content.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return content;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: contentTypeEnum,
        platform: platformEnum.optional(),
        title: z.string().max(300).optional(),
        body: z.string().min(1),
        bodyVariantB: z.string().optional(),
        visualPrompt: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const content = await ctx.prisma.content.create({
        data: {
          ...input,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          status: 'DRAFT',
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'CREATE',
          resource: `content:${content.id}`,
          details: { type: input.type, projectId: input.projectId },
          ip: ctx.ip,
        },
      });

      return content;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().max(300).optional(),
        body: z.string().min(1).optional(),
        bodyVariantB: z.string().nullable().optional(),
        visualPrompt: z.string().nullable().optional(),
        visualUrl: z.string().url().nullable().optional(),
        scheduledAt: z.string().datetime().nullable().optional(),
        status: contentStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.prisma.content.findUnique({
        where: { id },
        include: { project: { select: { userId: true } } },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
      }
      if (existing.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const content = await ctx.prisma.content.update({
        where: { id },
        data: {
          ...data,
          scheduledAt: data.scheduledAt !== undefined
            ? (data.scheduledAt ? new Date(data.scheduledAt) : null)
            : undefined,
        },
      });

      return content;
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.content.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Content not found' });
      }
      if (existing.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }
      if (!['DRAFT', 'PENDING_REVIEW'].includes(existing.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Content must be in DRAFT or PENDING_REVIEW status to approve',
        });
      }

      const content = await ctx.prisma.content.update({
        where: { id: input.id },
        data: { status: 'APPROVED' },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'APPROVE',
          resource: `content:${input.id}`,
          ip: ctx.ip,
        },
      });

      return content;
    }),

  bulkApprove: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const contents = await ctx.prisma.content.findMany({
        where: { id: { in: input.ids } },
        include: { project: { select: { userId: true } } },
      });

      if (contents.length !== input.ids.length) {
        const foundIds = new Set(contents.map((c) => c.id));
        const missing = input.ids.filter((id) => !foundIds.has(id));
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Content not found: ${missing.join(', ')}`,
        });
      }

      for (const content of contents) {
        if (content.project.userId !== ctx.user.id) {
          requireRole(ctx, 'ADMIN');
          break;
        }
      }

      const approvable = contents.filter((c) =>
        ['DRAFT', 'PENDING_REVIEW'].includes(c.status)
      );

      if (approvable.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No content items are in an approvable status',
        });
      }

      const result = await ctx.prisma.content.updateMany({
        where: {
          id: { in: approvable.map((c) => c.id) },
          status: { in: ['DRAFT', 'PENDING_REVIEW'] },
        },
        data: { status: 'APPROVED' },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'BULK_APPROVE',
          resource: `content`,
          details: { count: result.count, ids: approvable.map((c) => c.id) },
          ip: ctx.ip,
        },
      });

      return { approved: result.count, skipped: contents.length - approvable.length };
    }),
});
