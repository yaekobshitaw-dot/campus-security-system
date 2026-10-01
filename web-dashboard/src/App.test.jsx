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
const notificationRoles = ['student', 'faculty', 'staff', 'security', 'security_officer', 'admin'];

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((url) => url === '/system/status'
    ? Promise.resolve({ data: { data: { active: true } } })
    : Promise.resolve({ data: { data: [] } }));
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('App authentication restoration', () => {
  it('waits for session validation before rendering a protected route', async () => {
    let resolveProfile;
    apiGet.mockImplementation((url) => url === '/system/status'
      ? Promise.resolve({ data: { data: { active: true } } })
      : new Promise((resolve) => { resolveProfile = resolve; }));
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
    apiGet.mockResolvedValue({ data: { data: { active: true } } });
    render(<MemoryRouter initialEntries={['/locations']}><App /></MemoryRouter>);

    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/system/status');
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it.each(notificationRoles)('allows the authenticated %s role to open Notifications', async (role) => {
    const user = { user_id: `${role}-1`, name: `${role} user`, role };
    apiGet.mockImplementation((url) => url === '/system/status'
      ? Promise.resolve({ data: { data: { active: true } } })
      : Promise.resolve({ data: { data: user } }));
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(user));

    render(<MemoryRouter initialEntries={['/notifications']}><App /></MemoryRouter>);

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });

  it('shows a maintenance state to a signed-in non-admin while the system is deactivated', async () => {
    const student = { user_id: 'student-1', name: 'Student User', role: 'student' };
    apiGet.mockImplementation((url) => url === '/system/status'
      ? Promise.resolve({ data: { data: { active: false } } })
      : Promise.resolve({ data: { data: student } }));
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(student));

    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'System temporarily unavailable' })).toBeInTheDocument();
    expect(screen.getByText(/deactivated for maintenance/i)).toBeInTheDocument();
    expect(screen.queryByText('Dashboard loaded')).not.toBeInTheDocument();
  });

  it('keeps Admin access to the dashboard when the system is deactivated', async () => {
    apiGet.mockImplementation((url) => url === '/system/status'
      ? Promise.resolve({ data: { data: { active: false } } })
      : Promise.resolve({ data: { data: storedUser } }));
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify(storedUser));

    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>);

    expect(await screen.findByText('Dashboard loaded')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'System temporarily unavailable' })).not.toBeInTheDocument();
  });
});
