/**
 * Next.js middleware for route protection.
 * Protects /dashboard routes by checking for a valid JWT session.
 * Allows public access to landing page, auth pages, API health, and webhooks.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/** Routes that do not require authentication. */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/api/health',
  '/api/seed',
];

/** Path prefixes that do not require authentication. */
const PUBLIC_PREFIXES = [
  '/api/webhooks/',
  '/api/auth/',
  '/api/track/',
  '/_next/',
  '/favicon',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow public prefixes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.includes('.') &&
    !pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  // Check for valid session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
