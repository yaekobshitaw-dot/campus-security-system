// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import AnnouncementsPage from './AnnouncementsPage';

const announcement = {
  announcement_id: 'announcement-1',
  title: 'Campus closure notice',
  content: 'The library will close early today.',
  priority: 'high',
  status: 'published',
  target_roles: ['student', 'faculty'],
  published_at: '2026-09-10T10:00:00.000Z',
  expires_at: null,
  is_read: false,
};
const draft = { ...announcement, announcement_id: 'announcement-2', title: 'Draft notice', status: 'draft', is_read: true, target_roles: ['security'] };
const service = vi.hoisted(() => ({
  listAnnouncements: vi.fn(),
  getAnnouncement: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  publishAnnouncement: vi.fn(),
  unpublishAnnouncement: vi.fn(),
  markAnnouncementRead: vi.fn(),
  getAnnouncementUnreadCount: vi.fn(),
}));

vi.mock('../services/announcements', () => service);

const ok = (data) => Promise.resolve({ data: { data } });
const renderPage = (role = 'student') => render(<MemoryRouter><AnnouncementsPage user={{ role, name: `${role} user` }} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  service.listAnnouncements.mockResolvedValue(ok([announcement]));
  service.getAnnouncementUnreadCount.mockResolvedValue(ok({ count: 1 }));
  service.getAnnouncement.mockResolvedValue(ok({ ...announcement }));
  service.markAnnouncementRead.mockResolvedValue(ok({ announcement_id: announcement.announcement_id, is_read: true }));
  service.createAnnouncement.mockResolvedValue(ok({ ...draft }));
  service.updateAnnouncement.mockResolvedValue(ok({ ...draft }));
  service.publishAnnouncement.mockResolvedValue(ok({ ...announcement }));
  service.unpublishAnnouncement.mockResolvedValue(ok({ ...announcement, status: 'unpublished' }));
  service.deleteAnnouncement.mockResolvedValue(ok({ announcement_id: announcement.announcement_id }));
});

afterEach(() => {
  cleanup();
});

describe('AnnouncementsPage', () => {
  it('shows the Announcements navigation item for an admin', () => {
    render(<MemoryRouter><DashboardLayout user={{ role: 'admin', name: 'Admin' }} /></MemoryRouter>);
    expect(screen.getAllByText('Announcements').length).toBeGreaterThan(0);
  });

  it('loads the announcement list and unread count', async () => {
    renderPage();
    expect(await screen.findByText('Campus closure notice')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(service.listAnnouncements).toHaveBeenCalledTimes(1);
    expect(service.getAnnouncementUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('keeps the non-admin feed read-only', async () => {
    renderPage('faculty');
    expect(await screen.findByText('Campus closure notice')).toBeInTheDocument();
    expect(screen.queryByText('Create announcement')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('creates an announcement for an admin', async () => {
    renderPage('admin');
    fireEvent.click(await screen.findByRole('button', { name: /create announcement/i }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Exam notice' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Exam content' } });
    fireEvent.click(screen.getByLabelText('Student'));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(service.createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ title: 'Exam notice', content: 'Exam content', target_roles: ['student'] })));
  });

  it('edits an announcement for an admin', async () => {
    service.listAnnouncements.mockResolvedValue(ok([draft]));
    renderPage('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited notice' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(service.updateAnnouncement).toHaveBeenCalledWith('announcement-2', expect.objectContaining({ title: 'Edited notice' })));
  });

  it('publishes, unpublishes, and deletes through the announcement API', async () => {
    service.listAnnouncements.mockResolvedValue(ok([draft]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage('admin');
    expect((await screen.findAllByText('Draft notice')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(service.publishAnnouncement).toHaveBeenCalledWith('announcement-2'));

    service.listAnnouncements.mockResolvedValue(ok([announcement]));
    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^unpublish$/i }));
    await waitFor(() => expect(service.unpublishAnnouncement).toHaveBeenCalledWith('announcement-1'));

    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(service.deleteAnnouncement).toHaveBeenCalledWith('announcement-1'));
    window.confirm.mockRestore();
  });

  it('displays target roles and marks an individual announcement read', async () => {
    renderPage('admin');
    expect(await screen.findByText('student')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open and mark read/i }));
    await waitFor(() => expect(service.getAnnouncement).toHaveBeenCalledWith('announcement-1'));
    expect(service.markAnnouncementRead).toHaveBeenCalledWith('announcement-1');
  });

  it('shows a safe API error message', async () => {
    service.listAnnouncements.mockRejectedValue({ response: { data: { message: 'Announcements unavailable' } } });
    service.getAnnouncementUnreadCount.mockRejectedValue(new Error('internal detail'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Announcements unavailable');
    expect(screen.queryByText('internal detail')).not.toBeInTheDocument();
  });
});
