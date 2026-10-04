import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { optionalViewer } from '../plugins/auth.js';
import { getUserById, getUserByUsername, invalidateUser } from '../services/userService.js';
import { getUserPosts, hydrate } from '../services/postService.js';

const patch = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().max(255).nullable().optional(),
});
const page = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.coerce.number().int().positive().optional(),
});

const routes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { username: string } }>('/:username', async (req, reply) => {
    const user = await getUserByUsername(req.params.username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return { user };
  });

  app.get<{ Params: { username: string } }>('/:username/posts', async (req, reply) => {
    const user = await getUserByUsername(req.params.username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const { limit, before } = page.parse(req.query);
    const viewer = await optionalViewer(req);
    const { ids, nextCursor } = await getUserPosts(user.id, limit, before);
    return { posts: await hydrate(ids, viewer), nextCursor };
  });

  app.patch('/me', { preHandler: app.requireAuth }, async (req) => {
    const body = patch.parse(req.body);
    const me = (await getUserById(req.user.sub))!;
    await pool.query('UPDATE users SET display_name = ?, bio = ?, avatar_url = ? WHERE id = ?', [
      body.displayName ?? me.displayName,
      body.bio ?? me.bio,
      body.avatarUrl === undefined ? me.avatarUrl : body.avatarUrl,
      me.id,
    ]);
    await invalidateUser(me);
    return { user: await getUserById(me.id) };
  });
};
export default routes;
