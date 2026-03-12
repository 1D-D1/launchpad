import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';

const platformEnum = z.enum(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'GOOGLE', 'EMAIL']);

export const adsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        platform: platformEnum.optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, platform, status, limit, cursor } = input;

      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const campaigns = await ctx.prisma.adCampaign.findMany({
        where: {
          projectId,
          ...(platform && { platform }),
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (campaigns.length > limit) {
        const next = campaigns.pop()!;
        nextCursor = next.id;
      }

      return { campaigns, nextCursor };
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        platform: platformEnum,
        name: z.string().min(1).max(200),
        objective: z.string().min(1),
        budget: z.number().min(0),
        budgetType: z.enum(['DAILY', 'LIFETIME']),
        targeting: z.object({
          locations: z.array(z.string()).optional(),
          ageMin: z.number().min(13).max(65).optional(),
          ageMax: z.number().min(13).max(65).optional(),
          interests: z.array(z.string()).optional(),
          keywords: z.array(z.string()).optional(),
          audiences: z.array(z.string()).optional(),
        }),
        creatives: z.object({
          headline: z.string(),
          description: z.string(),
          callToAction: z.string().optional(),
          imageUrl: z.string().url().optional(),
          videoUrl: z.string().url().optional(),
          landingUrl: z.string().url().optional(),
        }),
        autoOptimize: z.boolean().default(true),
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

      const campaign = await ctx.prisma.adCampaign.create({
        data: {
          projectId: input.projectId,
          platform: input.platform,
          name: input.name,
          objective: input.objective,
          budget: input.budget,
          budgetType: input.budgetType,
          targeting: input.targeting,
          creatives: input.creatives,
          autoOptimize: input.autoOptimize,
          status: 'DRAFT',
          metrics: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spend: 0,
            ctr: 0,
            cpc: 0,
            cpa: 0,
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'CREATE',
          resource: `campaign:${campaign.id}`,
          details: { name: input.name, platform: input.platform, budget: input.budget },
          ip: ctx.ip,
        },
      });

      return campaign;
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.adCampaign.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }
      if (campaign.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Can only pause ACTIVE campaigns',
        });
      }

      const updated = await ctx.prisma.adCampaign.update({
        where: { id: input.id },
        data: { status: 'PAUSED' },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'PAUSE',
          resource: `campaign:${input.id}`,
          ip: ctx.ip,
        },
      });

      return updated;
    }),

  resume: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.adCampaign.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }
      if (campaign.status !== 'PAUSED') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Can only resume PAUSED campaigns',
        });
      }

      const updated = await ctx.prisma.adCampaign.update({
        where: { id: input.id },
        data: { status: 'ACTIVE' },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'RESUME',
          resource: `campaign:${input.id}`,
          ip: ctx.ip,
        },
      });

      return updated;
    }),

  getMetrics: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.adCampaign.findUnique({
        where: { id: input.id },
        include: { project: { select: { userId: true } } },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campaign not found' });
      }
      if (campaign.project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const metrics = campaign.metrics as Record<string, number> | null;

      return {
        campaignId: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        budget: campaign.budget,
        budgetType: campaign.budgetType,
        impressions: metrics?.impressions ?? 0,
        clicks: metrics?.clicks ?? 0,
        conversions: metrics?.conversions ?? 0,
        spend: metrics?.spend ?? 0,
        ctr: metrics?.ctr ?? 0,
        cpc: metrics?.cpc ?? 0,
        cpa: metrics?.cpa ?? 0,
        roas: metrics?.spend && metrics.spend > 0
          ? (metrics?.conversions ?? 0) / metrics.spend
          : 0,
      };
    }),
});
