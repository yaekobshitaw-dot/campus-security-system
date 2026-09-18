// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('./services/api', () => ({
  default: { get: apiGet },
}));

vi.mock('./components/Dashboard', () => ({
  default: () => <div>Dashboard loaded</div>,
}));

vi.mock('./components/AuthScreens', () => ({
  ForgotPasswordScreen: () => <div>Forgot password</div>,
  LoginScreen: () => <div>Login screen</div>,
  OAuthCallbackScreen: () => <div>OAuth callback</div>,
  ResetPasswordScreen: () => <div>Reset password</div>,
}));

vi.mock('./components/PublicSite', () => ({
  default: () => <div>Public site</div>,
  AuthPage: () => <div>Auth page</div>,
}));

const storedUser = { user_id: 'admin-1', name: 'Admin User', role: 'admin' };

beforeEach(() => {
  apiGet.mockReset();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('App authentication restoration', () => {
  it('waits for session validation before rendering a protected route', async () => {
    let resolveProfile;
    apiGet.mockReturnValue(new Promise((resolve) => {
      resolveProfile = resolve;
    }));
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(storedUser));

    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);

    expect(screen.getByText('Loading Campus Security...')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard loaded')).not.toBeInTheDocument();

    resolveProfile({ data: { data: storedUser } });

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/users/profile');
  });

  it('clears an invalid stored session and redirects to login', async () => {
    apiGet.mockRejectedValue({ response: { status: 401 } });
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify(storedUser));

    render(<MemoryRouter initialEntries={['/incidents/active']}><App /></MemoryRouter>);

    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  it('redirects directly opened protected routes without a stored session', async () => {
    render(<MemoryRouter initialEntries={['/locations']}><App /></MemoryRouter>);

    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });
});
