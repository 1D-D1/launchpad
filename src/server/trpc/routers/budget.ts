import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { TRPCError } from '@trpc/server';
import { BudgetValidator } from '@/server/services/budget/validator';
import type { Prisma } from '@prisma/client';

const budgetValidator = new BudgetValidator();

export const budgetRouter = router({
  /** Run budget validation checks */
  validateBudget: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      return budgetValidator.validateBudget(input.projectId);
    }),

  /** Get 6-month projection breakdown */
  getBreakdown: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      return budgetValidator.getMonthlyBreakdown(input.projectId);
    }),

  /** Update channel budget allocation */
  updateAllocation: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        allocation: z.record(z.string(), z.number().min(0).max(100)),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      const totalPercent = Object.values(input.allocation).reduce((s, v) => s + v, 0);
      if (totalPercent > 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Allocation totals ${totalPercent}%, which exceeds 100%.`,
        });
      }

      const currentBudget = project.budget as Record<string, unknown>;
      const updatedBudget = {
        ...currentBudget,
        allocation: input.allocation,
      };

      await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { budget: updatedBudget as Prisma.InputJsonValue },
      });

      return budgetValidator.validateBudget(input.projectId);
    }),

  /** Run pre-launch checklist */
  prelaunchCheck: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      return budgetValidator.prelaunchCheck(input.projectId);
    }),

  /** Approve the project budget */
  approveBudget: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      if (project.userId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });

      const currentBudget = project.budget as Record<string, unknown>;
      const updatedBudget = {
        ...currentBudget,
        approved: true,
        approvedAt: new Date().toISOString(),
      };

      const updated = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { budget: updatedBudget as Prisma.InputJsonValue },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'APPROVE_BUDGET',
          resource: `project:${input.projectId}`,
          ip: ctx.ip,
        },
      });

      return updated;
    }),
});
