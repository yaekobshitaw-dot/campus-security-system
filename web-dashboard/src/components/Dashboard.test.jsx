// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { get: apiGet, post: apiPost }
}));

describe('Dashboard', () => {
  it('assigns an available security officer and displays the assignment', async () => {
    let assigned = false;
    const incident = {
      incident_id: 'incident-1',
      type: 'theft',
      description: 'Test incident',
      severity: 'medium',
      status: 'reported',
      location_name: 'Library',
      created_at: '2026-09-09T10:00:00.000Z',
      responses: []
    };
    const officer = { user_id: 'officer-1', name: 'Officer Test', role: 'security', availability_status: 'available' };
    apiGet.mockImplementation((url) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [{ ...incident, responses: assigned ? [{ responder_id: officer.user_id, responder: officer }] : [] }] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [officer] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 1, active: 1, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockImplementation(() => {
      assigned = true;
      return Promise.resolve({ data: { success: true } });
    });

    render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);

    const assignment = await screen.findByRole('combobox', { name: 'Assign officer for theft' });
    fireEvent.change(assignment, { target: { value: officer.user_id } });

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/incidents/incident-1/assign', { officer_id: officer.user_id }));
    expect((await screen.findAllByText('Officer Test')).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the overview shell', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>);
    expect(screen.getByText('Campus overview')).toBeInTheDocument();
  });

  it('renders the response team officer status and location', async () => {
    render(<MemoryRouter initialEntries={['/officers']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);

    expect((await screen.findAllByText('Officer Test')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Location unavailable|Location:/)).toBeInTheDocument();
  });
});
