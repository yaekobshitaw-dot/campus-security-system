// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogsPage, NotificationsPage, SystemSettingsPage } from './AdminPages';
import api from '../services/api';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}));

const auditLogs = Array.from({ length: 25 }, (_, index) => ({
  audit_id: `audit-${index + 1}`,
  actor: { name: `Administrator ${index + 1}` },
  action: 'user_updated',
  resource_type: 'user',
  resource_id: `${index + 1}`,
  details: `Audit detail ${index + 1}`,
  created_at: '2026-09-29T00:00:00.000Z'
}));

describe('AuditLogsPage pagination', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { data: auditLogs } });
  });

  it('shows ten records per page, page controls, and accurate ranges', async () => {
    render(<AuditLogsPage />);

    expect(await screen.findByText('Showing 1–10 of 25')).toBeInTheDocument();
    expect(screen.getAllByText(/^Administrator \d+$/)).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument();
    expect(screen.getAllByText(/^Administrator \d+$/)).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument();
    expect(screen.getAllByText(/^Administrator \d+$/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('resets to page one when search filters change and keeps filtering API behavior', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('Showing 1–10 of 25');
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search action or resource'), {
      target: { value: 'user' }
    });
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/audit-logs', {
      params: { q: 'user' }
    }));
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-09-01' }
    });
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/audit-logs', {
      params: { q: 'user', from: '2026-09-01' }
    }));
  });

  it('contains table horizontal scrolling and wraps pagination controls', async () => {
    const { container } = render(<AuditLogsPage />);
    await screen.findByText('Showing 1–10 of 25');

    const tableScroller = container.querySelector('.overflow-x-auto');
    const pagination = screen.getByRole('navigation', { name: 'Audit log pagination' });
    expect(tableScroller).toHaveClass('max-w-full');
    expect(within(pagination).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(pagination).toHaveClass('flex-wrap');
  });
});

describe('Admin notification history clearing', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
    api.patch.mockResolvedValue({ data: { success: true } });
  });

  it('confirms clearing and persists the Admin’s own notification history', async () => {
    let cleared = false;
    api.get.mockImplementation(() => Promise.resolve({
      data: { data: cleared ? [] : [{ notification_id: 'admin-n1', title: 'Admin alert', message: 'Review this alert', is_read: false }] },
    }));
    api.delete.mockImplementation(async (url) => {
      expect(url).toBe('/notifications/history');
      cleared = true;
      return { data: { success: true } };
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onUnreadCountChange = vi.fn();
    const onHistoryCleared = vi.fn();
    render(<MemoryRouter><NotificationsPage user={{ user_id: 'admin-1', role: 'admin' }} onUnreadCountChange={onUnreadCountChange} onHistoryCleared={onHistoryCleared} /></MemoryRouter>);

    expect(await screen.findByText('Admin alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/notifications/history'));
    expect(confirm).toHaveBeenCalledWith("Clear your notification history? This won't delete incidents or other operational records.");
    expect(onUnreadCountChange).toHaveBeenLastCalledWith(0);
    expect(onHistoryCleared).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.queryByText('Admin alert')).not.toBeInTheDocument());
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('lets an authenticated non-admin clear only their notification history', async () => {
    api.get.mockResolvedValue({ data: { data: [{ notification_id: 'faculty-n1', title: 'Faculty alert', message: 'Personal alert', is_read: false }] } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onHistoryCleared = vi.fn();
    render(<MemoryRouter><NotificationsPage user={{ user_id: 'faculty-1', role: 'faculty' }} onHistoryCleared={onHistoryCleared} /></MemoryRouter>);

    expect(await screen.findByText('Faculty alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/notifications/history'));
    expect(confirm).toHaveBeenCalled();
    expect(onHistoryCleared).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Nothing to display.')).toBeInTheDocument();
  });
});

describe('Admin system status controls', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.put.mockReset();
    api.get.mockResolvedValue({ data: { data: [{ key: 'system.active', category: 'system', value: 'true', type: 'boolean' }] } });
    api.put.mockResolvedValue({ data: { success: true } });
  });

  it('deactivates and reactivates the application through persisted system settings', async () => {
    let active = true;
    api.get.mockImplementation(async () => ({
      data: { data: [{ key: 'system.active', category: 'system', value: String(active), type: 'boolean' }] },
    }));
    api.put.mockImplementation(async (_url, payload) => {
      active = payload.settings[0].value;
      return { data: { success: true } };
    });
    render(<SystemSettingsPage />);

    expect(await screen.findByText(/Current status:/)).toHaveTextContent('Active');
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate System' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings', {
      settings: [{ key: 'system.active', value: false }],
    }));
    expect(await screen.findByText('System deactivated. Admin access remains available.')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Activate System' }));
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/settings', {
      settings: [{ key: 'system.active', value: true }],
    }));
    expect(await screen.findByText('System activated.')).toBeInTheDocument();
  });
});

describe('NotificationsPage Contact Us messages', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
    api.patch.mockResolvedValue({ data: { success: true } });
    api.get.mockResolvedValue({
      data: {
        data: [{
          notification_id: 'contact-notification-1',
          title: 'New Contact Us message',
          message: 'Alex Example submitted a Contact Us message.',
          type: 'contact_message',
          data: {
            name: 'Alex Example',
            email: 'alex@example.edu',
            topic: 'campus_partnership',
            message: 'Please contact our campus team.',
          },
          created_at: '2026-09-29T10:30:00.000Z',
          is_read: false,
          link: '/notifications',
        }],
      },
    });
  });

  it('shows all Contact Us message details and its unread notification status', async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    expect(await screen.findByText('Alex Example')).toBeInTheDocument();
    expect(screen.getByText('alex@example.edu')).toBeInTheDocument();
    expect(screen.getByText('Campus Partnership')).toBeInTheDocument();
    expect(screen.getByText('Please contact our campus team.')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-09-29T10:30:00.000Z').toLocaleString())).toBeInTheDocument();
  });

  it('normalizes serialized contact data and string read flags from the API', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [{
          notification_id: 'contact-notification-serialized',
          title: 'New Contact Us message',
          message: 'Alex Example submitted a Contact Us message.',
          type: 'contact_message',
          data: JSON.stringify({
            name: 'Alex Example',
            email: 'alex@example.edu',
            topic: 'campus_partnership',
            message: 'Please contact our campus team.',
          }),
          is_read: '0',
        }],
      },
    });

    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);

    expect(await screen.findByText('Alex Example')).toBeInTheDocument();
    expect(screen.getByText('alex@example.edu')).toBeInTheDocument();
    expect(screen.getByText('Campus Partnership')).toBeInTheDocument();
    expect(screen.getByText('Please contact our campus team.')).toBeInTheDocument();
    expect(screen.getByLabelText('Unread notifications: 1')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('updates the unread count after a notification is marked read', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          { notification_id: 'n1', title: 'First alert', message: 'First', is_read: false },
          { notification_id: 'n2', title: 'Second alert', message: 'Second', is_read: false },
        ],
      },
    });
    const onUnreadCountChange = vi.fn();
    render(<MemoryRouter><NotificationsPage onUnreadCountChange={onUnreadCountChange} /></MemoryRouter>);

    expect(await screen.findByLabelText('Unread notifications: 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark read: First alert' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/notifications/n1/read');
      expect(screen.getByLabelText('Unread notifications: 1')).toBeInTheDocument();
    });
    expect(within(screen.getByRole('row', { name: /First alert/ })).getByText('Read')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Second alert/ })).getByText('Unread')).toBeInTheDocument();
    expect(onUnreadCountChange).toHaveBeenLastCalledWith(1);
  });
});
