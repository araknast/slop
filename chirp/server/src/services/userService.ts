import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { del, getOrSet } from '../cache/redis.js';

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: string;
}

export const toUser = (r: RowDataPacket): PublicUser => ({
  id: Number(r.id),
  username: r.username,
  displayName: r.display_name,
  bio: r.bio,
  avatarUrl: r.avatar_url,
  createdAt: new Date(r.created_at).toISOString(),
});

export const getUserById = (id: number) =>
  getOrSet<PublicUser>(`user:id:${id}`, 300, async () => {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  });

export const getUserByUsername = (username: string) =>
  getOrSet<PublicUser>(`user:name:${username.toLowerCase()}`, 300, async () => {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] ? toUser(rows[0]) : null;
  });

export const invalidateUser = (u: Pick<PublicUser, 'id' | 'username'>) =>
  del(`user:id:${u.id}`, `user:name:${u.username.toLowerCase()}`);
