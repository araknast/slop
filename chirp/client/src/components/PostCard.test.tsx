import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PostCard from './PostCard';
import { alice, bob, mkPost, mockApi, renderApp } from '../test/utils';

const signedIn = { 'GET /api/auth/me': [200, { user: alice }] as [number, unknown] };

describe('PostCard', () => {
  it('renders author, body and counts', async () => {
    mockApi(signedIn);
    renderApp(<PostCard post={mkPost()} />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/@bob/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2/ })).toBeInTheDocument();
  });

  it('shows the reposter and the original content for reposts', async () => {
    mockApi(signedIn);
    const orig = mkPost({ id: 5, body: 'original text', author: bob });
    renderApp(<PostCard post={mkPost({ id: 11, author: alice, body: '', repostOf: orig })} />);
    expect(screen.getByText('original text')).toBeInTheDocument();
    expect(screen.getByText(/reposted/)).toBeInTheDocument();
  });

  it('likes optimistically and calls the API', async () => {
    const calls = mockApi({ ...signedIn, 'PUT /api/posts/10/like': [200, { ok: true }] });
    renderApp(<PostCard post={mkPost()} />);
    const like = await screen.findByRole('button', { name: /2/ });
    await waitFor(() => expect(like).toBeEnabled());
    await userEvent.click(like);
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /api/posts/10/like')).toBe(true));
  });

  it('shows delete only on own posts', async () => {
    mockApi(signedIn);
    const { unmount } = renderApp(<PostCard post={mkPost({ author: alice })} />);
    expect(await screen.findByTitle('Delete')).toBeInTheDocument();
    unmount();
    renderApp(<PostCard post={mkPost({ author: bob })} />);
    await screen.findByText('hello world');
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});
