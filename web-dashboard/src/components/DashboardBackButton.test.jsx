// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DashboardBackButton from './DashboardBackButton';

describe('DashboardBackButton', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('returns from incident details to the immediately previous Active Incidents page', async () => {
    window.history.replaceState({ idx: 2 }, '', '/');
    render(
      <MemoryRouter
        initialEntries={['/dashboard', '/incidents/active', '/incidents/incident-1']}
        initialIndex={2}
      >
        <Routes>
          <Route path="/dashboard" element={<p>Dashboard Overview</p>} />
          <Route path="/incidents/active" element={<p>Active Incidents</p>} />
          <Route path="/incidents/:incidentId" element={<DashboardBackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('Active Incidents')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Overview')).not.toBeInTheDocument();
  });

  it('returns from report details to the immediately previous Analytics page', async () => {
    window.history.replaceState({ idx: 2 }, '', '/');
    render(
      <MemoryRouter
        initialEntries={['/dashboard', '/analytics', '/analytics/reports/report-1']}
        initialIndex={2}
      >
        <Routes>
          <Route path="/dashboard" element={<p>Dashboard Overview</p>} />
          <Route path="/analytics" element={<p>Reports / Analytics</p>} />
          <Route path="/analytics/reports/:reportId" element={<DashboardBackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('Reports / Analytics')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Overview')).not.toBeInTheDocument();
  });

  it('returns from Edit User to User Details, one history entry at a time', async () => {
    window.history.replaceState({ idx: 3 }, '', '/');
    render(
      <MemoryRouter
        initialEntries={['/dashboard', '/users', '/users/user-1', '/users/user-1/edit']}
        initialIndex={3}
      >
        <Routes>
          <Route path="/dashboard" element={<p>Dashboard Overview</p>} />
          <Route path="/users" element={<p>User Management</p>} />
          <Route path="/users/:userId" element={<p>User Details</p>} />
          <Route path="/users/:userId/edit" element={<DashboardBackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('User Details')).toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('returns to the immediately previous dashboard page', async () => {
    window.history.replaceState({ idx: 2 }, '', '/');
    render(
      <MemoryRouter initialEntries={['/dashboard', '/users', '/analytics']} initialIndex={2}>
        <Routes>
          <Route path="/dashboard" element={<p>Dashboard Overview</p>} />
          <Route path="/users" element={<p>User Management</p>} />
          <Route path="/analytics" element={<DashboardBackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('User Management')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Overview')).not.toBeInTheDocument();
  });

  it('falls back to the immediate parent page when there is no previous history entry', async () => {
    window.history.replaceState({ idx: 0 }, '', '/');
    render(
      <MemoryRouter initialEntries={['/users/user-1/edit']}>
        <Routes>
          <Route path="/users/:userId" element={<p>User Details</p>} />
          <Route path="/users/:userId/edit" element={<DashboardBackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('User Details')).toBeInTheDocument();
  });

  it('falls back from an incident detail to Active Incidents when there is no history', async () => {
    window.history.replaceState({ idx: 0 }, '', '/');
    render(
      <MemoryRouter initialEntries={['/incidents/incident-1']}>
        <Routes>
          <Route path="/incidents/active" element={<p>Active Incidents</p>} />
          <Route path="/incidents/:incidentId" element={<DashboardBackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('Active Incidents')).toBeInTheDocument();
  });

  it('uses an internal view handler without navigating browser history', () => {
    const onBack = vi.fn();
    render(
      <MemoryRouter>
        <DashboardBackButton onBack={onBack} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
