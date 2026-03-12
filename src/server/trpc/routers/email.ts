import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';

export const emailRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, status, limit, cursor } = input;

      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const sequences = await ctx.prisma.emailSequence.findMany({
        where: {
          projectId,
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
        include: {
          steps: { orderBy: { order: 'asc' } },
          _count: { select: { leads: true } },
        },
      });

      let nextCursor: string | undefined;
      if (sequences.length > limit) {
        const next = sequences.pop()!;
        nextCursor = next.id;
      }

      return { sequences, nextCursor };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        steps: z.array(
          z.object({
            order: z.number().int().min(0),
            subject: z.string().min(1),
            body: z.string().min(1),
            delayHours: z.number().int().min(0),
            condition: z.string().optional(),
          })
        ).min(1),
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

      const sequence = await ctx.prisma.emailSequence.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          status: 'DRAFT',
          metrics: {
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            bounced: 0,
            optedOut: 0,
            openRate: 0,
            clickRate: 0,
            replyRate: 0,
          },
          steps: {
            create: input.steps.map((step) => ({
              order: step.order,
              subject: step.subject,
              body: step.body,
              delayHours: step.delayHours,
              condition: step.condition,
            })),
          },
        },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'CREATE',
          resource: `emailSequence:${sequence.id}`,
          details: { name: input.name, stepCount: input.steps.length },
          ip: ctx.ip,
        },
      });

      return sequence;
    }),

  getLeads: protectedProcedure
    .input(
      z.object({
        sequenceId: z.string(),
        status: z.enum([
          'NEW', 'CONTACTED', 'OPENED', 'CLICKED', 'REPLIED',
          'INTERESTED', 'NOT_INTERESTED', 'BOUNCED', 'OPTED_OUT',
        ]).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { sequenceId, status, limit, cursor } = input;

      const sequence = await ctx.prisma.emailSequence.findUnique({
        where: { id: sequenceId },
        include: { project: { select: { userId: true } } },
      });
      if (!sequence) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });
      }
      if (sequence.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const leads = await ctx.prisma.lead.findMany({
        where: {
          sequenceId,
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
        include: {
          events: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });

      let nextCursor: string | undefined;
      if (leads.length > limit) {
        const next = leads.pop()!;
        nextCursor = next.id;
      }

      return { leads, nextCursor };
    }),

  getSequenceMetrics: protectedProcedure
    .input(z.object({ sequenceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sequence = await ctx.prisma.emailSequence.findUnique({
        where: { id: input.sequenceId },
        include: {
          project: { select: { userId: true } },
          steps: { orderBy: { order: 'asc' }, select: { id: true, order: true, subject: true } },
          leads: {
            select: { status: true },
          },
        },
      });

      if (!sequence) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sequence not found' });
      }
      if (sequence.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const leadsByStatus = sequence.leads.reduce<Record<string, number>>((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {});

      const totalLeads = sequence.leads.length;
      const storedMetrics = sequence.metrics as Record<string, number> | null;

      return {
        sequenceId: sequence.id,
        name: sequence.name,
        status: sequence.status,
        totalSteps: sequence.steps.length,
        steps: sequence.steps,
        totalLeads,
        leadsByStatus,
        sent: storedMetrics?.sent ?? 0,
        opened: storedMetrics?.opened ?? 0,
        clicked: storedMetrics?.clicked ?? 0,
        replied: storedMetrics?.replied ?? 0,
        bounced: storedMetrics?.bounced ?? 0,
        optedOut: storedMetrics?.optedOut ?? 0,
        openRate: totalLeads > 0
          ? ((storedMetrics?.opened ?? 0) / totalLeads) * 100
          : 0,
        clickRate: totalLeads > 0
          ? ((storedMetrics?.clicked ?? 0) / totalLeads) * 100
          : 0,
        replyRate: totalLeads > 0
          ? ((storedMetrics?.replied ?? 0) / totalLeads) * 100
          : 0,
      };
    }),
});
