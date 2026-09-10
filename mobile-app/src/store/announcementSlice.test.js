import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import alertReducer from './alertSlice';
import announcementReducer, { fetchAnnouncements, markAnnouncementAsRead } from './announcementSlice';
import {
  fetchAnnouncementRequest,
  fetchAnnouncementUnreadCountRequest,
  fetchAnnouncementsRequest,
  markAnnouncementReadRequest,
} from '../services/announcementService';
import { getAnnouncementDetailFields } from '../utils/announcement';

jest.mock('../services/api', () => ({ default: {} }));

jest.mock('../services/announcementService', () => ({
  fetchAnnouncementsRequest: jest.fn(),
  fetchAnnouncementUnreadCountRequest: jest.fn(),
  markAnnouncementReadRequest: jest.fn(),
}));

const announcement = {
  announcement_id: 'announcement-1',
  title: 'Campus closure',
  content: 'The library closes early today.',
  priority: 'high',
  status: 'published',
  published_at: '2026-09-10T10:00:00.000Z',
  expires_at: '2026-09-12T10:00:00.000Z',
  is_read: false,
};

const createStore = () => configureStore({ reducer: { announcements: announcementReducer } });
const response = (data) => Promise.resolve({ data: { data } });

beforeEach(() => {
  jest.clearAllMocks();
  fetchAnnouncementsRequest.mockResolvedValue(response([announcement]));
  fetchAnnouncementUnreadCountRequest.mockResolvedValue(response({ count: 1 }));
  markAnnouncementReadRequest.mockResolvedValue(response({ announcement_id: announcement.announcement_id, is_read: true }));
});

describe('announcement mobile state', () => {
  it('loads published announcements with their display fields', async () => {
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    const item = store.getState().announcements.announcements[0];
    expect(item.title).toBe('Campus closure');
    expect(item.content).toBe('The library closes early today.');
    expect(item.priority).toBe('high');
    expect(item.published_at).toBe('2026-09-10T10:00:00.000Z');
  });

  it('stores the backend unread count', async () => {
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    expect(store.getState().announcements.unreadCount).toBe(1);
  });

  it('preserves unread state until the read request succeeds', async () => {
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    expect(store.getState().announcements.announcements[0].is_read).toBe(false);
    await store.dispatch(markAnnouncementAsRead(announcement.announcement_id));
    expect(store.getState().announcements.announcements[0].is_read).toBe(true);
    expect(store.getState().announcements.unreadCount).toBe(0);
  });

  it('does not send a duplicate read request for an already-read announcement', async () => {
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    await store.dispatch(markAnnouncementAsRead(announcement.announcement_id));
    await store.dispatch(markAnnouncementAsRead(announcement.announcement_id));
    expect(markAnnouncementReadRequest).toHaveBeenCalledTimes(1);
  });

  it('reloads the feed and count on refresh', async () => {
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    await store.dispatch(fetchAnnouncements());
    expect(fetchAnnouncementsRequest).toHaveBeenCalledTimes(2);
    expect(fetchAnnouncementUnreadCountRequest).toHaveBeenCalledTimes(2);
  });

  it('stores a safe API error for the feed', async () => {
    fetchAnnouncementsRequest.mockRejectedValue({ response: { data: { message: 'Announcements unavailable.' } } });
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    expect(store.getState().announcements.error).toBe('Announcements unavailable.');
  });

  it('supports an empty announcement feed', async () => {
    fetchAnnouncementsRequest.mockResolvedValue(response([]));
    fetchAnnouncementUnreadCountRequest.mockResolvedValue(response({ count: 0 }));
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    expect(store.getState().announcements.announcements).toEqual([]);
    expect(store.getState().announcements.unreadCount).toBe(0);
  });

  it('maps full announcement detail content safely', () => {
    const fields = getAnnouncementDetailFields(announcement);
    expect(fields.title).toBe('Campus closure');
    expect(fields.content).toBe('The library closes early today.');
    expect(fields.priority).toBe('high');
    expect(fields.publishedAt).toBe(announcement.published_at);
    expect(fields.expiresAt).toBe(announcement.expires_at);
  });

  it('does not expose or derive sensitive user data', async () => {
    const store = createStore();
    await store.dispatch(fetchAnnouncements());
    const serialized = JSON.stringify(store.getState().announcements);
    expect(serialized).not.toMatch(/password|token|phone|email|latitude|longitude/i);
  });

  it('keeps existing incident alert reducer behavior available', () => {
    const state = alertReducer(undefined, { type: 'alerts/addAlert', payload: { alert_id: 'alert-1', is_read: false } });
    expect(state.alerts).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });
});
