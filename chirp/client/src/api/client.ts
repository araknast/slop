export interface User { id: number; username: string; displayName: string; bio: string; avatarUrl: string | null; createdAt: string }
export interface Post {
  id: number; author: User; body: string; parentId: number | null; repostOf: Post | null;
  likeCount: number; replyCount: number; repostCount: number; createdAt: string;
  likedByMe?: boolean; repostedByMe?: boolean;
}
export interface Page { posts: Post[]; nextCursor: number | null }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong');
  return data as T;
}

const qs = (cursor?: number) => (cursor ? `?before=${cursor}` : '');

export const api = {
  me: () => req<{ user: User }>('/auth/me'),
  register: (b: { username: string; displayName: string; password: string }) => req<{ user: User }>('/auth/register', 'POST', b),
  login: (b: { username: string; password: string }) => req<{ user: User }>('/auth/login', 'POST', b),
  logout: () => req<{ ok: true }>('/auth/logout', 'POST'),
  feed: (cursor?: number) => req<Page>(`/posts${qs(cursor)}`),
  userPosts: (u: string, cursor?: number) => req<Page>(`/users/${u}/posts${qs(cursor)}`),
  user: (u: string) => req<{ user: User }>(`/users/${u}`),
  updateProfile: (b: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>) => req<{ user: User }>('/users/me', 'PATCH', b),
  post: (id: number) => req<{ post: Post; replies: Post[] }>(`/posts/${id}`),
  create: (body: string, parentId?: number) => req<{ post: Post }>('/posts', 'POST', { body, parentId }),
  remove: (id: number) => req<{ ok: true }>(`/posts/${id}`, 'DELETE'),
  like: (id: number, on: boolean) => req<{ ok: true }>(`/posts/${id}/like`, on ? 'PUT' : 'DELETE'),
  repost: (id: number, on: boolean) => req<{ ok: true }>(`/posts/${id}/repost`, on ? 'POST' : 'DELETE'),
};
