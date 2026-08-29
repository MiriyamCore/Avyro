import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@avyro/database';

const webOrigin = process.env.WEB_URL ?? 'http://localhost:3000';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    webOrigin,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  // Public URL as seen by the browser (Next.js proxies /api/* → API)
  baseURL: process.env.BETTER_AUTH_URL ?? webOrigin,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-change-me-to-a-long-random-string',
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: false,
      path: '/',
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
