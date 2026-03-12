import { z } from 'zod';
import { router, protectedProcedure, requireRole } from '../init';
import { TRPCError } from '@trpc/server';

export const billingRouter = router({
  getRevenue: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const projectId = input?.projectId;

      if (projectId) {
        const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }
        if (project.userId !== userId) {
          requireRole(ctx, 'ADMIN');
        }

        const stripeData = await ctx.prisma.stripeProject.findUnique({
          where: { projectId },
        });

        return {
          projectId,
          revenue: stripeData?.revenue ?? 0,
          subscriptionStatus: stripeData?.status ?? 'NONE',
          stripeCustomerId: stripeData?.stripeCustomerId,
          stripeSubscriptionId: stripeData?.stripeSubscriptionId,
        };
      }

      const stripeProjects = await ctx.prisma.stripeProject.findMany({
        where: { project: { userId } },
        include: {
          project: { select: { id: true, name: true, status: true } },
        },
        orderBy: { revenue: 'desc' },
      });

      const totalRevenue = stripeProjects.reduce((sum, sp) => sum + sp.revenue, 0);
      const activeSubscriptions = stripeProjects.filter((sp) => sp.status === 'ACTIVE').length;

      return {
        totalRevenue,
        activeSubscriptions,
        totalProjects: stripeProjects.length,
        projects: stripeProjects.map((sp) => ({
          projectId: sp.projectId,
          projectName: sp.project.name,
          projectStatus: sp.project.status,
          revenue: sp.revenue,
          subscriptionStatus: sp.status,
        })),
      };
    }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        priceId: z.string().optional(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: { stripeData: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      if (project.userId !== ctx.user.id) {
        requireRole(ctx, 'ADMIN');
      }

      if (project.stripeData?.status === 'ACTIVE') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project already has an active subscription',
        });
      }

      // Create or update the StripeProject record with checkout pending status.
      // In production, this would call the Stripe API to create a real checkout session.
      const checkoutUrl = `https://checkout.stripe.com/pay/cs_placeholder_${input.projectId}`;

      const stripeProject = await ctx.prisma.stripeProject.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          status: 'CHECKOUT_PENDING',
          checkoutUrl,
        },
        update: {
          status: 'CHECKOUT_PENDING',
          checkoutUrl,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'CREATE_CHECKOUT',
          resource: `billing:${input.projectId}`,
          details: { priceId: input.priceId },
          ip: ctx.ip,
        },
      });

      return {
        checkoutUrl: stripeProject.checkoutUrl,
        stripeProjectId: stripeProject.id,
      };
    }),

  getInvoices: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const projectId = input?.projectId;
      const limit = input?.limit ?? 20;

      if (projectId) {
        const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }
        if (project.userId !== userId) {
          requireRole(ctx, 'ADMIN');
        }
      }

      // Query audit logs for billing events as invoice proxies.
      // In production, this would call Stripe's List Invoices API.
      const billingEvents = await ctx.prisma.auditLog.findMany({
        where: {
          userId,
          action: { in: ['CREATE_CHECKOUT', 'PAYMENT_RECEIVED', 'SUBSCRIPTION_RENEWED'] },
          ...(projectId && { resource: { contains: projectId } }),
        },
        take: limit + 1,
        ...(input?.cursor && { cursor: { id: input.cursor }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (billingEvents.length > limit) {
        const next = billingEvents.pop()!;
        nextCursor = next.id;
      }

      const invoices = billingEvents.map((event) => ({
        id: event.id,
        action: event.action,
        resource: event.resource,
        details: event.details,
        date: event.createdAt,
      }));

      return { invoices, nextCursor };
    }),
});
