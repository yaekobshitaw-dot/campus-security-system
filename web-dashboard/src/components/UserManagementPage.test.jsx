// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import UserManagementPage from './UserManagementPage';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    delete: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const users = [
  {
    user_id: 'user-1',
    name: 'Ada Student',
    email: 'ada@example.com',
    phone: '555-0101',
    role: 'student',
    is_active: true,
    profile_photo_url: null,
  },
  {
    user_id: 'user-2',
    name: 'Grace Admin',
    email: 'grace@example.com',
    phone: '',
    role: 'admin',
    is_active: false,
    profile_photo_url: '/uploads/grace.jpg',
  },
];

function renderPage(initialUsers = users) {
  function Harness() {
    const [currentUsers, setCurrentUsers] = useState(initialUsers);
    return (
      <UserManagementPage
        users={currentUsers}
        setUsers={setCurrentUsers}
        onRefresh={vi.fn()}
        currentUser={{ user_id: 'admin-current' }}
        onUserUpdated={vi.fn()}
      />
    );
  }
  return render(<Harness />);
}

const bulkSuccess = (deleted) => ({
  data: { success: true, message: `${deleted.length} users deleted.`, data: { deleted, failures: [] } },
});

describe('UserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => cleanup());

  it('selects one or multiple users and displays the selected count', () => {
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ada Student' }));
    expect(screen.getByText('1 user selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Grace Admin' }));
    expect(screen.getByText('2 users selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeEnabled();
  });

  it('opens a profile photo without selecting its user row', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'View Grace Admin administrator profile photo' }));

    expect(screen.getByRole('dialog', { name: 'Profile photo preview for Grace Admin administrator profile' })).toBeInTheDocument();
    expect(screen.getByText('Select a user to view profile.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close profile photo preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grace Admin' }));

    expect(screen.getByRole('region', { name: 'Selected user profile' })).toBeInTheDocument();
  });

  it('selects all displayed users and deselects all on the next toggle', () => {
    renderPage();
    const selectAll = screen.getByRole('checkbox', { name: 'Select all users' });
    fireEvent.click(selectAll);
    expect(screen.getByRole('checkbox', { name: 'Select Ada Student' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Grace Admin' })).toBeChecked();
    expect(screen.getByText('2 users selected')).toBeInTheDocument();

    fireEvent.click(selectAll);
    expect(screen.getByRole('checkbox', { name: 'Select Ada Student' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Grace Admin' })).not.toBeChecked();
    expect(screen.getByText('0 users selected')).toBeInTheDocument();
  });

  it('disables Delete Selected when no users are selected', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeDisabled();
  });

  it('asks for confirmation before making a bulk deletion request', () => {
    window.confirm.mockReturnValue(false);
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ada Student' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete 1 selected user? This cannot be undone.');
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('removes successfully deleted users and clears their selection', async () => {
    api.delete.mockResolvedValueOnce(bulkSuccess(['user-1', 'user-2']));
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all users' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/bulk', {
      data: { userIds: ['user-1', 'user-2'] },
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('2 users deleted.');
    expect(screen.queryByText('Ada Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Grace Admin')).not.toBeInTheDocument();
  });

  it('retains failed users after partial success and displays each backend failure', async () => {
    api.delete.mockResolvedValueOnce({
      data: {
        success: false,
        message: '1 user deleted; 1 deletion failed.',
        data: {
          deleted: ['user-1'],
          failures: [{ user_id: 'user-2', message: 'At least one active Admin account must remain.' }],
        },
      },
    });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all users' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Grace Admin: At least one active Admin account must remain.');
    expect(screen.queryByText('Ada Student')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Grace Admin' })).toBeChecked();
    expect(screen.getByText('1 user selected')).toBeInTheDocument();
  });

  it('shows the backend error when bulk deletion fails', async () => {
    api.delete.mockRejectedValueOnce({
      response: { data: { message: 'Bulk deletion is not available.' } },
    });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Ada Student' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bulk deletion is not available.');
    expect(screen.getByText('Ada Student')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Ada Student' })).toBeChecked();
  });

  it('keeps the existing single-user deletion action working', async () => {
    api.delete.mockResolvedValueOnce({ data: { success: true, message: 'User deleted' } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Ada Student' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/users/user-1'));
    expect(await screen.findByRole('status')).toHaveTextContent('Ada Student was deleted.');
    expect(screen.queryByText('Ada Student')).not.toBeInTheDocument();
  });

  it('shows the clicked user profile above the table with available account details', () => {
    renderPage();
    const graceRow = screen.getByRole('row', { name: /Select Grace Admin.*Grace Admin.*grace@example.com.*Admin/ });
    fireEvent.click(within(graceRow).getByRole('button', { name: 'Grace Admin', exact: true }));

    const profile = screen.getByRole('region', { name: 'Selected user profile' });
    const table = screen.getByRole('table');
    expect(profile.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(profile).toHaveTextContent('Grace Admin');
    expect(profile).toHaveTextContent('grace@example.com');
    expect(profile).toHaveTextContent('Not provided');
    expect(profile).toHaveTextContent('Admin');
    expect(profile).toHaveTextContent('Inactive');
    expect(profile).toHaveTextContent('user-2');
  });

  it('renders the profile photo or fallback initials when no photo is available', () => {
    renderPage();
    const photo = screen.getByRole('img', { name: 'Grace Admin administrator profile' });
    expect(photo).toHaveAttribute('src', '/uploads/grace.jpg');

    const fallbackAvatars = screen.getAllByRole('img', { name: 'Ada Student student profile' });
    expect(fallbackAvatars).toHaveLength(1);
    expect(fallbackAvatars[0]).toHaveTextContent('AS');
  });
});

