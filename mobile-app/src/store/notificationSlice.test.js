jest.mock('../services/notificationService', () => ({
  fetchNotificationsRequest: jest.fn(),
  markNotificationReadRequest: jest.fn(),
  markAllNotificationsReadRequest: jest.fn(),
}));

import notificationReducer, { addRealtimeNotification } from './notificationSlice';

describe('notificationSlice', () => {
  it('adds realtime notification if not present', () => {
    const initialState = { notifications: [], unreadCount: 0 };
    const action = addRealtimeNotification({ notification_id: 'n1', is_read: false });
    const state = notificationReducer(initialState, action);
    expect(state.notifications.length).toBe(1);
    expect(state.unreadCount).toBe(1);
  });
});
