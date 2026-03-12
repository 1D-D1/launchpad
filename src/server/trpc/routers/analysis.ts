import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';
import { ProjectAnalyzer } from '@/server/services/ai/project-analyzer';
import { logger } from '@/lib/logger';
import type {
  ProjectAnalysis,
  PricingAnalysis,
  IdealClientProfile,
} from '@/server/services/ai/prompts/project-analysis';

const log = logger.child({ router: 'analysis' });

const analyzer = new ProjectAnalyzer();

export const analysisRouter = router({
  /**
   * Trigger a full AI analysis of a project.
   */
  analyzeProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<ProjectAnalysis> => {
      log.info({ projectId: input.projectId, userId: ctx.user.id }, 'Analysis requested');

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, userId: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      try {
        const analysis = await analyzer.analyzeProject(input.projectId);

        // Store analysis result on project's pipelineStatus for retrieval
        const existing = await ctx.prisma.project.findUnique({
          where: { id: input.projectId },
          select: { pipelineStatus: true },
        });
        const currentStatus = (existing?.pipelineStatus as Record<string, unknown>) ?? {};

        await ctx.prisma.project.update({
          where: { id: input.projectId },
          data: {
            pipelineStatus: JSON.parse(JSON.stringify({
              ...currentStatus,
              lastAnalysis: analysis,
              lastAnalysisAt: new Date().toISOString(),
            })),
          },
        });

        log.info({ projectId: input.projectId }, 'Analysis stored');
        return analysis;
      } catch (err) {
        log.error({ err, projectId: input.projectId }, 'Analysis failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze project. Please try again.',
        });
      }
    }),

  /**
   * Get the latest stored analysis for a project.
   */
  getAnalysis: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }): Promise<ProjectAnalysis | null> => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { userId: true, pipelineStatus: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const status = project.pipelineStatus as Record<string, unknown> | null;
      return (status?.lastAnalysis as ProjectAnalysis) ?? null;
    }),

  /**
   * Get pricing analysis and recommendations.
   */
  getPricingAnalysis: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<PricingAnalysis> => {
      log.info({ projectId: input.projectId }, 'Pricing analysis requested');

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, userId: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      try {
        return await analyzer.validatePricing(input.projectId);
      } catch (err) {
        log.error({ err, projectId: input.projectId }, 'Pricing analysis failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate pricing analysis.',
        });
      }
    }),

  /**
   * Get ideal client profile analysis.
   */
  getIdealClient: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<IdealClientProfile> => {
      log.info({ projectId: input.projectId }, 'ICP analysis requested');

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, userId: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      try {
        return await analyzer.identifyIdealClient(input.projectId);
      } catch (err) {
        log.error({ err, projectId: input.projectId }, 'ICP analysis failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate ideal client profile.',
        });
      }
    }),

  /**
   * Get the Claude Code revision prompt based on the latest analysis.
   */
  getRevisionPrompt: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }): Promise<{ prompt: string } | null> => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { userId: true, pipelineStatus: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const status = project.pipelineStatus as Record<string, unknown> | null;
      const analysis = status?.lastAnalysis as ProjectAnalysis | undefined;

      if (!analysis) {
        return null;
      }

      try {
        const prompt = await analyzer.generateRevisionPrompt(
          input.projectId,
          analysis,
        );
        return { prompt };
      } catch (err) {
        log.error({ err, projectId: input.projectId }, 'Revision prompt generation failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate revision prompt.',
        });
      }
    }),
});
