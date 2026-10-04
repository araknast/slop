import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { pool } from './db/pool.js';
import { redis } from './cache/redis.js';

// Requires `docker compose up -d` and `npm run migrate`.
let app: FastifyInstance;
const name = `t${Date.now().toString(36)}`;
let cookie = '';

const call = (method: any, url: string, payload?: unknown) =>
  app.inject({ method, url, payload: payload as any, headers: cookie ? { cookie } : {} });

beforeAll(async () => { app = await buildApp(); });
afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username LIKE ?', [`${name}%`]);
  await redis.del('feed:global');
  await app.close(); await pool.end(); redis.disconnect();
});

describe('chirp api', () => {
  it('registers, posts, likes idempotently, replies, reposts', async () => {
    const reg = await call('POST', '/api/auth/register', { username: name, displayName: 'Tester', password: 'password123' });
    expect(reg.statusCode).toBe(201);
    cookie = String(reg.headers['set-cookie']).split(';')[0];

    const created = (await call('POST', '/api/posts', { body: 'hello world' })).json().post;
    expect(created.body).toBe('hello world');

    await call('PUT', `/api/posts/${created.id}/like`);
    await call('PUT', `/api/posts/${created.id}/like`); // idempotent
    let { post } = (await call('GET', `/api/posts/${created.id}`)).json();
    expect(post.likeCount).toBe(1);
    expect(post.likedByMe).toBe(true);

    await call('DELETE', `/api/posts/${created.id}/like`);
    post = (await call('GET', `/api/posts/${created.id}`)).json().post;
    expect(post.likeCount).toBe(0);

    await call('POST', '/api/posts', { body: 'a reply', parentId: created.id });
    const detail = (await call('GET', `/api/posts/${created.id}`)).json();
    expect(detail.post.replyCount).toBe(1);
    expect(detail.replies).toHaveLength(1);

    await call('POST', `/api/posts/${created.id}/repost`);
    await call('POST', `/api/posts/${created.id}/repost`); // idempotent
    expect((await call('GET', `/api/posts/${created.id}`)).json().post.repostCount).toBe(1);

    const feed = (await call('GET', '/api/posts?limit=5')).json();
    expect(feed.posts[0].repostOf?.id).toBe(created.id);
  });

  it('rejects unauthenticated writes and over-long posts', async () => {
    const anon = await app.inject({ method: 'POST', url: '/api/posts', payload: { body: 'x' } });
    expect(anon.statusCode).toBe(401);
    const long = await call('POST', '/api/posts', { body: 'x'.repeat(281) });
    expect(long.statusCode).toBe(400);
  });

  it('still serves the feed when the cache is cold', async () => {
    await redis.del('feed:global');
    const res = await call('GET', '/api/posts');
    expect(res.statusCode).toBe(200);
    expect(res.json().posts.length).toBeGreaterThan(0);
  });
});
