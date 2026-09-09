import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api, { clearAuthSession } from '../services/api';
import { registerForPushNotifications } from '../services/notification';
import { socketService } from '../services/socket';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  loading: false,
  error: null,
};

const getLoginErrorMessage = (error) => {
  const backendMessage = error.response?.data?.message;
  if (backendMessage) {
    return backendMessage;
  }

  if (!error.response) {
    return 'Network error. Check the connection to the campus security server.';
  }

  if (error.response.status >= 500) {
    return 'Server error. Please try again later.';
  }

  return 'Login failed. Please check your email and password.';
};

export const hydrateAuth = createAsyncThunk(
  'auth/hydrateAuth',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');

      if (!token || !storedUser) {
        await clearAuthSession();
        return { user: null, token: null };
      }

      const user = JSON.parse(storedUser);
      await socketService.connect();
      return { user, token };
    } catch (error) {
      await clearAuthSession();
      return rejectWithValue('Session could not be restored. Please sign in again.');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { user, accessToken } = response.data.data;
      await AsyncStorage.setItem('auth_token', accessToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await socketService.connect();
      await registerForPushNotifications();
      return { user, token: accessToken };
    } catch (error) {
      if (__DEV__ && (!error.response || error.response.status >= 500)) {
        console.error('Login request failed:', {
          message: error?.message,
          code: error?.code,
          status: error?.response?.status,
          url: error?.config?.url,
        });
      }
      return rejectWithValue(getLoginErrorMessage(error));
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          if (!error.response || error.response.status >= 500) {
            console.error('Server logout failed; clearing local session anyway.', error?.message || error);
          }
        }
      }
      await clearAuthSession();
      return null;
    } catch (error) {
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    sessionExpired: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isHydrated = true;
      state.loading = false;
      state.error = 'Session expired. Please sign in again.';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(hydrateAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isHydrated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = Boolean(action.payload.token && action.payload.user);
      })
      .addCase(hydrateAuth.rejected, (state, action) => {
        state.loading = false;
        state.isHydrated = true;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload || 'Session could not be restored.';
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isHydrated = true;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isHydrated = true;
        state.loading = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isHydrated = true;
        state.loading = false;
        state.error = action.payload || 'Logout failed';
      });
  },
});

export const { clearError, setUser, sessionExpired } = authSlice.actions;
export default authSlice.reducer;