import { router } from './init';
import { projectRouter } from './routers/project';
import { contentRouter } from './routers/content';
import { analyticsRouter } from './routers/analytics';
import { adsRouter } from './routers/ads';
import { emailRouter } from './routers/email';
import { billingRouter } from './routers/billing';
import { seoRouter } from './routers/seo';
import { socialRouter } from './routers/social';
import { analysisRouter } from './routers/analysis';
import { budgetRouter } from './routers/budget';

export { router, publicProcedure, protectedProcedure, requireRole } from './init';

export const appRouter = router({
  project: projectRouter,
  content: contentRouter,
  analytics: analyticsRouter,
  ads: adsRouter,
  email: emailRouter,
  billing: billingRouter,
  seo: seoRouter,
  social: socialRouter,
  analysis: analysisRouter,
  budget: budgetRouter,
});

export type AppRouter = typeof appRouter;
