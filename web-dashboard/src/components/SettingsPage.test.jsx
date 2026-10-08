// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import api from '../services/api';

vi.mock('./ProfilePage', () => ({ default: () => <div>Profile tools</div> }));
vi.mock('./AdminPages', () => ({ SystemSettingsPage: () => <div>System settings controls</div> }));
vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const renderSettings = (role, userOverrides = {}) => render(
  <MemoryRouter>
    <SettingsPage user={{ user_id: `user-${role}`, name: 'Test User', role, ...userOverrides }} onUpdated={vi.fn()} onLogout={vi.fn()} />
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: [] } });
});
afterEach(cleanup);

describe('centralized settings', () => {
  it.each(['student', 'security', 'security_officer', 'faculty'])('hides administrator controls for %s', (role) => {
    renderSettings(role);

    expect(screen.getByText('Profile tools')).toBeInTheDocument();
    expect(screen.queryByText('Admin features')).not.toBeInTheDocument();
    expect(screen.queryByText('System settings controls')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows existing admin feature links to administrators', () => {
    renderSettings('admin');

    expect(screen.getByText('Admin features')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'User Management' })).toHaveAttribute('href', '/users');
    expect(screen.getByText('System settings controls')).toBeInTheDocument();
  });

  it('persists theme and notification preferences per user', () => {
    renderSettings('student');

    fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
    expect(localStorage.getItem('campussecure-theme:user-student')).toBe('dark');

    fireEvent.click(screen.getByRole('checkbox', { name: /Incident notifications/ }));
    expect(JSON.parse(localStorage.getItem('campussecure-preferences:user-student'))).toMatchObject({
      incidentNotifications: false,
      sosNotifications: true,
    });
  });

  it('shows operational recommendations only to administrators', () => {
    renderSettings('admin');

    expect(screen.getByLabelText('Dashboard refresh interval')).toBeInTheDocument();
    expect(screen.getByLabelText('Default map style')).toBeInTheDocument();
    expect(screen.getByLabelText('Table density')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Confirm before clearing history/ })).toBeInTheDocument();
  });

  it('shows response recommendations without administrator controls to security officers', () => {
    renderSettings('security_officer');

    expect(screen.getByLabelText('Dashboard refresh interval')).toBeInTheDocument();
    expect(screen.getByLabelText('Default map style')).toBeInTheDocument();
    expect(screen.getByLabelText('Preferred officer availability')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Response notifications/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Table density')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Confirm before clearing history/ })).not.toBeInTheDocument();
  });

  it('shows student privacy preferences without administrative or security settings', () => {
    renderSettings('student');

    expect(screen.getByRole('checkbox', { name: /Share location by default/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Confirm before sending SOS/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Display text size')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard refresh interval')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Default map style')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Response notifications/ })).not.toBeInTheDocument();
  });

  it('persists recommended settings and resets them to defaults', () => {
    renderSettings('student');

    const locationSharing = screen.getByRole('checkbox', { name: /Share location by default/ });
    fireEvent.click(locationSharing);
    expect(JSON.parse(localStorage.getItem('campussecure-preferences:user-student')).shareLocation).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));
    expect(JSON.parse(localStorage.getItem('campussecure-preferences:user-student')).shareLocation).toBe(true);
    expect(screen.getByRole('checkbox', { name: /Share location by default/ })).toBeChecked();
  });

  it('uses the supported application language selector', () => {
    renderSettings('student');

    fireEvent.change(screen.getByRole('combobox', { name: 'Application language' }), { target: { value: 'am' } });
    expect(localStorage.getItem('campussecure-language')).toBe('am');
  });

  it('loads security sessions and starts MFA setup through the backend', async () => {
    api.get.mockResolvedValue({ data: { data: [{ session_id: 'session-1', device_label: 'Chrome', created_at: '2026-01-01', last_active_at: '2026-01-02', expires_at: '2026-02-01' }] } });
    api.post.mockResolvedValue({ data: { data: { otpauthUrl: 'otpauth://totp/Campus:user?secret=temporary' } } });
    renderSettings('student');

    expect(await screen.findByText('Chrome')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable MFA' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/security/mfa/setup'));
    expect(screen.getByLabelText('Authenticator setup URI')).toHaveValue('otpauth://totp/Campus:user?secret=temporary');
  });

  it('enables MFA after successful verification and displays recovery codes once', async () => {
    api.post
      .mockResolvedValueOnce({ data: { data: { otpauthUrl: 'otpauth://totp/Campus:user?secret=temporary' } } })
      .mockResolvedValueOnce({ data: { data: { enabled: true, recoveryCodes: ['one-code', 'two-code'] } } });
    renderSettings('student');

    fireEvent.click(screen.getByRole('button', { name: 'Enable MFA' }));
    await screen.findByLabelText('Current six-digit code');
    fireEvent.change(screen.getByLabelText('Current six-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable MFA' }));

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/security/mfa/enable', { code: '123456' }));
    expect(await screen.findByText('MFA is enabled for this account.')).toBeInTheDocument();
    expect(screen.getByText('one-code')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide recovery codes' }));
    expect(screen.queryByText('one-code')).not.toBeInTheDocument();
  });

  it('shows the backend error when MFA verification fails', async () => {
    api.post
      .mockResolvedValueOnce({ data: { data: { otpauthUrl: 'otpauth://totp/Campus:user?secret=temporary' } } })
      .mockRejectedValueOnce({ response: { data: { message: 'Invalid MFA code' } } });
    renderSettings('student');

    fireEvent.click(screen.getByRole('button', { name: 'Enable MFA' }));
    await screen.findByLabelText('Current six-digit code');
    fireEvent.change(screen.getByLabelText('Current six-digit code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and enable MFA' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid MFA code');
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('revokes an individual session and logs out all sessions after confirmation', async () => {
    api.get.mockResolvedValue({ data: { data: [{ session_id: 'session-1', device_label: 'Chrome' }] } });
    api.delete.mockResolvedValue({ data: { success: true } });
    api.post.mockResolvedValue({ data: { success: true } });
    const onLogout = vi.fn();
    render(<MemoryRouter><SettingsPage user={{ user_id: 'user-student', role: 'student' }} onLogout={onLogout} /></MemoryRouter>);
    window.confirm = vi.fn(() => true);

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke session' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/security/sessions/session-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Logout All Sessions' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/security/sessions/revoke-all'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows the audit link only to administrators', () => {
    const { unmount } = renderSettings('student');
    expect(screen.queryByRole('link', { name: 'Open Audit Logs' })).not.toBeInTheDocument();
    unmount();
    renderSettings('admin');
    expect(screen.getByRole('link', { name: 'Open Audit Logs' })).toHaveAttribute('href', '/audit-logs');
  });
});
