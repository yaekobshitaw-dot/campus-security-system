// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { DashboardLayout, IncidentStatusBadge, IncidentTable } from './DashboardLayout';
import webSocket from '../services/socket';

const { apiGet, apiPost, apiPatch, apiDelete } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));

vi.mock('../services/api', () => ({
  default: { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete }
}));

vi.mock('../services/socket', () => {
  const listeners = {};

  const webSocket = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event, callback) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(callback);
    }),
    off: vi.fn((event, callback) => {
      if (!listeners[event]) return;
      if (!callback) {
        delete listeners[event];
        return;
      }
      listeners[event] = listeners[event].filter((listener) => listener !== callback);
    }),
    emit: vi.fn((event, payload) => {
      (listeners[event] || []).forEach((callback) => callback(payload));
    }),
  };

  return {
    webSocket,
    default: webSocket,
  };
});

vi.mock('./SecurityMap.jsx', () => ({
  default: ({ focusedIncidentId }) => <div data-testid="security-map" data-focused-incident={focusedIncidentId || ''} />
}));

vi.mock('./MLDashboard.jsx', () => ({
  default: () => <div data-testid="ml-dashboard" />
}));

describe('Dashboard', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPatch.mockReset();
    apiDelete.mockReset();
    localStorage.removeItem('campussecure-language');
    sessionStorage.clear();
    apiGet.mockImplementation(() => Promise.resolve({ data: { data: [] } }));
    apiPost.mockResolvedValue({ data: { success: true } });
    apiPatch.mockResolvedValue({ data: { success: true } });
    apiDelete.mockResolvedValue({ data: { success: true } });
  });

  it('renders the footer outside the sidebar workspace at viewport width', () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardLayout user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }}>
          <div>Dashboard content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );
    const dashboardApp = container.querySelector('.dashboard-app');
    const footer = container.querySelector('.public-footer');

    expect(screen.getByRole('heading', { name: 'Overview' })).toHaveClass('dashboard-title');
    expect(screen.getByRole('button', { name: 'Live Feed' })).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('dashboard-footer-compact');
    expect(footer.parentElement).toBe(dashboardApp);
    expect(footer.previousElementSibling).toHaveClass('dashboard-main');
    expect(footer.closest('.dashboard-workspace, .dashboard-content')).toBeNull();
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Mekdela Amba University Security System`);
    expect(footer).toHaveTextContent('v1.0.0');
    expect(footer.querySelector('a, button, svg')).toBeNull();
    expect(footer.children[0]).toHaveClass('dashboard-footer-copyright');
    expect(footer.children[1]).toHaveClass('dashboard-footer-separator');
    expect(footer.children[2]).toHaveClass('dashboard-footer-version');
  });

  it('does not show assignment requests on the Admin Dashboard while retaining the request data path', async () => {
    const assignment = {
      response_id: 'assignment-1',
      assignment_status: 'pending',
      incident_id: 'incident-1',
      incident: { incident_id: 'incident-1', type: 'theft', location_name: 'Library' },
    };
    apiGet.mockImplementation((url) => (
      url === '/incidents/responses/pending'
        ? Promise.resolve({ data: { data: [assignment] } })
        : Promise.resolve({ data: { data: [] } })
    ));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Campus overview' })).toBeInTheDocument();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/incidents/responses/pending'));
    expect(screen.queryByRole('heading', { name: 'New assignment request' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Assignment' })).not.toBeInTheDocument();
  });

  it('only adds Socket.IO notifications addressed to the logged-in user', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard user={{ user_id: 'officer-a', role: 'security', name: 'Officer A' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Campus overview' })).toBeInTheDocument();
    act(() => {
      webSocket.emit('notification-created', {
        notification_id: 'admin-private',
        user_id: 'admin-a',
        type: 'system_settings_changed',
        title: 'Admin-only notification',
        message: 'Private Admin message',
        is_read: false,
      });
      webSocket.emit('notification-created', {
        notification_id: 'officer-b-private',
        user_id: 'officer-b',
        type: 'officer_assignment',
        title: 'Officer B assignment',
        message: 'Private Officer B message',
        is_read: false,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByText('Admin-only notification')).not.toBeInTheDocument();
    expect(screen.queryByText('Officer B assignment')).not.toBeInTheDocument();

    act(() => {
      webSocket.emit('notification-created', {
        notification_id: 'officer-a-private',
        user_id: 'officer-a',
        type: 'officer_assignment',
        title: 'Officer A assignment',
        message: 'Private Officer A message',
        is_read: false,
      });
    });

    expect(await screen.findByText('Officer A assignment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveTextContent('1');
  });

  it('shows a bundled MAU campus image and falls back to another bundled image', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} />
        </MemoryRouter>,
      );
    });

    const campusImage = screen.getByAltText('Mekdela Amba University campus grounds and buildings');
    expect(campusImage).toHaveAttribute('src', '/images/campus-4.jpg');
    fireEvent.error(campusImage);
    expect(campusImage).toHaveAttribute('src', '/images/campus-5.jpg');
  });

  it.each([
    ['reported', 'Reported'],
    ['assigned', 'Assigned'],
    ['accepted', 'Accepted'],
    ['in_progress', 'In Progress'],
    ['investigating', 'Investigating'],
    ['on_scene', 'On Scene'],
    ['resolved', 'Resolved'],
    ['declined', 'Declined'],
    ['unassigned', 'Unassigned'],
    ['cancelled', 'Cancelled'],
  ])('renders %s as readable incident status text', (status, label) => {
    render(<IncidentStatusBadge status={status} />);

    const badge = screen.getByText(label);
    expect(badge).toHaveAttribute('data-status', status);
    expect(badge).toHaveClass('incident-status-badge', 'whitespace-nowrap', 'font-bold');
  });

  it.each([
    ['reported', 'Reported'],
    ['in_progress', 'In Progress'],
    ['on_scene', 'On Scene'],
    ['declined', 'Declined'],
    ['unassigned', 'Unassigned'],
  ])('renders the %s status in the incident table without breaking status options', (status, label) => {
    const { container } = render(
      <IncidentTable
        incidents={[{
          incident_id: `incident-${status}`,
          type: 'Test incident',
          status,
          severity: 'medium',
          created_at: '2026-09-30T12:00:00.000Z',
        }]}
      />,
    );

    const badge = container.querySelector(`.incident-status-badge[data-status="${status}"]`);
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveClass('whitespace-nowrap', 'break-normal');
    expect(screen.getByRole('combobox', { name: 'Change status for Test incident' })).toHaveTextContent('On Scene');
  });

  it('shows On Scene after an accepted officer records arrival', async () => {
    const incident = {
      incident_id: '11111111-1111-4111-8111-111111111111',
      type: 'theft',
      status: 'investigating',
      severity: 'high',
      location_name: 'Library',
      created_at: '2026-09-30T12:00:00.000Z',
      responses: [{
        response_id: '44444444-4444-4444-8444-444444444444',
        responder_id: '22222222-2222-4222-8222-222222222222',
        assignment_status: 'accepted',
        status: 'responding',
      }],
    };
    const assignment = {
      ...incident.responses[0],
      incident_id: incident.incident_id,
      incident: { ...incident },
    };
    apiGet.mockImplementation((url) => (
      url === '/incidents'
        ? Promise.resolve({ data: { data: [incident] } })
        : url === '/incidents/responses/pending'
          ? Promise.resolve({ data: { data: [assignment] } })
          : Promise.resolve({ data: { data: [] } })
    ));
    apiPatch.mockImplementation(async (url) => {
      if (url === `/incidents/${incident.incident_id}/response`) {
        incident.status = 'on_scene';
        return { data: { data: { incident_id: incident.incident_id, response_id: assignment.response_id, status: 'responding', incident_status: 'on_scene' } } };
      }
      return { data: { success: true } };
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard user={{ user_id: assignment.responder_id, role: 'security', name: 'Officer Test' }} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Arrived' }));

    expect(apiPatch).toHaveBeenCalledWith(`/incidents/${incident.incident_id}/response`, { status: 'responding' });
    expect(await screen.findByText('On Scene')).toBeInTheDocument();
  });

  it('does not offer arrival while the assignment is pending', async () => {
    const assignment = {
      response_id: '44444444-4444-4444-8444-444444444444',
      responder_id: '22222222-2222-4222-8222-222222222222',
      assignment_status: 'pending',
      status: 'assigned',
      incident_id: '11111111-1111-4111-8111-111111111111',
      incident: {
        incident_id: '11111111-1111-4111-8111-111111111111',
        type: 'theft',
        status: 'reported',
        location_name: 'Library',
      },
    };
    apiGet.mockImplementation((url) => (
      url === '/incidents/responses/pending'
        ? Promise.resolve({ data: { data: [assignment] } })
        : Promise.resolve({ data: { data: [] } })
    ));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard user={{ user_id: assignment.responder_id, role: 'security', name: 'Officer Test' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Accept Assignment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arrived' })).not.toBeInTheDocument();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  it('sends only one arrival request for repeated clicks', async () => {
    const incidentId = '11111111-1111-4111-8111-111111111111';
    const responderId = '22222222-2222-4222-8222-222222222222';
    const assignment = {
      response_id: '44444444-4444-4444-8444-444444444444',
      responder_id: responderId,
      assignment_status: 'accepted',
      status: 'responding',
      incident_id: incidentId,
      incident: {
        incident_id: incidentId,
        type: 'theft',
        status: 'investigating',
        location_name: 'Library',
      },
    };
    let resolveArrival;
    apiGet.mockImplementation((url) => (
      url === '/incidents/responses/pending'
        ? Promise.resolve({ data: { data: [assignment] } })
        : Promise.resolve({ data: { data: [] } })
    ));
    apiPatch.mockImplementation(() => new Promise((resolve) => {
      resolveArrival = resolve;
    }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard user={{ user_id: responderId, role: 'security', name: 'Officer Test' }} />
      </MemoryRouter>,
    );

    const arrivedButton = await screen.findByRole('button', { name: 'Arrived' });
    act(() => {
      arrivedButton.click();
      arrivedButton.click();
    });

    expect(apiPatch).toHaveBeenCalledTimes(1);
    expect(apiPatch).toHaveBeenCalledWith(`/incidents/${incidentId}/response`, { status: 'responding' });
    await act(async () => resolveArrival({ data: { data: { incident_id: incidentId, incident_status: 'on_scene' } } }));
  });

  it('visually separates SOS incident detail labels from their values', async () => {
    const incident = {
      incident_id: 'sos-incident-1',
      type: 'emergency',
      is_sos: true,
      description: 'SOS emergency alert sent from the Campus Security mobile app.',
      location_name: 'Current device location',
      reporter: { name: 'haile' },
      created_at: '2026-09-30T12:01:47.000Z',
      status: 'reported',
      severity: 'critical',
    };
    apiGet.mockImplementation((url) => (
      url === '/incidents'
        ? Promise.resolve({ data: { data: [incident] } })
        : Promise.resolve({ data: { data: [] } })
    ));

    render(
      <MemoryRouter initialEntries={['/incidents/sos-incident-1']}>
        <Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(incident.description)).toBeInTheDocument();
    for (const label of ['Description', 'Location', 'Reporter', 'Assigned officer', 'Reported']) {
      const detailLabel = screen.getByText(label, { selector: 'dt' });
      expect(detailLabel).toBeInTheDocument();
      expect(detailLabel).toHaveClass('font-bold', 'text-sky-700');
    }
    expect(screen.getByText(incident.description).closest('dd')).toHaveClass('font-normal');
    expect(screen.getByText('Current device location').closest('dd')).toHaveClass('font-normal');
    expect(screen.getByText('haile').closest('dd')).toHaveClass('font-normal');
    expect(screen.getByText('Unassigned').closest('dd')).toHaveClass('font-normal');
    expect(screen.getByText(new Date(incident.created_at).toLocaleString()).closest('dd')).toHaveClass('font-normal');
  });

  it('creates a Security Officer from the User Management form', async () => {
    const newUser = { user_id: 'officer-new', name: 'Officer New', email: 'officer.new@example.com', role: 'security', is_active: true };
    apiGet.mockImplementation((url) => url === '/users/all' ? Promise.resolve({ data: { data: [] } }) : Promise.resolve({ data: { data: [] } }));
    apiPost.mockResolvedValue({ data: { data: { user: newUser } } });
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Create User' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Officer New' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'officer.new@example.com' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'security' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123' } });
    fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/auth/admin/create-user', {
      name: 'Officer New',
      email: 'officer.new@example.com',
      phone: '',
      role: 'security',
      is_active: true,
      password: 'StrongPass123',
    }));
    expect(await screen.findByText('Officer New')).toBeInTheDocument();
  });

  it.each([
    ['student', 'Student New', 'student.new@example.com'],
    ['admin', 'Admin New', 'admin.new@example.com'],
  ])('creates a user with the %s role when permitted', async (role, name, email) => {
    const newUser = { user_id: `${role}-new`, name, email, role, is_active: true };
    apiGet.mockImplementation((url) => url === '/users/all' ? Promise.resolve({ data: { data: [] } }) : Promise.resolve({ data: { data: [] } }));
    apiPost.mockResolvedValue({ data: { data: { user: newUser } } });
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Create User' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: role } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123' } });
    fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/auth/admin/create-user', expect.objectContaining({ name, email, role })));
    expect(await screen.findByText(name)).toBeInTheDocument();
  });

  it('disables admin creation after three Admin accounts exist', async () => {
    const admins = [1, 2, 3].map((number) => ({ user_id: `admin-${number}`, name: `Admin ${number}`, email: `admin${number}@example.com`, role: 'admin', is_active: true }));
    apiGet.mockImplementation((url) => url === '/users/all' ? Promise.resolve({ data: { data: admins } }) : Promise.resolve({ data: { data: [] } }));
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Create User' }));
    expect(screen.getAllByText('The maximum number of Admin accounts is 3.').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: 'Admin' })).toBeDisabled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('updates a user without replacing the password when the password fields are blank', async () => {
    const user = { user_id: 'student-1', name: 'Student One', email: 'student@example.com', role: 'student', phone: '', is_active: true };
    const updatedUser = { ...user, name: 'Updated Student' };
    apiGet.mockImplementation((url) => url === '/users/all' ? Promise.resolve({ data: { data: [user] } }) : Promise.resolve({ data: { data: [] } }));
    apiPatch.mockResolvedValue({ data: { data: updatedUser } });
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Student One' }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Updated Student' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/users/student-1', {
      name: 'Updated Student',
      email: 'student@example.com',
      phone: '',
      role: 'student',
      is_active: true,
    }));
    expect(await screen.findByText('Updated Student')).toBeInTheDocument();
  });

  it('confirms and deletes a selected user using the backend API', async () => {
    const user = { user_id: 'student-2', name: 'Student Two', email: 'student2@example.com', role: 'student', is_active: true };
    apiGet.mockImplementation((url) => url === '/users/all' ? Promise.resolve({ data: { data: [user] } }) : Promise.resolve({ data: { data: [] } }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Student Two' }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/users/student-2'));
    expect(confirm).toHaveBeenCalledWith('Delete Student Two (student2@example.com)? This cannot be undone.');
    expect(await screen.findByText('Student Two was deleted.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Student Two' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('shows the backend response message when deletion fails', async () => {
    const user = { user_id: 'student-3', name: 'Student Three', email: 'student3@example.com', role: 'student', is_active: true };
    apiGet.mockImplementation((url) => url === '/users/all' ? Promise.resolve({ data: { data: [user] } }) : Promise.resolve({ data: { data: [] } }));
    apiDelete.mockRejectedValue({ response: { status: 409, data: { message: 'This user cannot be deleted because existing records still reference the account.' } } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Student Three' }));
    expect(await screen.findByText('This user cannot be deleted because existing records still reference the account.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Student Three' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('does not show user management controls to non-admin roles', async () => {
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student' }} /></MemoryRouter>);

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create User' })).not.toBeInTheDocument();
  });

  it('shows one dismissible popup for a realtime incident report', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    const incident = { incident_id: 'incident-toast', type: 'theft', location_name: 'Library' };
    act(() => {
      webSocket.emit('new-incident', incident);
      webSocket.emit('new-incident', incident);
    });

    expect(screen.getAllByText('New incident reported')).toHaveLength(1);
    expect(screen.getByText('Theft · Library')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss incident notification' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('automatically dismisses a realtime incident popup after five seconds', () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);
      act(() => webSocket.emit('new-incident', { incident_id: 'incident-auto-dismiss', type: 'theft' }));
      expect(screen.getByRole('status')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(5000));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows one dismissible emergency popup for a realtime SOS alert', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    const alert = { incident_id: 'sos-toast', incident_type: 'medical_emergency', location_name: 'Science Building' };
    act(() => {
      webSocket.emit('sos_alert', alert);
      webSocket.emit('sos_alert', alert);
    });

    expect(screen.getAllByText('🚨 SOS Emergency Alert')).toHaveLength(1);
    expect(screen.getByText('Medical Emergency · Science Building')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss SOS emergency alert' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('automatically dismisses a realtime SOS popup after ten seconds', () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);
      act(() => webSocket.emit('sos_alert', { incident_id: 'sos-auto-dismiss', location_name: 'Library' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(10000));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

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
    const officer = { user_id: 'officer-1', name: 'Officer Test', role: 'security', availability_status: 'available', assignable: true };
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

  it('loads available officers and lets an admin assign one without the map', async () => {
    const incident = {
      incident_id: 'incident-assign',
      type: 'theft',
      description: 'Map-free assignment test',
      severity: 'high',
      status: 'reported',
      location_name: 'Library',
      created_at: '2026-09-09T10:00:00.000Z',
      responses: []
    };
    const officer = { user_id: 'officer-assign', name: 'Officer Available', role: 'security', availability_status: 'available', assignable: true };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [incident] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [officer] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 1, active: 1, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    const assignment = await screen.findByRole('combobox', { name: 'Assign officer for theft' });
    fireEvent.change(assignment, { target: { value: officer.user_id } });

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/incidents/incident-assign/assign', { officer_id: officer.user_id }));
    expect(screen.getByRole('option', { name: /Officer Available/i })).toBeInTheDocument();
  });

  it('does not show an unassignable officer in the assignment dropdown', async () => {
    const incident = {
      incident_id: 'incident-unassign',
      type: 'theft',
      description: 'Unassignable officer test',
      severity: 'high',
      status: 'reported',
      location_name: 'Library',
      created_at: '2026-09-09T10:00:00.000Z',
      responses: []
    };
    const unassignableOfficer = { user_id: 'officer-unassign', name: 'Officer Busy', role: 'security', availability_status: 'busy', assignable: false };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [incident] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [unassignableOfficer] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 1, active: 1, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    const assignment = await screen.findByRole('combobox', { name: 'Assign officer for theft' });
    await waitFor(() => expect(screen.queryByRole('option', { name: /Officer Busy/i })).not.toBeInTheDocument());
  });

  it('renders the overview shell', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>);
    expect(screen.getByText('Campus overview')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Overview' })).toHaveAttribute('src', '/images/dashboard-features/overview.svg');
  });

  it('keeps the incident form below the dashboard header', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={{ role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Report incident' }));

    const header = container.querySelector('.dashboard-header');
    const dialog = screen.getByRole('dialog', { name: 'Report an incident' });
    expect(header).toBeInTheDocument();
    expect(dialog).toHaveClass('dashboard-modal-below-header');
    expect(header.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the create-zone form below the dashboard header', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/zones']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Create zone' }));

    const header = container.querySelector('.dashboard-header');
    const dialog = screen.getByRole('dialog', { name: 'Create zone' });
    expect(header).toBeInTheDocument();
    expect(dialog).toHaveClass('dashboard-modal-below-header');
    expect(header.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(['admin', 'security', 'security_officer', 'student', 'faculty', 'staff'])(
    'shows the shared Clear history action for the authenticated %s role',
    async (role) => {
      render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: `${role}-1`, role, name: 'Campus User' }} /></MemoryRouter>);
      expect(await screen.findByRole('button', { name: 'Clear history' })).toBeInTheDocument();
    },
  );

  it('requires confirmation before clearing history', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Clear history' }));

    expect(confirm).toHaveBeenCalledWith('Clear your history? Your notification history will be removed. This action cannot be undone.');
    expect(apiDelete).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('clears a normal user notification history only and immediately refreshes the UI', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    sessionStorage.setItem('campus-security:notifications:student-1', JSON.stringify([
      { id: 'notice-1', title: 'Previous notification', message: 'Old notice', type: 'incident', read: false },
    ]));
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Previous notification')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/notifications/history'));
    expect(await screen.findByRole('status')).toHaveTextContent('Your notification history was cleared successfully.');
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('campus-security:notifications:student-1'))).toEqual([]));
    expect(screen.queryByText('Previous notification')).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('preserves the Admin system incident-history clearing behavior', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'admin-1', role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Clear history' }));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/incidents/history'));
    expect(confirm).toHaveBeenCalledWith('Clear all incident history permanently? This action cannot be undone.');
    expect(apiDelete).not.toHaveBeenCalledWith('/notifications/history');
    confirm.mockRestore();
  });

  it('shows an error without claiming history was cleared when the request fails', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiDelete.mockRejectedValue({ response: { data: { message: 'Unable to clear notification history' } } });
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Clear history' }));

    expect(await screen.findByText('Unable to clear notification history')).toBeInTheDocument();
    expect(screen.queryByText('Your notification history was cleared successfully.')).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('opens the existing ML Insights page on its route', () => {
    render(<MemoryRouter initialEntries={['/ml']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);
    expect(screen.getByTestId('ml-dashboard')).toBeInTheDocument();
  });

  it('does not expose an admin feature illustration to a student', () => {
    render(<MemoryRouter initialEntries={['/users']}><Dashboard user={{ role: 'student', name: 'Student Test' }} /></MemoryRouter>);
    expect(screen.queryByRole('img', { name: 'User management' })).not.toBeInTheDocument();
  });

  it('shares and persists the selected language from the dashboard header', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    const languageSelector = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.change(languageSelector, { target: { value: 'am' } });

    expect(localStorage.getItem('campussecure-language')).toBe('am');
    expect(screen.getByRole('combobox', { name: 'ቋንቋ' })).toHaveValue('am');
    expect(screen.getByRole('heading', { name: 'አጠቃላይ እይታ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'አሰሳን ክፈት' }));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ንቁ ክስተቶች' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'ቋንቋ' }), { target: { value: 'en' } });

    expect(localStorage.getItem('campussecure-language')).toBe('en');
    expect(screen.getByRole('button', { name: 'Active incidents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Campus overview' })).toBeInTheDocument();
  });

  it('renders the response team officer status and location', async () => {
    const officer = {
      user_id: 'officer-1',
      name: 'Officer Test',
      role: 'security',
      availability_status: 'available',
      location_status: 'unavailable',
      latitude: null,
      longitude: null,
    };

    apiGet.mockImplementation((url) => {
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [officer] } });
      return Promise.resolve({ data: { data: [] } });
    });

    render(<MemoryRouter initialEntries={['/officers']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);

    expect((await screen.findAllByText('Officer Test')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Location unavailable|Location:/)).toBeInTheDocument();
  });

  it('keeps an accepted assignment active through arrival on the overview', async () => {
    const pendingAssignment = {
      response_id: 'response-accept',
      created_at: '2026-09-09T10:00:00.000Z',
      assignment_status: 'pending',
      incident: {
        incident_id: 'incident-2',
        type: 'theft',
        severity: 'high',
        description: 'Pending assignment from admin',
        status: 'reported',
        location_name: 'Library',
      }
    };
    let assignmentStatus = 'pending';
    let responseStatus = 'assigned';
    let incidentStatus = 'reported';

    apiGet.mockImplementation((url) => {
      if (url === '/incidents/responses/pending') {
        return Promise.resolve({
          data: {
            data: assignmentStatus === 'pending'
              ? [{ ...pendingAssignment, assignment_status: assignmentStatus, status: responseStatus, incident: { ...pendingAssignment.incident, status: incidentStatus } }]
              : [],
          },
        });
      }
      if (url === '/incidents') {
        return Promise.resolve({
          data: {
            data: [{
              ...pendingAssignment.incident,
              status: incidentStatus,
              created_at: pendingAssignment.created_at,
            }],
          },
        });
      }
      if (url === '/alerts') return Promise.resolve({ data: { data: [] } });
      if (url === '/zones') return Promise.resolve({ data: { data: [] } });
      if (url === '/campus-locations') return Promise.resolve({ data: { data: [] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 0, active: 0, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockImplementation(() => {
      assignmentStatus = 'accepted';
      responseStatus = 'responding';
      incidentStatus = 'investigating';
      return Promise.resolve({
        data: {
          success: true,
          data: {
            response_id: pendingAssignment.response_id,
            incident_id: pendingAssignment.incident.incident_id,
            assignment_status: 'accepted',
            status: 'responding',
            incident_status: incidentStatus,
            responder: { user_id: 'officer-1', name: 'Security Test', role: 'security' },
            location_name: 'Library',
            latitude: null,
            longitude: null,
          },
        },
      });
    });
    apiPatch.mockImplementation((url, payload) => {
      if (url === '/incidents/incident-2/response' && payload.status === 'responding') {
        responseStatus = 'responding';
        incidentStatus = 'on_scene';
      } else if (url === '/incidents/incident-2/response' && payload.status === 'resolved') {
        responseStatus = 'resolved';
        incidentStatus = 'resolved';
      }
      return Promise.resolve({
        data: {
          success: true,
          data: {
            response_id: pendingAssignment.response_id,
            incident_id: pendingAssignment.incident.incident_id,
            status: payload.status,
            incident_status: incidentStatus,
          },
        },
      });
    });

    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);

    expect(await screen.findByText('New assignment request')).toBeInTheDocument();
    expect(await screen.findByText('incident-2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept Assignment' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/incidents/responses/response-accept/accept'));
    expect(await screen.findByText('incident-2')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Responding')).toBeInTheDocument();
    expect(incidentStatus).toBe('investigating');
    expect(screen.queryByRole('button', { name: 'Accept Assignment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrived' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve Incident' })).not.toBeInTheDocument();
    expect(apiPatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Arrived' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/incidents/incident-2/response', { status: 'responding' }));
    expect(await screen.findByText('Handling')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve Incident' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve Incident' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/incidents/incident-2/response', { status: 'resolved' }));
    expect(incidentStatus).toBe('resolved');
    expect(await screen.findByText('No active incidents')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve Incident' })).not.toBeInTheDocument();
  });

  it('allows declining a pending assignment request', async () => {
    const pendingAssignment = {
      response_id: 'response-decline',
      created_at: '2026-09-09T10:00:00.000Z',
      assignment_status: 'pending',
      incident: {
        incident_id: 'incident-3',
        type: 'medical',
        severity: 'medium',
        description: 'Decline request test',
        status: 'reported',
        location_name: 'Student Center',
      }
    };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents/responses/pending') return Promise.resolve({ data: { data: [pendingAssignment] } });
      if (url === '/incidents') return Promise.resolve({ data: { data: [] } });
      if (url === '/alerts') return Promise.resolve({ data: { data: [] } });
      if (url === '/zones') return Promise.resolve({ data: { data: [] } });
      if (url === '/campus-locations') return Promise.resolve({ data: { data: [] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 0, active: 0, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);

    expect(await screen.findByText('New assignment request')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/incidents/responses/response-decline/decline'));
    expect(await screen.findByText('Declined')).toHaveClass('incident-status-badge');
    expect(screen.queryByRole('button', { name: 'Accept Assignment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('keeps a declined incident visible and enables authorized reassignment', async () => {
    let assignmentDeclined = false;
    const incident = {
      incident_id: 'incident-declined',
      type: 'theft',
      severity: 'high',
      description: 'Declined assignment remains in the incident queue',
      status: 'reported',
      location_name: 'Library',
      responses: [{
        response_id: 'response-to-decline',
        assignment_status: 'pending',
        responder_id: 'officer-current',
        responder: { user_id: 'officer-current', name: 'Current Officer' },
      }],
    };
    const pendingAssignment = {
      response_id: 'response-to-decline',
      assignment_status: 'pending',
      incident,
      responder: incident.responses[0].responder,
    };
    const availableOfficer = {
      user_id: 'officer-next',
      name: 'Available Officer',
      availability_status: 'available',
      assignable: true,
    };
    apiGet.mockImplementation((url) => {
      if (url === '/incidents') {
        return Promise.resolve({
          data: {
            data: [{
              ...incident,
              responses: assignmentDeclined
                ? [{ ...incident.responses[0], assignment_status: 'declined', responder_id: null, responder: null }]
                : incident.responses,
            }],
          },
        });
      }
      if (url === '/incidents/responses/pending') {
        return Promise.resolve({ data: { data: assignmentDeclined ? [] : [pendingAssignment] } });
      }
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [availableOfficer] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 1, active: 1, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockImplementation((url) => {
      if (url === '/incidents/responses/response-to-decline/decline') {
        assignmentDeclined = true;
        return Promise.resolve({
          data: {
            data: {
              response_id: 'response-to-decline',
              incident_id: incident.incident_id,
              assignment_status: 'declined',
              incident_status: 'reported',
              status: 'declined',
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);

    expect((await screen.findAllByText(incident.description)).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(container.querySelector('[data-status="declined"]')).toBeInTheDocument());
    expect(container.querySelector('table.incident-table tbody tr')).toHaveTextContent(incident.description);

    const assignment = await screen.findByRole('combobox', { name: 'Assign officer for theft' });
    expect(assignment).toBeEnabled();
    expect(await screen.findByRole('option', { name: 'Available Officer' })).toBeEnabled();

    fireEvent.change(assignment, { target: { value: availableOfficer.user_id } });
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
      `/incidents/${incident.incident_id}/assign`,
      { officer_id: availableOfficer.user_id },
    ));
  });

  it('shows available officer selectable even when location is unavailable or stale', async () => {
    const incident = {
      incident_id: 'incident-stale',
      type: 'theft',
      description: 'Stale location assignment test',
      severity: 'medium',
      status: 'reported',
      location_name: 'Library',
      created_at: '2026-09-09T10:00:00.000Z',
      responses: []
    };
    const officer = {
      user_id: 'officer-stale',
      name: 'Officer Stale',
      role: 'security',
      availability_status: 'available',
      assignable: true,
      location_status: 'unavailable',
      location_is_stale: true,
      latitude: null,
      longitude: null,
    };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [incident] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [officer] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 1, active: 1, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    const assignment = await screen.findByRole('combobox', { name: 'Assign officer for theft' });
    const option = await screen.findByRole('option', { name: /Officer Stale/i });
    expect(option).toBeInTheDocument();
    expect(option).not.toBeDisabled();
  });

  it('shows accepted assignment state and hides accept/decline controls', async () => {
    const acceptedAssignment = {
      response_id: 'response-accepted',
      created_at: '2026-09-09T10:00:00.000Z',
      assignment_status: 'accepted',
      incident: {
        incident_id: 'incident-4',
        type: 'theft',
        severity: 'high',
        description: 'Already accepted assignment',
        status: 'investigating',
        location_name: 'North Gate',
      },
      responder: { user_id: 'officer-1', name: 'Officer Test' }
    };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents/responses/pending') return Promise.resolve({ data: { data: [acceptedAssignment] } });
      if (url === '/incidents') return Promise.resolve({ data: { data: [] } });
      if (url === '/alerts') return Promise.resolve({ data: { data: [] } });
      if (url === '/zones') return Promise.resolve({ data: { data: [] } });
      if (url === '/campus-locations') return Promise.resolve({ data: { data: [] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 0, active: 0, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);
    expect(await screen.findByText('New assignment request')).toBeInTheDocument();
    // Status badge element should contain Accepted and a Responding badge should be visible
    const statusEl = container.querySelector('.assignment-request-status');
    expect(statusEl).toBeTruthy();
    expect(statusEl.textContent).toMatch(/Accepted/i);
    expect(screen.getByText('Responding')).toBeInTheDocument();
    // Accepted assignments offer arrival; resolution is only available after arrival.
    expect(await screen.findByRole('button', { name: 'Arrived' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve Incident' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Assignment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
    // Clicking Arrived should record the officer's arrival.
    fireEvent.click(screen.getByRole('button', { name: 'Arrived' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/incidents/incident-4/response', { status: 'responding' }));
  });

  it('shows declined assignment state', async () => {
    const declinedAssignment = {
      response_id: 'response-declined',
      created_at: '2026-09-09T10:00:00.000Z',
      assignment_status: 'declined',
      incident: {
        incident_id: 'incident-5',
        type: 'medical',
        severity: 'medium',
        description: 'Declined assignment',
        status: 'reported',
        location_name: 'South Hall',
      }
    };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents/responses/pending') return Promise.resolve({ data: { data: [declinedAssignment] } });
      if (url === '/incidents') return Promise.resolve({ data: { data: [] } });
      if (url === '/alerts') return Promise.resolve({ data: { data: [] } });
      if (url === '/zones') return Promise.resolve({ data: { data: [] } });
      if (url === '/campus-locations') return Promise.resolve({ data: { data: [] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 0, active: 0, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security', name: 'Security Test' }} /></MemoryRouter>);
    expect(await screen.findByText('New assignment request')).toBeInTheDocument();
    const statusEl = container.querySelector('.assignment-request-status');
    expect(statusEl).toBeTruthy();
    expect(statusEl.textContent).toMatch(/Declined/i);
    // Declined assignments should not show Accept/Decline controls
    expect(screen.queryByRole('button', { name: 'Accept Assignment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('shows pending assignment controls for security_officer role', async () => {
    const pendingAssignment = {
      response_id: 'response-6',
      created_at: '2026-09-09T10:00:00.000Z',
      assignment_status: 'pending',
      incident: {
        incident_id: 'incident-6',
        type: 'medical',
        severity: 'low',
        description: 'Officer role test',
        status: 'reported',
        location_name: 'Gym',
      }
    };

    apiGet.mockImplementation((url) => {
      if (url === '/incidents/responses/pending') return Promise.resolve({ data: { data: [pendingAssignment] } });
      if (url === '/incidents') return Promise.resolve({ data: { data: [] } });
      if (url === '/alerts') return Promise.resolve({ data: { data: [] } });
      if (url === '/zones') return Promise.resolve({ data: { data: [] } });
      if (url === '/campus-locations') return Promise.resolve({ data: { data: [] } });
      if (url === '/users/security-officers') return Promise.resolve({ data: { data: [] } });
      if (url === '/incidents/stats') return Promise.resolve({ data: { data: { total: 0, active: 0, resolved: 0 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security_officer', name: 'Officer Test' }} /></MemoryRouter>);
    expect(await screen.findByText('New assignment request')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Accept Assignment' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('loads security operations for security_officer role', async () => {
    apiGet.mockImplementation((url) => url === '/incidents/stats'
      ? Promise.resolve({ data: { data: { total: 0, active: 0, resolved: 0 } } })
      : Promise.resolve({ data: { data: [] } }));

    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'security_officer', name: 'Officer Test' }} /></MemoryRouter>);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/incidents/stats');
      expect(apiGet).toHaveBeenCalledWith('/analytics');
      expect(apiGet).toHaveBeenCalledWith('/responses');
      expect(apiGet).toHaveBeenCalledWith('/users/security-officers');
    });
  });

  it('loads assignment reviews for admin, matching backend authorization', async () => {
    apiGet.mockImplementation((url) => url === '/incidents/responses/pending'
      ? Promise.resolve({ data: { data: [] } })
      : Promise.resolve({ data: { data: [] } }));

    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ role: 'admin', name: 'Admin Test' }} /></MemoryRouter>);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/incidents/responses/pending'));
  });

  it('uses the authenticated user notification list to show the unread badge', async () => {
    apiGet.mockImplementation((url) => url === '/notifications'
      ? Promise.resolve({ data: { data: [{ notification_id: 'n1', is_read: false }, { notification_id: 'n2', is_read: true }, { notification_id: 'n3', is_read: false }] } })
      : Promise.resolve({ data: { data: [] } }));

    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    await waitFor(() => expect(container.querySelector('.dashboard-notification-badge')).toHaveTextContent('2'));
    expect(apiGet).toHaveBeenCalledWith('/notifications');
  });

  it('shows the same unread notifications in the bell panel as in its badge', async () => {
    apiGet.mockImplementation((url) => url === '/notifications'
      ? Promise.resolve({ data: { data: [
        { notification_id: 'n1', title: 'Incident near the library', message: 'A theft was reported.', type: 'incident', is_read: false, created_at: '2026-09-30T06:00:00Z' },
        { notification_id: 'n2', title: 'Emergency alert', message: 'An SOS was reported.', type: 'sos_alert', is_read: false, created_at: '2026-09-30T06:05:00Z' },
      ] } })
      : Promise.resolve({ data: { data: [] } }));

    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.dashboard-notification-badge')).toHaveTextContent('2'));

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Incident near the library')).toBeInTheDocument();
    expect(screen.getByText('Emergency alert')).toBeInTheDocument();
    expect(screen.queryByText('No new notifications')).not.toBeInTheDocument();
  });

  it('clears the displayed notification list and derives a zero unread count from it', async () => {
    apiGet.mockImplementation((url) => url === '/notifications'
      ? Promise.resolve({ data: { data: [
        { notification_id: 'n1', title: 'Incident near the library', message: 'A theft was reported.', type: 'incident', is_read: false, created_at: '2026-09-30T06:00:00Z' },
        { notification_id: 'n2', title: 'Emergency alert', message: 'An SOS was reported.', type: 'sos_alert', is_read: false, created_at: '2026-09-30T06:05:00Z' },
      ] } })
      : Promise.resolve({ data: { data: [] } }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.dashboard-notification-badge')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Incident near the library')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/notifications/history'));
    expect(await screen.findByText('No new notifications')).toBeInTheDocument();
    expect(container.querySelector('.dashboard-notification-badge')).not.toBeInTheDocument();
  });

  it('updates the header unread badge when a notification is marked read in the notifications page', async () => {
    apiGet.mockImplementation((url) => url === '/notifications'
      ? Promise.resolve({ data: { data: [
        { notification_id: 'n1', title: 'First report', message: 'Incident one', type: 'incident', is_read: false },
        { notification_id: 'n2', title: 'Second report', message: 'Incident two', type: 'incident', is_read: false },
      ] } })
      : Promise.resolve({ data: { data: [] } }));

    const { container } = render(<MemoryRouter initialEntries={['/notifications']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector('.dashboard-notification-badge')).toHaveTextContent('2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark read: First report' }));

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith('/notifications/n1/read');
      expect(container.querySelector('.dashboard-notification-badge')).toHaveTextContent('1');
    });
  });

  it('loads Student Analytics from the student incident feed without requesting global analytics', async () => {
    apiGet.mockImplementation((url) => url === '/incidents'
      ? Promise.resolve({ data: { data: [
        { incident_id: 'own-incident', user_id: 'student-1', type: 'theft', status: 'reported', created_at: '2026-09-28T08:00:00Z' },
        { incident_id: 'other-incident', user_id: 'student-2', type: 'assault', status: 'resolved', created_at: '2026-09-28T09:00:00Z' },
      ] } })
      : Promise.resolve({ data: { data: [] } }));

    render(<MemoryRouter initialEntries={['/analytics']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    expect(await screen.findByText('Personal analytics')).toBeInTheDocument();
    expect(screen.getAllByText('1', { selector: '.dashboard-panel .text-3xl' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Theft').length).toBeGreaterThan(0);
    expect(screen.queryByText('Assault')).not.toBeInTheDocument();
    expect(screen.queryByText('other-incident')).not.toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/incidents');
    expect(apiGet).not.toHaveBeenCalledWith('/analytics');
  });

  it('makes Analytics available from the Student dashboard sidebar', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Reports & Analytics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));

    expect(await screen.findByText('Personal analytics')).toBeInTheDocument();
  });

  it.each(['student', 'faculty', 'staff', 'security_officer', 'admin'])(
    'shows Incident History Clear to authenticated %s users and persists their own clear after reload',
    async (role) => {
      let cleared = false;
      const currentUserId = `${role}-1`;
      const historyItem = {
        incident_id: 'history-1',
        user_id: currentUserId,
        type: 'theft',
        description: 'History entry to clear',
        status: 'resolved',
        created_at: '2026-09-28T08:00:00Z',
      };
      apiGet.mockImplementation((url) => url === '/incidents/history'
        ? Promise.resolve({ data: { data: cleared ? [] : [historyItem] } })
        : Promise.resolve({ data: { data: [] } }));
      apiDelete.mockImplementation(async (url) => {
        if (url === '/incidents/history') cleared = true;
        return { data: { success: true } };
      });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<MemoryRouter initialEntries={['/incidents/history']}><Dashboard user={{ user_id: currentUserId, role, name: role }} /></MemoryRouter>);

      expect(await screen.findByText('History entry to clear')).toBeInTheDocument();
      const clearButton = screen.getByRole('button', { name: 'Clear incident history' });
      fireEvent.click(clearButton);
      expect(confirm).toHaveBeenCalled();
      await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/incidents/history'));
      await waitFor(() => expect(screen.queryByText('History entry to clear')).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/incidents/history'));
      expect(screen.queryByText('History entry to clear')).not.toBeInTheDocument();
    },
  );

  it('does not clear Incident History unless the user confirms', async () => {
    apiGet.mockImplementation((url) => url === '/incidents/history'
      ? Promise.resolve({ data: { data: [{ incident_id: 'history-2', user_id: 'student-1', type: 'fire', description: 'Keep this history', status: 'reported' }] } })
      : Promise.resolve({ data: { data: [] } }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/incidents/history']}><Dashboard user={{ user_id: 'student-1', role: 'student', name: 'Student Test' }} /></MemoryRouter>);

    expect(await screen.findByText('Keep this history')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear incident history' }));

    expect(confirm).toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalledWith('/incidents/history');
    expect(screen.getByText('Keep this history')).toBeInTheDocument();
  });

  it.each(['admin', 'security_officer'])('%s cannot access incident or SOS creation actions', async (role) => {
    const user = { user_id: `${role}-1`, role, name: role };
    const { unmount } = render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={user} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Report incident' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Send SOS alert' })).not.toBeInTheDocument();
    unmount();

    render(<MemoryRouter initialEntries={['/sos']}><Dashboard user={user} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send SOS alert' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Report incident' })).not.toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it.each(['student', 'faculty', 'staff'])('%s retains incident and SOS creation actions', async (role) => {
    const user = { user_id: `${role}-1`, role, name: role };
    const { unmount } = render(<MemoryRouter initialEntries={['/incidents/active']}><Dashboard user={user} /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Report incident' })).toBeInTheDocument();
    unmount();

    render(<MemoryRouter initialEntries={['/sos']}><Dashboard user={user} /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Send SOS alert' })).toBeInTheDocument();
  });

  it.each(['student', 'faculty', 'staff'])('denies %s access to the Live Map page', async (role) => {
    render(<MemoryRouter initialEntries={['/map']}><Dashboard user={{ user_id: `${role}-1`, role, name: role }} /></MemoryRouter>);

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByTestId('security-map')).not.toBeInTheDocument();
  });

  it.each(['security', 'security_officer', 'admin'])('keeps Live Map available to %s', async (role) => {
    render(<MemoryRouter initialEntries={['/map']}><Dashboard user={{ user_id: `${role}-1`, role, name: role }} /></MemoryRouter>);

    expect(await screen.findByText('Live campus map')).toBeInTheDocument();
    expect(screen.getByTestId('security-map')).toBeInTheDocument();
  });

  it('opens a GPS incident on the existing Live Map from its details', async () => {
    const incident = {
      incident_id: 'map-incident-1',
      type: 'theft',
      status: 'reported',
      latitude: 10.9856,
      longitude: 39.2633,
      location_name: 'North Gate',
    };
    apiGet.mockImplementation((url) => url === '/incidents'
      ? Promise.resolve({ data: { data: [incident] } })
      : Promise.resolve({ data: { data: [] } }));

    render(<MemoryRouter initialEntries={['/incidents/map-incident-1']}><Dashboard user={{ user_id: 'admin-1', role: 'admin' }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Open with Map' }));

    expect(await screen.findByTestId('security-map')).toHaveAttribute('data-focused-incident', 'map-incident-1');
  });

  it('shows a safe message rather than opening the map for an incident without valid GPS', async () => {
    apiGet.mockImplementation((url) => url === '/incidents'
      ? Promise.resolve({ data: { data: [{ incident_id: 'no-gps-1', type: 'theft', status: 'reported', latitude: null, longitude: null }] } })
      : Promise.resolve({ data: { data: [] } }));

    render(<MemoryRouter initialEntries={['/incidents/no-gps-1']}><Dashboard user={{ user_id: 'admin-1', role: 'admin' }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Open with Map' }));

    expect(screen.getByRole('alert')).toHaveTextContent('no valid GPS coordinates');
    expect(screen.queryByTestId('security-map')).not.toBeInTheDocument();
  });

  it('opens a located incident notification on the map and closes the panel', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'admin-1', role: 'admin' }} /></MemoryRouter>);
    act(() => webSocket.emit('new-incident', {
      incident_id: 'notification-map-1',
      type: 'theft',
      latitude: 10.9856,
      longitude: 39.2633,
      location_name: 'North Gate',
    }));
    const notification = await screen.findByText(/New Incident Report/);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(notification.closest('button'));

    expect(await screen.findByTestId('security-map')).toHaveAttribute('data-focused-incident', 'notification-map-1');
    expect(screen.queryByText('Live notifications')).not.toBeInTheDocument();
  });

  it('opens an incident detail for a notification without GPS coordinates', async () => {
    const incident = { incident_id: 'notification-no-gps', type: 'theft', status: 'reported' };
    apiGet.mockImplementation((url) => url === '/incidents'
      ? Promise.resolve({ data: { data: [incident] } })
      : Promise.resolve({ data: { data: [] } }));
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'admin-1', role: 'admin' }} /></MemoryRouter>);
    act(() => webSocket.emit('new-incident', incident));
    const notification = await screen.findByText(/New Incident Report/);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(notification.closest('button'));

    expect(await screen.findByText('Incident record')).toBeInTheDocument();
    expect(screen.queryByTestId('security-map')).not.toBeInTheDocument();
  });

  it('uses an alert notification target or the Alerts page when no target is provided', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard user={{ user_id: 'admin-1', role: 'admin' }} /></MemoryRouter>);
    act(() => webSocket.emit('alert-received', { alert_id: 'alert-no-link', type: 'security_alert', message: 'Campus alert' }));
    const alertNotification = await screen.findByText('New alert');
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(alertNotification.closest('button'));
    expect(await screen.findByRole('heading', { name: 'Alerts and zones', level: 2 })).toBeInTheDocument();

    act(() => webSocket.emit('alert-received', { alert_id: 'alert-with-link', type: 'security_alert', title: 'Linked alert', link: '/notifications' }));
    const linkedNotification = await screen.findByText('Linked alert');
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(linkedNotification.closest('button'));
    expect(await screen.findByRole('heading', { name: 'Notifications', level: 2 })).toBeInTheDocument();
  });

});
