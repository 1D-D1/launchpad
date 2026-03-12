import { prisma } from '@/server/db/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { inferAsyncReturnType } from '@trpc/server';

export async function createContext(opts?: { req?: Request; resHeaders?: Headers }) {
  const session = await getServerSession(authOptions);

  return {
    prisma,
    session,
    user: session?.user,
    ip: opts?.req?.headers.get('x-forwarded-for') || 'unknown',
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
