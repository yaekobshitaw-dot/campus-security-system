// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

vi.mock('./ProfilePage', () => ({ default: () => <div>Profile tools</div> }));
vi.mock('./AdminPages', () => ({ SystemSettingsPage: () => <div>System settings controls</div> }));

const renderSettings = (role) => render(
  <MemoryRouter>
    <SettingsPage user={{ user_id: `user-${role}`, name: 'Test User', role }} onLogout={vi.fn()} />
  </MemoryRouter>,
);

beforeEach(() => localStorage.clear());
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
});
