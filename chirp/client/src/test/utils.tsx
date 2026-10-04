import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Post, User } from '../api/client';
import { AuthProvider } from '../hooks/useAuth';

export const alice: User = { id: 1, username: 'alice', displayName: 'Alice', bio: '', avatarUrl: null, createdAt: '2026-01-01T00:00:00Z' };
export const bob: User = { ...alice, id: 2, username: 'bob', displayName: 'Bob' };

export const mkPost = (over: Partial<Post> = {}): Post => ({
  id: 10, author: bob, body: 'hello world', parentId: null, repostOf: null,
  likeCount: 2, replyCount: 1, repostCount: 0, createdAt: new Date().toISOString(),
  likedByMe: false, repostedByMe: false, ...over,
});

/** Stub fetch with a route table: { 'GET /api/auth/me': [200, body] } */
export function mockApi(routes: Record<string, [number, unknown]>) {
  const calls: { key: string; body?: any }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).split('?')[0]}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const [status, body] = routes[key] ?? [404, { error: `unmocked ${key}` }];
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

export function renderApp(ui: ReactElement, { route = '/' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
