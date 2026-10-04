import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Composer from './Composer';
import { alice, mkPost, mockApi, renderApp } from '../test/utils';

describe('Composer', () => {
  it('disables Post when empty or over 280 chars, enables otherwise', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: alice }] });
    renderApp(<Composer />);
    const box = await screen.findByPlaceholderText("What's happening?");
    const btn = screen.getByRole('button', { name: 'Post' });
    expect(btn).toBeDisabled();
    await userEvent.type(box, 'hi');
    expect(btn).toBeEnabled();
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste('x'.repeat(281));
    expect(btn).toBeDisabled();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('submits and clears the text', async () => {
    const calls = mockApi({ 'GET /api/auth/me': [200, { user: alice }], 'POST /api/posts': [201, { post: mkPost() }] });
    renderApp(<Composer />);
    const box = await screen.findByPlaceholderText("What's happening?");
    await userEvent.type(box, 'my first chirp');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(box).toHaveValue(''));
    expect(calls.find((c) => c.key === 'POST /api/posts')?.body).toEqual({ body: 'my first chirp' });
  });

  it('shows server errors', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: alice }], 'POST /api/posts': [429, { error: 'Slow down' }] });
    renderApp(<Composer />);
    await userEvent.type(await screen.findByPlaceholderText("What's happening?"), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('Slow down')).toBeInTheDocument();
  });
});
