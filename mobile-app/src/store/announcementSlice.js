import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchAnnouncementUnreadCountRequest,
  fetchAnnouncementsRequest,
  markAnnouncementReadRequest,
} from '../services/announcementService';

const initialState = {
  announcements: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

const getErrorMessage = (error, fallback) => error.response?.data?.message || fallback;

export const fetchAnnouncements = createAsyncThunk(
  'announcements/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const [listResponse, countResponse] = await Promise.all([
        fetchAnnouncementsRequest(),
        fetchAnnouncementUnreadCountRequest(),
      ]);
      return {
        announcements: Array.isArray(listResponse.data?.data) ? listResponse.data.data : [],
        unreadCount: Number(countResponse.data?.data?.count || 0),
      };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Unable to load announcements.'));
    }
  }
);

export const markAnnouncementAsRead = createAsyncThunk(
  'announcements/markRead',
  async (announcementId, { rejectWithValue }) => {
    try {
      await markAnnouncementReadRequest(announcementId);
      return announcementId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Unable to mark announcement as read.'));
    }
  },
  {
    condition: (announcementId, { getState }) => {
      const announcement = getState().announcements?.announcements?.find((item) => item.announcement_id === announcementId);
      return Boolean(announcement && !announcement.is_read);
    },
  }
);

const announcementSlice = createSlice({
  name: 'announcements',
  initialState,
  reducers: {
    clearAnnouncements: (state) => {
      state.announcements = [];
      state.unreadCount = 0;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnnouncements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncements.fulfilled, (state, action) => {
        state.loading = false;
        state.announcements = action.payload.announcements;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchAnnouncements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unable to load announcements.';
      })
      .addCase(markAnnouncementAsRead.fulfilled, (state, action) => {
        const announcement = state.announcements.find((item) => item.announcement_id === action.payload);
        if (announcement && !announcement.is_read) {
          announcement.is_read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAnnouncementAsRead.rejected, (state, action) => {
        state.error = action.payload || 'Unable to mark announcement as read.';
      });
  },
});

export const { clearAnnouncements } = announcementSlice.actions;
export default announcementSlice.reducer;
