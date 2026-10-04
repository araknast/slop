import { describe, expect, it } from 'vitest';
import { api, ApiError } from './client';
import { mockApi } from '../test/utils';

describe('api client', () => {
  it('sends JSON with credentials and parses responses', async () => {
    const calls = mockApi({ 'POST /api/posts': [201, { post: { id: 1 } }] });
    const res = await api.create('hi', 3);
    expect(res.post.id).toBe(1);
    expect(calls[0].body).toEqual({ body: 'hi', parentId: 3 });
    expect((fetch as any).mock.calls[0][1].credentials).toBe('include');
  });

  it('throws ApiError with status and server message', async () => {
    mockApi({ 'GET /api/auth/me': [401, { error: 'Not authenticated' }] });
    await expect(api.me()).rejects.toMatchObject({ status: 401, message: 'Not authenticated' });
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
  });

  it('appends the cursor to paginated requests', async () => {
    const calls = mockApi({ 'GET /api/posts': [200, { posts: [], nextCursor: null }] });
    await api.feed(42);
    expect((fetch as any).mock.calls[0][0]).toBe('/api/posts?before=42');
    expect(calls).toHaveLength(1);
  });
});
