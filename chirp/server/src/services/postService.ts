import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import { del, getOrSet, redis, safe } from '../cache/redis.js';
import { getUserById, type PublicUser } from './userService.js';

const FEED_KEY = 'feed:global';
const FEED_MAX = 1000;

export interface Post {
  id: number;
  author: PublicUser;
  body: string;
  parentId: number | null;
  repostOf: Post | null;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  createdAt: string;
  likedByMe?: boolean;
  repostedByMe?: boolean;
}

/** Build the viewer-independent post (cached in Redis). */
async function loadPost(id: number): Promise<Post | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM posts WHERE id = ?', [id]);
  const r = rows[0];
  if (!r) return null;
  const author = await getUserById(Number(r.user_id));
  if (!author) return null;
  const repostOf = r.repost_of_id ? await getPost(Number(r.repost_of_id)) : null;
  return {
    id: Number(r.id),
    author,
    body: r.body,
    parentId: r.parent_id ? Number(r.parent_id) : null,
    repostOf,
    likeCount: r.like_count,
    replyCount: r.reply_count,
    repostCount: r.repost_count,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

const getPost = (id: number) => getOrSet<Post>(`post:${id}`, 600, () => loadPost(id));

/** Fetch posts in the given order and attach per-viewer state. */
export async function hydrate(ids: number[], viewerId?: number): Promise<Post[]> {
  const posts = (await Promise.all(ids.map(getPost))).filter((p): p is Post => p !== null);
  if (!viewerId || posts.length === 0) return posts;
  // Counters of an embedded original may be stale in the repost's cached copy; refresh from the original's own entry.
  const targets = posts.map((p) => p.repostOf?.id ?? p.id);
  const [liked] = await pool.query<RowDataPacket[]>(
    'SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (?)',
    [viewerId, targets],
  );
  const [reposted] = await pool.query<RowDataPacket[]>(
    'SELECT repost_of_id FROM posts WHERE user_id = ? AND repost_of_id IN (?)',
    [viewerId, targets],
  );
  const likedSet = new Set(liked.map((r) => Number(r.post_id)));
  const repostedSet = new Set(reposted.map((r) => Number(r.repost_of_id)));
  return posts.map((p) => {
    const t = p.repostOf?.id ?? p.id;
    return { ...p, likedByMe: likedSet.has(t), repostedByMe: repostedSet.has(t) };
  });
}

async function refresh(...ids: number[]) {
  await del(...ids.map((i) => `post:${i}`));
}

async function withTx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function createPost(userId: number, body: string, parentId?: number): Promise<number> {
  const id = await withTx(async (c) => {
    if (parentId) {
      const [p] = await c.query<RowDataPacket[]>('SELECT id FROM posts WHERE id = ? FOR UPDATE', [parentId]);
      if (!p[0]) throw Object.assign(new Error('Parent post not found'), { statusCode: 404 });
      await c.query('UPDATE posts SET reply_count = reply_count + 1 WHERE id = ?', [parentId]);
    }
    const [res] = await c.query<ResultSetHeader>(
      'INSERT INTO posts (user_id, parent_id, body) VALUES (?, ?, ?)',
      [userId, parentId ?? null, body],
    );
    return res.insertId;
  });
  if (parentId) await refresh(parentId);
  else await pushFeed(id);
  return id;
}

async function pushFeed(id: number) {
  await safe(async () => {
    await redis.zadd(FEED_KEY, id, String(id));
    await redis.zremrangebyrank(FEED_KEY, 0, -(FEED_MAX + 1));
  });
}

/** Global feed, newest first. `before` is an exclusive id cursor. */
export async function getFeed(limit: number, before?: number): Promise<{ ids: number[]; nextCursor: number | null }> {
  const max = before ? `(${before}` : '+inf';
  let ids = await safe(async () => {
    if ((await redis.zcard(FEED_KEY)) === 0) return undefined;
    const got = await redis.zrevrangebyscore(FEED_KEY, max, '-inf', 'LIMIT', 0, limit + 1);
    return got.map(Number);
  });
  // Fall back to MySQL when the cache is cold, down, or exhausted for this page.
  if (!ids || ids.length < limit + 1) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM posts WHERE parent_id IS NULL ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
      before ? [before, limit + 1] : [limit + 1],
    );
    ids = rows.map((r) => Number(r.id));
    if (!before) void warmFeed();
  }
  const hasMore = ids.length > limit;
  const page = ids.slice(0, limit);
  return { ids: page, nextCursor: hasMore ? page[page.length - 1] : null };
}

