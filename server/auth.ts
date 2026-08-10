import { betterAuth } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { ServerConfig } from './config';
export const createAuth = (pool: pg.Pool, config: ServerConfig) => {
  return betterAuth({
    database: pool,
    baseURL: config.appUrl,
    secret: config.authSecret,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 10,
    },
    user: { fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' } },
    session: {
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        userId: 'user_id',
      },
    },
    account: {
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    advanced: {
      useSecureCookies: config.appUrl.startsWith('https://'),
    },
  });
};
export const sessionForRequest = async (auth: ReturnType<typeof createAuth>, request: FastifyRequest) => {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
};
