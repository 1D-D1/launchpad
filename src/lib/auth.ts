/**
 * NextAuth.js configuration.
 * Supports credentials-based login (email/password) and Google OAuth,
 * with session data persisted via Prisma adapter.
 */

import type { NextAuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    newUser: '/onboarding',
  },

  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
          },
        });

        if (!user || !user.passwordHash) {
          // No user or no password set (OAuth-only account)
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          logger.warn({ msg: 'Failed login attempt', email: credentials.email });
          return null;
        }

        logger.info({ msg: 'User authenticated via credentials', userId: user.id });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          role: 'VIEWER' as const,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }): Promise<JWT> {
      // On initial sign-in, persist user fields into the JWT
      if (user) {
        token.id = user.id;
        token.role = (user as User & { role?: string }).role ?? 'VIEWER';
      }

      // Handle session updates (e.g., after profile edit)
      if (trigger === 'update' && session) {
        const s = session as Record<string, unknown>;
        if (s.name) token.name = s.name as string;
        if (s.role) token.role = s.role as string;
      }

      return token;
    },

    async session({ session, token }): Promise<Session> {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },

    async signIn({ user, account }) {
      // For OAuth providers, ensure the user exists in our database
      if (account?.provider === 'google' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name ?? undefined,
              role: 'VIEWER',
            },
          });
          logger.info({ msg: 'New user created via Google OAuth', email: user.email });
        }
      }

      return true;
    },
  },

  events: {
    async signIn({ user }) {
      logger.info({ msg: 'User signed in', userId: user.id });
    },
    async signOut({ token }) {
      logger.info({ msg: 'User signed out', userId: token?.id });
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