async function warmFeed() {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM posts WHERE parent_id IS NULL ORDER BY id DESC LIMIT ?',
    [FEED_MAX],
  );
  if (rows.length === 0) return;
  await safe(async () => {
    const pipe = redis.pipeline();
    for (const r of rows) pipe.zadd(FEED_KEY, Number(r.id), String(r.id));
    await pipe.exec();
  });
}

export async function getUserPosts(userId: number, limit: number, before?: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM posts WHERE user_id = ? AND parent_id IS NULL ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    before ? [userId, before, limit + 1] : [userId, limit + 1],
  );
  const ids = rows.map((r) => Number(r.id));
  const page = ids.slice(0, limit);
  return { ids: page, nextCursor: ids.length > limit ? page[page.length - 1] : null };
}

export async function getReplyIds(postId: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM posts WHERE parent_id = ? ORDER BY id ASC LIMIT 200',
    [postId],
  );
  return rows.map((r) => Number(r.id));
}

export async function postExists(id: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM posts WHERE id = ?', [id]);
  return rows.length > 0;
}

export const getPostById = getPost;

export async function deletePost(userId: number, id: number): Promise<boolean> {
  const affected = await withTx(async (c) => {
    const [rows] = await c.query<RowDataPacket[]>(
      'SELECT parent_id, repost_of_id FROM posts WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId],
    );
    if (!rows[0]) return null;
    if (rows[0].parent_id)
      await c.query('UPDATE posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ?', [rows[0].parent_id]);
    if (rows[0].repost_of_id)
      await c.query('UPDATE posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = ?', [rows[0].repost_of_id]);
    await c.query('DELETE FROM posts WHERE id = ?', [id]);
    return rows[0];
  });
  if (!affected) return false;
  await safe(() => redis.zrem(FEED_KEY, String(id)));
  await refresh(id, ...[affected.parent_id, affected.repost_of_id].filter(Boolean).map(Number));
  // Reposts of / replies under the deleted post cascade in MySQL; stale cache entries expire via TTL.
  return true;
}

export async function setLike(userId: number, postId: number, liked: boolean): Promise<void> {
  await withTx(async (c) => {
    if (liked) {
      const [res] = await c.query<ResultSetHeader>('INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
      if (res.affectedRows) await c.query('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [postId]);
    } else {
      const [res] = await c.query<ResultSetHeader>('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
      if (res.affectedRows) await c.query('UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?', [postId]);
    }
  });
  await refresh(postId);
  await invalidateReposts(postId);
}

/** Reposts embed the original in their cached copy, so drop those too. */
async function invalidateReposts(postId: number) {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM posts WHERE repost_of_id = ?', [postId]);
  if (rows.length) await refresh(...rows.map((r) => Number(r.id)));
}

export async function repost(userId: number, postId: number): Promise<number> {
  const id = await withTx(async (c) => {
    const [orig] = await c.query<RowDataPacket[]>('SELECT id, repost_of_id FROM posts WHERE id = ? FOR UPDATE', [postId]);
    if (!orig[0]) throw Object.assign(new Error('Post not found'), { statusCode: 404 });
    const target = orig[0].repost_of_id ? Number(orig[0].repost_of_id) : postId; // reposting a repost reposts the original
    const [res] = await c.query<ResultSetHeader>('INSERT IGNORE INTO posts (user_id, repost_of_id, body) VALUES (?, ?, \'\')', [userId, target]);
    if (!res.affectedRows) return { id: 0, target };
    await c.query('UPDATE posts SET repost_count = repost_count + 1 WHERE id = ?', [target]);
    return { id: res.insertId, target };
  });
  await refresh(id.target);
  await invalidateReposts(id.target);
  if (id.id) await pushFeed(id.id);
  return id.id;
}

export async function unrepost(userId: number, postId: number): Promise<void> {
  const rows = await withTx(async (c) => {
    const [r] = await c.query<RowDataPacket[]>('SELECT id FROM posts WHERE user_id = ? AND repost_of_id = ? FOR UPDATE', [userId, postId]);
    if (!r[0]) return null;
    await c.query('DELETE FROM posts WHERE id = ?', [r[0].id]);
    await c.query('UPDATE posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = ?', [postId]);
    return Number(r[0].id);
  });
  if (rows) await safe(() => redis.zrem(FEED_KEY, String(rows)));
  await refresh(postId, ...(rows ? [rows] : []));
  await invalidateReposts(postId);
}
