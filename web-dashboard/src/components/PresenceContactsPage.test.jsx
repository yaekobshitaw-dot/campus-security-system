// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PresenceContactsPage from './PresenceContactsPage';

const { apiGet, socketHandlers } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  socketHandlers: new Map()
}));

vi.mock('../services/api', () => ({ default: { get: apiGet } }));
vi.mock('../services/socket', () => ({
  default: {
    on: vi.fn((event, listener) => socketHandlers.set(event, listener)),
    off: vi.fn((event, listener) => {
      if (socketHandlers.get(event) === listener) socketHandlers.delete(event);
    })
  }
}));

const directory = [
  { user_id: 'user-online', name: 'Ada Student', profile_photo_url: null, is_online: true, last_seen_at: null },
  { user_id: 'user-offline', name: 'Sam Faculty', profile_photo_url: null, is_online: false, last_seen_at: new Date(Date.now() - 120000).toISOString() }
];

describe('PresenceContactsPage', () => {
  beforeEach(() => {
    socketHandlers.clear();
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { data: directory } });
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads online and offline contacts with avatar fallback and last-seen text', async () => {
    render(<PresenceContactsPage />);

    expect(await screen.findByText('Sam Faculty')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/users/presence');
    expect(screen.getByText('1 online')).toBeInTheDocument();
    expect(screen.getByText('Ada Student')).toBeInTheDocument();
    expect(screen.getByText('Sam Faculty')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Student user profile' })).toHaveTextContent('AS');
    expect(screen.getByText(/^Last seen/)).toBeInTheDocument();
  });

  it('filters by presence and searches by display name', async () => {
    render(<PresenceContactsPage />);
    await screen.findByText('Sam Faculty');

    fireEvent.click(screen.getByRole('button', { name: 'Offline' }));
    expect(screen.queryByText('Ada Student')).not.toBeInTheDocument();
    expect(screen.getByText('Sam Faculty')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search users by name' }), { target: { value: 'Ada' } });
    expect(screen.getByText('No users match these filters.')).toBeInTheDocument();
  });

  it('applies live presence changes and reconnect snapshots', async () => {
    render(<PresenceContactsPage />);
    await screen.findByText('Sam Faculty');

    act(() => socketHandlers.get('presence-updated')({
      user_id: 'user-offline',
      is_online: true,
      last_seen_at: null
    }));
    expect(screen.getByText('2 online')).toBeInTheDocument();
    expect(screen.queryByText(/^Last seen/)).not.toBeInTheDocument();

    act(() => socketHandlers.get('presence-snapshot')({ online_user_ids: ['user-online'] }));
    expect(screen.getByText('1 online')).toBeInTheDocument();
    expect(screen.getAllByText('Offline')).toHaveLength(2);
  });
});