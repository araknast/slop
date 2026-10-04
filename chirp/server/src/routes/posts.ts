import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { optionalViewer } from '../plugins/auth.js';
import * as posts from '../services/postService.js';

const create = z.object({
  body: z.string().trim().min(1).max(280),
  parentId: z.number().int().positive().optional(),
});
const page = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.coerce.number().int().positive().optional(),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

const routes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const { limit, before } = page.parse(req.query);
    const viewer = await optionalViewer(req);
    const { ids, nextCursor } = await posts.getFeed(limit, before);
    return { posts: await posts.hydrate(ids, viewer), nextCursor };
  });

  app.post('/', { preHandler: app.requireAuth }, async (req, reply) => {
    const body = create.parse(req.body);
    const id = await posts.createPost(req.user.sub, body.body, body.parentId);
    const [post] = await posts.hydrate([id], req.user.sub);
    return reply.code(201).send({ post });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const viewer = await optionalViewer(req);
    const [post] = await posts.hydrate([id], viewer);
    if (!post) return reply.code(404).send({ error: 'Post not found' });
    const replies = await posts.hydrate(await posts.getReplyIds(id), viewer);
    return { post, replies };
  });

  app.delete('/:id', { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if (!(await posts.deletePost(req.user.sub, id))) return reply.code(404).send({ error: 'Post not found' });
    return { ok: true };
  });

  const guard = { preHandler: app.requireAuth };
  app.put('/:id/like', guard, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if (!(await posts.postExists(id))) return reply.code(404).send({ error: 'Post not found' });
    await posts.setLike(req.user.sub, id, true);
    return { ok: true };
  });
  app.delete('/:id/like', guard, async (req) => {
    await posts.setLike(req.user.sub, idParam.parse(req.params).id, false);
    return { ok: true };
  });
  app.post('/:id/repost', guard, async (req, reply) => {
    await posts.repost(req.user.sub, idParam.parse(req.params).id);
    return reply.code(201).send({ ok: true });
  });
  app.delete('/:id/repost', guard, async (req) => {
    await posts.unrepost(req.user.sub, idParam.parse(req.params).id);
    return { ok: true };
  });
};
export default routes;
