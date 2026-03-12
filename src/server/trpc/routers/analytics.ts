import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';

export const analyticsRouter = router({
  getProjectMetrics: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          contents: { select: { id: true, status: true, metrics: true, type: true, platform: true } },
          campaigns: { select: { id: true, status: true, metrics: true, budget: true, platform: true } },
          emailSequences: {
            select: {
              id: true,
              status: true,
              metrics: true,
              _count: { select: { leads: true, steps: true } },
            },
          },
          stripeData: { select: { revenue: true, status: true } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      const contentByStatus = project.contents.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {});

      const contentByType = project.contents.reduce<Record<string, number>>((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {});

      const totalAdSpend = project.campaigns.reduce((sum, c) => sum + c.budget, 0);
      const activeCampaigns = project.campaigns.filter((c) => c.status === 'ACTIVE').length;

      const totalLeads = project.emailSequences.reduce(
        (sum, s) => sum + s._count.leads, 0
      );

      const campaignMetrics = project.campaigns.reduce(
        (acc, c) => {
          const m = c.metrics as Record<string, number> | null;
          if (m) {
            acc.impressions += m.impressions || 0;
            acc.clicks += m.clicks || 0;
            acc.conversions += m.conversions || 0;
            acc.spend += m.spend || 0;
          }
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
      );

      return {
        projectId: project.id,
        projectStatus: project.status,
        content: {
          total: project.contents.length,
          byStatus: contentByStatus,
          byType: contentByType,
        },
        ads: {
          totalCampaigns: project.campaigns.length,
          activeCampaigns,
          totalBudget: totalAdSpend,
          metrics: campaignMetrics,
          ctr: campaignMetrics.impressions > 0
            ? (campaignMetrics.clicks / campaignMetrics.impressions) * 100
            : 0,
        },
        email: {
          totalSequences: project.emailSequences.length,
          totalLeads,
        },
        revenue: project.stripeData?.revenue ?? 0,
      };
    }),

  getDashboardStats: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
      }).optional()
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      const [
        projectCounts,
        contentCounts,
        campaignStats,
        revenueStats,
        recentProjects,
        leadCount,
      ] = await Promise.all([
        ctx.prisma.project.groupBy({
          by: ['status'],
          where: { userId },
          _count: true,
        }),
        ctx.prisma.content.groupBy({
          by: ['status'],
          where: { project: { userId } },
          _count: true,
        }),
        ctx.prisma.adCampaign.aggregate({
          where: { project: { userId } },
          _count: true,
          _sum: { budget: true },
        }),
        ctx.prisma.stripeProject.aggregate({
          where: { project: { userId } },
          _sum: { revenue: true },
        }),
        ctx.prisma.project.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
            _count: { select: { contents: true, campaigns: true } },
          },
        }),
        ctx.prisma.lead.count({
          where: { sequence: { project: { userId } } },
        }),
      ]);

      const totalProjects = projectCounts.reduce((sum, g) => sum + g._count, 0);
      const activeProjects = projectCounts
        .filter((g) => ['ACTIVE', 'RUNNING_ADS', 'PUBLISHING', 'EMAILING'].includes(g.status))
        .reduce((sum, g) => sum + g._count, 0);

      const totalContent = contentCounts.reduce((sum, g) => sum + g._count, 0);
      const publishedContent = contentCounts
        .filter((g) => g.status === 'PUBLISHED')
        .reduce((sum, g) => sum + g._count, 0);

      return {
        projects: {
          total: totalProjects,
          active: activeProjects,
          byStatus: Object.fromEntries(projectCounts.map((g) => [g.status, g._count])),
        },
        content: {
          total: totalContent,
          published: publishedContent,
          byStatus: Object.fromEntries(contentCounts.map((g) => [g.status, g._count])),
        },
        ads: {
          totalCampaigns: campaignStats._count,
          totalBudget: campaignStats._sum.budget ?? 0,
        },
        email: {
          totalLeads: leadCount,
        },
        revenue: {
          total: revenueStats._sum.revenue ?? 0,
        },
        recentProjects,
      };
    }),
});
