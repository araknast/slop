import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AuthPage from './AuthPage';
import { alice, mockApi, renderApp } from '../test/utils';

describe('AuthPage', () => {
  it('toggles between sign up and log in forms', async () => {
    mockApi({ 'GET /api/auth/me': [401, { error: 'no' }] });
    renderApp(<AuthPage />);
    expect(screen.getByPlaceholderText('Display name')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.queryByPlaceholderText('Display name')).not.toBeInTheDocument();
  });

  it('shows the API error on failed login', async () => {
    mockApi({ 'GET /api/auth/me': [401, {}], 'POST /api/auth/login': [401, { error: 'Invalid username or password' }] });
    renderApp(<AuthPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'wrongpass{Enter}');
    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
  });

  it('registers with the entered details', async () => {
    const calls = mockApi({ 'GET /api/auth/me': [401, {}], 'POST /api/auth/register': [201, { user: alice }] });
    renderApp(<AuthPage />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('Display name'), 'Alice');
    await userEvent.type(screen.getByPlaceholderText(/Password/), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('button', { name: 'Create account' });
    expect(calls.find((c) => c.key === 'POST /api/auth/register')?.body).toEqual({ username: 'alice', displayName: 'Alice', password: 'password123' });
  });
});
