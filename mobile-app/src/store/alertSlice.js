import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../services/api';

const initialState = {
  alerts: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

export const fetchAlerts = createAsyncThunk(
  'alerts/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/alerts');
      return Array.isArray(response.data.data) ? response.data.data : [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch alerts');
    }
  }
);

export const markAlertAsRead = createAsyncThunk(
  'alerts/markRead',
  async (alertId, { rejectWithValue }) => {
    try {
      await api.put(`/alerts/${alertId}/read`);
      return alertId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark alert as read');
    }
  }
);

const alertSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
      state.unreadCount += 1;
    },
    clearAlerts: (state) => {
      state.alerts = [];
      state.unreadCount = 0;
    },
    markAllAlertsAsRead: (state) => {
      state.alerts.forEach((alert) => { alert.is_read = true; });
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.alerts = action.payload;
        state.unreadCount = action.payload.filter((a) => !a.is_read).length;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markAlertAsRead.fulfilled, (state, action) => {
        const alert = state.alerts.find((a) => a.alert_id === action.payload);
        if (alert) {
          alert.is_read = true;
          state.unreadCount = state.alerts.filter((a) => !a.is_read).length;
        }
      });
  },
});

export const { addAlert, clearAlerts, markAllAlertsAsRead } = alertSlice.actions;
export default alertSlice.reducer;