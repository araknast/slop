import { Redis } from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redis.on('error', () => {}); // cache is best-effort; MySQL is authoritative

/** Run a cache operation, swallowing Redis failures so callers fall back to MySQL. */
export async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

export async function getOrSet<T>(key: string, ttlSec: number, load: () => Promise<T | null>): Promise<T | null> {
  const hit = await safe(() => redis.get(key));
  if (hit) return JSON.parse(hit) as T;
  const value = await load();
  if (value !== null) await safe(() => redis.set(key, JSON.stringify(value), 'EX', ttlSec));
  return value;
}

export const del = (...keys: string[]) => safe(() => redis.del(...keys));
