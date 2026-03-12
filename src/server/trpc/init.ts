import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';
import type { Role } from '@prisma/client';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

export function requireRole(ctx: Context, role: Role) {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  const userRole = (ctx.session.user as { role?: Role }).role;
  const hierarchy: Record<Role, number> = { ADMIN: 3, MANAGER: 2, VIEWER: 1 };
  if ((hierarchy[userRole || 'VIEWER'] || 0) < hierarchy[role]) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `Requires role: ${role}` });
  }
}
