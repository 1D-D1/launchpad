import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';

export const projectRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum([
          'DRAFT', 'SUBMITTED', 'ANALYZING', 'STRATEGIZING',
          'GENERATING_CONTENT', 'PUBLISHING', 'RUNNING_ADS',
          'EMAILING', 'ACTIVE', 'PAUSED', 'COMPLETED',
        ]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, limit = 20, cursor } = input ?? {};
      const projects = await ctx.prisma.project.findMany({
        where: {
          userId: ctx.user.id,
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { contents: true, campaigns: true, emailSequences: true } },
        },
      });

      let nextCursor: string | undefined;
      if (projects.length > limit) {
        const next = projects.pop()!;
        nextCursor = next.id;
      }

      return { projects, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          analyses: true,
          strategies: true,
          contents: { orderBy: { createdAt: 'desc' }, take: 10 },
          campaigns: true,
          emailSequences: { include: { _count: { select: { leads: true, steps: true } } } },
          stripeData: true,
          assets: true,
          _count: { select: { pipelineJobs: true } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      return project;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().min(1),
        vertical: z.string().min(1),
        targetAudience: z.object({
          demographics: z.string().optional(),
          interests: z.array(z.string()).optional(),
          location: z.string().optional(),
          ageRange: z.string().optional(),
        }),
        budget: z.object({
          total: z.number().min(0),
          currency: z.string().default('EUR'),
          allocation: z.record(z.string(), z.number()).optional(),
        }),
        objectives: z.object({
          primary: z.string(),
          secondary: z.array(z.string()).optional(),
          kpis: z.array(z.string()).optional(),
        }),
        competitors: z.array(z.object({
          name: z.string(),
          url: z.string().url().optional(),
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          vertical: input.vertical,
          targetAudience: input.targetAudience as unknown as Prisma.InputJsonValue,
          budget: input.budget as unknown as Prisma.InputJsonValue,
          objectives: input.objectives as unknown as Prisma.InputJsonValue,
          competitors: (input.competitors ?? []) as unknown as Prisma.InputJsonValue,
          userId: ctx.user.id,
          status: 'DRAFT',
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'CREATE',
          resource: `project:${project.id}`,
          details: { name: input.name } as unknown as Prisma.InputJsonValue,
          ip: ctx.ip,
        },
      });

      return project;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().min(1).optional(),
        vertical: z.string().min(1).optional(),
        targetAudience: z.any().optional(),
        budget: z.any().optional(),
        objectives: z.any().optional(),
        competitors: z.array(z.object({
          name: z.string(),
          url: z.string().url().optional(),
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rawData } = input;

      const existing = await ctx.prisma.project.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (existing.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      // Build update data with proper JSON casting
      const updateData: Prisma.ProjectUpdateInput = {};
      if (rawData.name !== undefined) updateData.name = rawData.name;
      if (rawData.description !== undefined) updateData.description = rawData.description;
      if (rawData.vertical !== undefined) updateData.vertical = rawData.vertical;
      if (rawData.targetAudience !== undefined) updateData.targetAudience = rawData.targetAudience as Prisma.InputJsonValue;
      if (rawData.budget !== undefined) updateData.budget = rawData.budget as Prisma.InputJsonValue;
      if (rawData.objectives !== undefined) updateData.objectives = rawData.objectives as Prisma.InputJsonValue;
      if (rawData.competitors !== undefined) updateData.competitors = rawData.competitors as unknown as Prisma.InputJsonValue;

      const project = await ctx.prisma.project.update({
        where: { id },
        data: updateData,
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'UPDATE',
          resource: `project:${id}`,
          details: { fields: Object.keys(rawData) } as unknown as Prisma.InputJsonValue,
          ip: ctx.ip,
        },
      });

      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.project.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (existing.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }
      if (!['DRAFT', 'COMPLETED', 'PAUSED'].includes(existing.status)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Can only delete projects in DRAFT, COMPLETED, or PAUSED status',
        });
      }

      await ctx.prisma.project.delete({ where: { id: input.id } });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DELETE',
          resource: `project:${input.id}`,
          details: { name: existing.name } as unknown as Prisma.InputJsonValue,
          ip: ctx.ip,
        },
      });

      return { success: true };
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: { _count: { select: { contents: true } } },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (existing.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }
      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Only DRAFT projects can be submitted',
        });
      }

      const project = await ctx.prisma.project.update({
        where: { id: input.id },
        data: {
          status: 'SUBMITTED',
          pipelineStatus: { submittedAt: new Date().toISOString() },
        },
      });

      await ctx.prisma.pipelineJob.create({
        data: {
          projectId: input.id,
          stage: 'ANALYSIS',
          status: 'PENDING',
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'SUBMIT',
          resource: `project:${input.id}`,
          ip: ctx.ip,
        },
      });

      return project;
    }),
});
