import { configureStore } from '@reduxjs/toolkit';
import alertReducer from './alertSlice';
import authReducer from './authSlice';
import incidentReducer from './incidentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    incidents: incidentReducer,
    alerts: alertReducer,
  },
});

export default store;