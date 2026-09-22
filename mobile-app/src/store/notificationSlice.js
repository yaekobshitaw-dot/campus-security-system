import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchNotificationsRequest, markNotificationReadRequest, markAllNotificationsReadRequest } from '../services/notificationService';

const initialState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

const getErrorMessage = (error, fallback) => error.response?.data?.message || fallback;

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await fetchNotificationsRequest();
    const items = Array.isArray(response.data?.data) ? response.data.data : [];
    const unreadCount = items.filter((i) => !i.is_read).length;
    return { items, unreadCount };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Unable to load notifications.'));
  }
});

export const markNotificationAsRead = createAsyncThunk('notifications/markRead', async (id, { rejectWithValue }) => {
  try {
    await markNotificationReadRequest(id);
    return id;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Unable to mark notification as read.'));
  }
});

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async (_, { rejectWithValue }) => {
  try {
    await markAllNotificationsReadRequest();
    return true;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Unable to mark all notifications as read.'));
  }
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addRealtimeNotification: (state, action) => {
      const n = action.payload;
      if (!state.notifications.find((x) => x.notification_id === n.notification_id)) {
        state.notifications.unshift(n);
        if (!n.is_read) state.unreadCount += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.items;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unable to load notifications.';
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const id = action.payload;
        const item = state.notifications.find((n) => n.notification_id === id);
        if (item && !item.is_read) {
          item.is_read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload || 'Unable to mark notification as read.';
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map((n) => ({ ...n, is_read: true }));
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsRead.rejected, (state, action) => {
        state.error = action.payload || 'Unable to mark all notifications as read.';
      });
  },
});

export const { addRealtimeNotification } = notificationSlice.actions;
export default notificationSlice.reducer;
