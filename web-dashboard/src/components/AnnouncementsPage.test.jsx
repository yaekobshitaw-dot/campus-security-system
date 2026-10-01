// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout, UserAvatar } from './DashboardLayout';
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
  it('renders stable role-based avatars with accessible labels', () => {
    const { rerender } = render(<UserAvatar user={{ name: 'Ada Student', role: 'student' }} />);
    expect(screen.getByRole('img', { name: 'Ada Student student profile' })).toBeInTheDocument();

    rerender(<UserAvatar user={{ name: 'Sam Officer', role: 'security' }} />);
    expect(screen.getByRole('img', { name: 'Sam Officer security officer profile' })).toBeInTheDocument();
    rerender(<UserAvatar user={{ name: 'Aria Admin', role: 'admin' }} />);
    expect(screen.getByRole('img', { name: 'Aria Admin administrator profile' })).toBeInTheDocument();
    rerender(<UserAvatar user={{ name: 'Unknown User', role: 'visitor' }} />);
    expect(screen.getByRole('img', { name: 'Unknown User user profile' })).toBeInTheDocument();
  });

  it('keeps uploaded photos and falls back when the photo is broken', () => {
    render(<UserAvatar user={{ user_id: 'photo-user', name: 'Photo User', role: 'student', profile_photo_url: '/uploads/photo.jpg' }} />);
    const image = screen.getByAltText('Photo User student profile');
    expect(image).toHaveAttribute('src', '/uploads/photo.jpg');
    fireEvent.error(image);
    expect(screen.getByRole('img', { name: 'Photo User student profile' })).toBeInTheDocument();
    expect(screen.queryByAltText('Photo User student profile')).not.toBeInTheDocument();
  });

  it('opens the profile photo preview and closes it with Escape', () => {
    render(<UserAvatar user={{ name: 'Ada Student', role: 'student', profile_photo_url: '/uploads/ada.jpg' }} />);
    const trigger = screen.getByRole('button', { name: 'View Ada Student student profile photo' });

    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Profile photo preview for Ada Student student profile' });
    expect(within(dialog).getByAltText('Ada Student student profile')).toHaveAttribute('src', '/uploads/ada.jpg');
    expect(within(dialog).getByAltText('Ada Student student profile')).toHaveClass('profile-photo-preview-image');
    expect(screen.getByRole('button', { name: 'Close profile photo preview' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the profile photo preview when clicking outside the image', () => {
    render(<UserAvatar user={{ name: 'Ada Student', role: 'student', profile_photo_url: '/uploads/ada.jpg' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'View Ada Student student profile photo' }));

    fireEvent.click(screen.getByRole('dialog'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the Announcements navigation item for an admin', () => {
    const onNavigate = vi.fn();
    const onLogout = vi.fn();
    const { container } = render(<MemoryRouter><DashboardLayout user={{ role: 'admin', name: 'Admin' }} onNavigate={onNavigate} onLogout={onLogout} /></MemoryRouter>);

    const groupNames = ['Overview / Dashboard', 'Incidents & Emergency', 'Live Map & Location', 'Security Officers / Response', 'Users & Communication', 'Reports & Analytics', 'Administration / System'];
    const sidebar = container.querySelector('.dashboard-sidebar');
    expect(sidebar.querySelectorAll('button')).toHaveLength(7);
    groupNames.forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
    expect(within(sidebar).queryByRole('button', { name: 'Announcements' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Users & Communication' }));
    const announcementsButton = screen.getByRole('button', { name: 'Announcements' });
    expect(sidebar).not.toContainElement(announcementsButton);
    fireEvent.click(announcementsButton);
    expect(onNavigate).toHaveBeenCalledWith('/announcements');

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('preserves role restrictions in main-area feature cards', () => {
    const onNavigate = vi.fn();
    const { container } = render(<MemoryRouter><DashboardLayout user={{ role: 'student', name: 'Student' }} onNavigate={onNavigate} /></MemoryRouter>);

    const communicationGroup = screen.getByRole('button', { name: 'Users & Communication' });
    fireEvent.click(communicationGroup);
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'User management' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SMS Broadcast' })).not.toBeInTheDocument();
    expect(container.querySelector('.dashboard-sidebar').querySelectorAll('button')).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Incidents & Emergency' }));
    const activeIncidentsButton = screen.getByRole('button', { name: 'Active incidents' });
    expect(activeIncidentsButton).toBeInTheDocument();
    fireEvent.click(activeIncidentsButton);
    expect(onNavigate).toHaveBeenCalledWith('/incidents/active');
  });

  it('shows existing feature routes under all seven main groups', () => {
    const onNavigate = vi.fn();
    const { container } = render(<MemoryRouter><DashboardLayout user={{ role: 'admin', name: 'Admin' }} onNavigate={onNavigate} /></MemoryRouter>);
    const sidebar = container.querySelector('.dashboard-sidebar');
    const mainContent = within(container.querySelector('.dashboard-content'));
    const groups = [
      ['Overview / Dashboard', [['Overview', '/dashboard'], ['Features', '/features']]],
      ['Incidents & Emergency', [['Active incidents', '/incidents/active'], ['Incident History', '/incidents/history'], ['Emergency center', '/emergency'], ['SOS / Emergency', '/sos'], ['Evidence', '/evidence']]],
      ['Live Map & Location', [['Live Map', '/map'], ['Alerts', '/alerts'], ['Zones', '/zones'], ['Campus locations', '/locations']]],
      ['Security Officers / Response', [['Security Officers', '/officers'], ['Responses', '/responses']]],
      ['Users & Communication', [['Profile', '/profile'], ['User management', '/users'], ['Notifications', '/notifications'], ['Announcements', '/announcements'], ['SMS Broadcast', '/sms']]],
      ['Reports & Analytics', [['Reports & Analytics', '/analytics'], ['ML Insights', '/ml']]],
      ['Administration / System', [['Settings', '/settings'], ['Audit Logs', '/audit-logs'], ['Content Management', '/content']]],
    ];

    for (const [groupLabel, featureLabels] of groups) {
      fireEvent.click(within(sidebar).getByRole('button', { name: groupLabel }));
      expect(mainContent.getByRole('heading', { name: groupLabel })).toBeInTheDocument();
      for (const [featureLabel, path] of featureLabels) {
        const featureButton = mainContent.getByRole('button', { name: featureLabel });
        expect(featureButton).toBeInTheDocument();
        expect(sidebar).not.toContainElement(featureButton);
        fireEvent.click(featureButton);
        expect(onNavigate).toHaveBeenLastCalledWith(path);
        fireEvent.click(within(sidebar).getByRole('button', { name: groupLabel }));
      }
      expect(sidebar.querySelectorAll('button')).toHaveLength(7);
    }
  });

  it('shows students alerts, zones, and notifications without privileged sidebar features', () => {
    const onNavigate = vi.fn();
    const { container } = render(<MemoryRouter><DashboardLayout user={{ role: 'student', name: 'Student' }} onNavigate={onNavigate} /></MemoryRouter>);
    const sidebar = container.querySelector('.dashboard-sidebar');

    expect(within(sidebar).queryByRole('button', { name: 'Security Officers / Response' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Administration / System' })).not.toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Alerts & Zones' }));
    expect(screen.getByRole('heading', { name: 'Alerts & Zones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zones' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Live Map' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Campus locations' })).not.toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Users & Communication' }));
    const mainContent = within(container.querySelector('.dashboard-content'));
    expect(mainContent.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Security Officers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'User management' })).not.toBeInTheDocument();
    fireEvent.click(mainContent.getByRole('button', { name: 'Notifications' }));
    expect(onNavigate).toHaveBeenCalledWith('/notifications');

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(mobileNavigation).getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(within(mobileNavigation).queryByRole('button', { name: 'Live Map' })).not.toBeInTheDocument();
    expect(within(mobileNavigation).queryByRole('button', { name: 'Campus locations' })).not.toBeInTheDocument();
  });

  it.each(['student', 'faculty', 'staff'])('%s cannot see or open Live Map from dashboard navigation', (role) => {
    const onNavigate = vi.fn();
    const { container } = render(<MemoryRouter><DashboardLayout user={{ role, name: role }} onNavigate={onNavigate} /></MemoryRouter>);
    const sidebar = container.querySelector('.dashboard-sidebar');

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Alerts & Zones' }));
    expect(screen.queryByRole('button', { name: 'Live Map' })).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalledWith('/map');
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
