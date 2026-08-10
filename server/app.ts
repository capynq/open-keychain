import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type pg from 'pg';
import { createAuth, sessionForRequest } from './auth';
import type { PlanId } from './billing';
import type { ServerConfig } from './config';
import { quotaAvailable, quotaPolicyFor } from './quotas';
type ProjectBody = {
  name?: string;
  params?: unknown;
  thumbnail?: string;
};
const cookieValue = (request: FastifyRequest, name: string): string | undefined => {
  const match = request.headers.cookie?.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};
const anonymousActor = (request: FastifyRequest, reply: FastifyReply): string => {
  const existing = cookieValue(request, 'ok_anon');
  if (existing) return existing;
  const value = randomUUID();
  reply.header('Set-Cookie', `ok_anon=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
  return value;
};
const jsonBody = (request: FastifyRequest): ProjectBody => {
  return (request.body && typeof request.body === 'object' ? request.body : {}) as ProjectBody;
};
const currentUser = async (auth: ReturnType<typeof createAuth>, request: FastifyRequest) => {
  const session = await sessionForRequest(auth, request);
  return session?.user;
};
const usage = async (
  pool: pg.Pool,
  actorKey: string,
): Promise<{
  weekly: number;
  daily: number;
  minute: number;
}> => {
  const result = await pool.query<{
    weekly: string;
    daily: string;
    minute: string;
  }>(
    `SELECT
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS weekly,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS daily,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 minute') AS minute
     FROM export_events WHERE actor_key = $1`,
    [actorKey],
  );
  const row = result.rows[0] ?? { weekly: '0', daily: '0', minute: '0' };
  return { weekly: Number(row.weekly), daily: Number(row.daily), minute: Number(row.minute) };
};
const userPlan = async (pool: pg.Pool, userId: string): Promise<PlanId> => {
  const result = await pool.query<{
    plan_id: PlanId;
  }>(
    `SELECT plan_id FROM subscriptions
     WHERE user_id = $1 AND status IN ('trialing', 'active')
       AND (current_period_end IS NULL OR current_period_end > NOW())`,
    [userId],
  );
  return result.rows[0]?.plan_id === 'maker' ? 'maker' : 'free';
};
export const createApp = (pool: pg.Pool, config: ServerConfig): FastifyInstance => {
  const app = Fastify({ logger: true });
  const auth = createAuth(pool, config);
  app.get('/api/health', async () => ({ status: 'ok' }));
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const url = new URL(request.url, config.appUrl);
      const body = request.body && request.method !== 'GET' ? JSON.stringify(request.body) : undefined;
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (typeof value === 'string') headers.set(key, value);
      });
      const response = await auth.handler(
        new Request(url, { method: request.method, headers, body, redirect: 'manual' }),
      );
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.status(response.status);
      return response.body ? Buffer.from(await response.arrayBuffer()) : null;
    },
  });
  app.get('/api/me', async (request, reply) => {
    const user = await currentUser(auth, request);
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    return { user };
  });
  app.get('/api/billing/status', async (request, reply) => {
    const user = await currentUser(auth, request);
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    return { plan: await userPlan(pool, user.id), billingConfigured: false };
  });
  app.post('/api/usage/export-intent', async (request, reply) => {
    const user = await currentUser(auth, request);
    const actorKey = user?.id ?? anonymousActor(request, reply);
    const plan = user ? await userPlan(pool, user.id) : 'free';
    const policy = quotaPolicyFor(plan);
    const counts = await usage(pool, actorKey);
    const configuredPolicy =
      plan === 'maker'
        ? {
            ...policy,
            weeklyExports: Number.MAX_SAFE_INTEGER,
            dailyExports: config.paidDailyExports,
            minuteExports: config.paidMinuteExports,
          }
        : { ...policy, weeklyExports: config.anonymousWeeklyExports };
    if (!quotaAvailable(configuredPolicy, counts)) {
      return reply.status(429).send({ error: 'QUOTA_EXCEEDED', counts, limits: configuredPolicy });
    }
    const token = randomUUID();
    await pool.query(
      "INSERT INTO export_intents(token, actor_key, user_id, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')",
      [token, actorKey, user?.id ?? null],
    );
    return { token, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() };
  });
  app.post<{
    Params: {
      token: string;
    };
  }>('/api/usage/export-complete/:token', async (request, reply) => {
    const user = await currentUser(auth, request);
    const actorKey = user?.id ?? cookieValue(request, 'ok_anon');
    if (!actorKey) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const intent = await client.query<{
        actor_key: string;
        user_id: string | null;
      }>(
        'SELECT actor_key, user_id FROM export_intents WHERE token = $1 AND expires_at > NOW() AND completed_at IS NULL FOR UPDATE',
        [request.params.token],
      );
      const row = intent.rows[0];
      if (!row || row.actor_key !== actorKey) {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'INVALID_EXPORT_INTENT' });
      }
      await client.query('UPDATE export_intents SET completed_at = NOW() WHERE token = $1', [request.params.token]);
      await client.query('INSERT INTO export_events(actor_key, user_id) VALUES ($1, $2)', [actorKey, user?.id ?? null]);
      await client.query('COMMIT');
      return { recorded: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  app.get('/api/projects', async (request, reply) => {
    const user = await currentUser(auth, request);
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    const result = await pool.query(
      'SELECT id, name, params, thumbnail, schema_version, created_at, updated_at FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [user.id],
    );
    return { projects: result.rows };
  });
  app.post('/api/projects', async (request, reply) => {
    const user = await currentUser(auth, request);
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    const body = jsonBody(request);
    if (!body.name?.trim() || !body.params) return reply.status(400).send({ error: 'INVALID_PROJECT' });
    const result = await pool.query(
      `INSERT INTO projects(id, user_id, name, params, thumbnail)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, params, thumbnail, schema_version, created_at, updated_at`,
      [randomUUID(), user.id, body.name.trim().slice(0, 120), JSON.stringify(body.params), body.thumbnail ?? null],
    );
    return reply.status(201).send({ project: result.rows[0] });
  });
  app.patch<{
    Params: {
      id: string;
    };
  }>('/api/projects/:id', async (request, reply) => {
    const user = await currentUser(auth, request);
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    const body = jsonBody(request);
    const result = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        params = COALESCE($2, params),
        thumbnail = COALESCE($3, thumbnail),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, params, thumbnail, schema_version, created_at, updated_at`,
      [
        body.name?.trim().slice(0, 120) ?? null,
        body.params ? JSON.stringify(body.params) : null,
        body.thumbnail ?? null,
        request.params.id,
        user.id,
      ],
    );
    if (!result.rowCount) return reply.status(404).send({ error: 'PROJECT_NOT_FOUND' });
    return { project: result.rows[0] };
  });
  app.delete<{
    Params: {
      id: string;
    };
  }>('/api/projects/:id', async (request, reply) => {
    const user = await currentUser(auth, request);
    if (!user) return reply.status(401).send({ error: 'UNAUTHORIZED' });
    const result = await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [
      request.params.id,
      user.id,
    ]);
    if (!result.rowCount) return reply.status(404).send({ error: 'PROJECT_NOT_FOUND' });
    return reply.status(204).send();
  });
  return app;
};
