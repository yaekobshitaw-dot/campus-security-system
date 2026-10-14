jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../services/api', () => ({
    __esModule: true,
    default: { post: jest.fn() },
    clearAuthSession: jest.fn(),
    consumeLogoutRefreshToken: jest.fn(),
    setLogoutRefreshToken: jest.fn(),
}));

jest.mock('../services/notification', () => ({ registerForPushNotifications: jest.fn() }));
jest.mock('../services/socket', () => ({ socketService: { connect: jest.fn(), disconnect: jest.fn() } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import api, { clearAuthSession, consumeLogoutRefreshToken } from '../services/api';
import authReducer, { logout } from './authSlice';

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
        api.post.mockResolvedValue({ status: 200 });
    });

    it('sends the in-memory refresh credential to revoke the server session', async() => {
        const store = createStore();

        const result = await store.dispatch(logout()).unwrap();

        expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'ephemeral-refresh-token' }, {
            headers: { Authorization: 'Bearer access-token' },
        });
        expect(clearAuthSession).toHaveBeenCalled();
        expect(store.getState().auth.isAuthenticated).toBe(false);
        expect(result).toEqual({ serverRevoked: true });
    });

    it('clears local authentication and reports no revocation when the server rejects credentials', async() => {
        const store = createStore();
        api.post.mockRejectedValue({ response: { status: 401 } });

        const result = await store.dispatch(logout()).unwrap();

        expect(clearAuthSession).toHaveBeenCalled();
        expect(store.getState().auth.isAuthenticated).toBe(false);
        expect(result).toEqual({ serverRevoked: false });
    });

    it('clears local authentication and reports no revocation on network failure', async() => {
        const store = createStore();
        api.post.mockRejectedValue(new Error('network unavailable'));

        const result = await store.dispatch(logout()).unwrap();

        expect(clearAuthSession).toHaveBeenCalled();
        expect(store.getState().auth.isAuthenticated).toBe(false);
        expect(result).toEqual({ serverRevoked: false });
    });

    it('clears Redux auth before a delayed server logout response', async() => {
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

    it('uses the persisted access token after restart when no refresh token is in memory', async() => {
        const store = createStore();
        consumeLogoutRefreshToken.mockReturnValue(null);

        await store.dispatch(logout()).unwrap();

        expect(api.post).toHaveBeenCalledWith('/auth/logout', {}, {
            headers: { Authorization: 'Bearer access-token' },
        });
        expect(clearAuthSession).toHaveBeenCalled();
    });

    it('does not report server revocation when no credential is available', async() => {
        const store = createStore();
        AsyncStorage.getItem.mockResolvedValue(null);
        consumeLogoutRefreshToken.mockReturnValue(null);

        const result = await store.dispatch(logout()).unwrap();

        expect(api.post).not.toHaveBeenCalled();
        expect(result).toEqual({ serverRevoked: false });
        expect(clearAuthSession).toHaveBeenCalled();
    });
});