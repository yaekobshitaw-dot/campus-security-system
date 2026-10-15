jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  clearAuthSession: jest.fn(),
  consumeLogoutRefreshToken: jest.fn(),
  setLogoutRefreshToken: jest.fn(),
}));

jest.mock('../services/notification', () => ({ registerForPushNotifications: jest.fn() }));
jest.mock('../services/socket', () => ({ socketService: { connect: jest.fn(), disconnect: jest.fn() } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import api, { clearAuthSession, consumeLogoutRefreshToken } from '../services/api';
import authReducer, { hydrateAuth, logout } from './authSlice';

const createStore = () => configureStore({
  reducer: { auth: authReducer },
  preloadedState: {
    auth: {
      user: { user_id: 'user-1' },
      token: 'existing-access-token',
      isAuthenticated: true,
      isHydrated: true,
      loading: false,
      error: null,
    },
  },
});

describe('mobile logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('access-token');
    consumeLogoutRefreshToken.mockReturnValue('ephemeral-refresh-token');
    api.get.mockResolvedValue({ data: { data: { user_id: 'user-1' } } });
    api.post.mockResolvedValue({ status: 200 });
  });

  it('refreshes and persists the current profile during session restoration', async () => {
    const cachedUser = { user_id: 'user-1', name: 'Cached name', profile_photo_url: null };
    const currentUser = { ...cachedUser, name: 'Saved name', profile_photo_url: 'https://api.example/uploads/profile-photos/photo.jpg' };
    AsyncStorage.getItem.mockImplementation(async (key) => ({
      auth_token: 'access-token',
      user: JSON.stringify(cachedUser),
    }[key] || null));
    api.get.mockResolvedValue({ data: { success: true, data: currentUser } });
    const store = createStore();

    const result = await store.dispatch(hydrateAuth()).unwrap();

    expect(api.get).toHaveBeenCalledWith('/users/profile');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(currentUser));
    expect(result.user).toEqual(currentUser);
    expect(store.getState().auth.user).toEqual(currentUser);
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it('keeps the cached profile when current-user refresh fails without invalidating the session', async () => {
    const cachedUser = { user_id: 'user-1', name: 'Cached name' };
    AsyncStorage.getItem.mockImplementation(async (key) => ({
      auth_token: 'access-token',
      user: JSON.stringify(cachedUser),
    }[key] || null));
    api.get.mockRejectedValue(new Error('network unavailable'));
    const store = createStore();

    const result = await store.dispatch(hydrateAuth()).unwrap();

    expect(api.get).toHaveBeenCalledWith('/users/profile');
    expect(result.user).toEqual(cachedUser);
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(clearAuthSession).not.toHaveBeenCalled();
  });

  it('clears the stored session when profile refresh returns 401', async () => {
    const cachedUser = { user_id: 'user-1', name: 'Cached name' };
    AsyncStorage.getItem.mockImplementation(async (key) => ({
      auth_token: 'access-token',
      user: JSON.stringify(cachedUser),
    }[key] || null));
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    clearAuthSession.mockImplementationOnce(async () => {
      await Promise.all(['auth_token', 'refresh_token', 'user'].map((key) => AsyncStorage.removeItem(key)));
    });
    api.get.mockRejectedValue({ response: { status: 401 } });
    const store = createStore();

    await expect(store.dispatch(hydrateAuth()).unwrap()).rejects.toBe('Session could not be restored. Please sign in again.');

    expect(api.get).toHaveBeenCalledWith('/users/profile');
    expect(clearAuthSession).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });

  it('sends the in-memory refresh credential to revoke the server session', async () => {
    const store = createStore();

    const result = await store.dispatch(logout()).unwrap();

    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'ephemeral-refresh-token' }, {
      headers: { Authorization: 'Bearer access-token' },
    });
    expect(clearAuthSession).toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(result).toEqual({ serverRevoked: true });
  });

  it('clears local authentication and reports no revocation when the server rejects credentials', async () => {
    const store = createStore();
    api.post.mockRejectedValue({ response: { status: 401 } });

    const result = await store.dispatch(logout()).unwrap();

    expect(clearAuthSession).toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(result).toEqual({ serverRevoked: false });
  });

  it('clears local authentication and reports no revocation on network failure', async () => {
    const store = createStore();
    api.post.mockRejectedValue(new Error('network unavailable'));

    const result = await store.dispatch(logout()).unwrap();

    expect(clearAuthSession).toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(result).toEqual({ serverRevoked: false });
  });

  it('clears Redux auth before a delayed server logout response', async () => {
    const store = createStore();
    let resolveLogout;
    api.post.mockImplementation(() => new Promise((resolve) => { resolveLogout = resolve; }));

    const logoutTask = store.dispatch(logout());
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(resolveLogout).toEqual(expect.any(Function));
    resolveLogout({ status: 200 });
    expect(await logoutTask.unwrap()).toEqual({ serverRevoked: true });
  });

  it('uses the persisted access token after restart when no refresh token is in memory', async () => {
    const store = createStore();
    consumeLogoutRefreshToken.mockReturnValue(null);

    await store.dispatch(logout()).unwrap();

    expect(api.post).toHaveBeenCalledWith('/auth/logout', {}, {
      headers: { Authorization: 'Bearer access-token' },
    });
    expect(clearAuthSession).toHaveBeenCalled();
  });

  it('does not report server revocation when no credential is available', async () => {
    const store = createStore();
    AsyncStorage.getItem.mockResolvedValue(null);
    consumeLogoutRefreshToken.mockReturnValue(null);

    const result = await store.dispatch(logout()).unwrap();

    expect(api.post).not.toHaveBeenCalled();
    expect(result).toEqual({ serverRevoked: false });
    expect(clearAuthSession).toHaveBeenCalled();
  });
});