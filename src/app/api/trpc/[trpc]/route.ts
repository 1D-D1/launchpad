import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req, resHeaders: new Headers() }),
    onError: ({ error, path }) => {
      console.error(`tRPC error on ${path}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
