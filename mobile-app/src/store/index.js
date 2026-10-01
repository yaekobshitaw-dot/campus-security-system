import { configureStore } from '@reduxjs/toolkit';
import alertReducer from './alertSlice';
import announcementReducer from './announcementSlice';
import authReducer from './authSlice';
import incidentReducer from './incidentSlice';
import notificationReducer from './notificationSlice';
import settingsReducer from './settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    incidents: incidentReducer,
    alerts: alertReducer,
    announcements: announcementReducer,
    notifications: notificationReducer,
    settings: settingsReducer,
  },
});

export default store;