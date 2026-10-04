import type { FastifyPluginAsync } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { COOKIE, setSession } from '../plugins/auth.js';
import { getUserById, toUser } from '../services/userService.js';

const register = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/, '3-30 letters, numbers or underscores'),
  displayName: z.string().trim().min(1).max(50),
  password: z.string().min(8).max(128),
});
const login = z.object({ username: z.string(), password: z.string() });

const routes: FastifyPluginAsync = async (app) => {
  const limit = { config: { rateLimit: { max: config.authRateMax, timeWindow: '1 minute' } } };

  app.post('/register', limit, async (req, reply) => {
    const body = register.parse(req.body);
    const hash = await argon2.hash(body.password);
    try {
      const [res] = await pool.query<ResultSetHeader>(
        'INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)',
        [body.username, body.displayName, hash],
      );
      const token = await reply.jwtSign({ sub: res.insertId });
      setSession(reply, token);
      return reply.code(201).send({ user: await getUserById(res.insertId) });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return reply.code(409).send({ error: 'Username already taken' });
      throw e;
    }
  });

  app.post('/login', limit, async (req, reply) => {
    const body = login.parse(req.body);
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE username = ?', [body.username]);
    const row = rows[0];
    if (!row || !(await argon2.verify(row.password_hash, body.password)))
      return reply.code(401).send({ error: 'Invalid username or password' });
    setSession(reply, await reply.jwtSign({ sub: Number(row.id) }));
    return { user: toUser(row) };
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: app.requireAuth }, async (req, reply) => {
    const user = await getUserById(req.user.sub);
    if (!user) return reply.code(401).send({ error: 'Not authenticated' });
    return { user };
  });
};
export default routes;
