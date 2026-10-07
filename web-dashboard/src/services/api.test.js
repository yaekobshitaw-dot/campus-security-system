import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const client = vi.fn((config) => Promise.resolve({ config }));
  client.defaults = { timeout: 30000 };
  client.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  };
  return {
    client,
    create: vi.fn(() => client),
    post: vi.fn(),
    consumePendingAction: vi.fn(),
  };
});

vi.mock('axios', () => ({ default: { create: mocks.create, post: mocks.post } }));
vi.mock('../utils/actionConfirmation', () => ({ consumePendingAction: mocks.consumePendingAction }));

import api from './api';

describe('api refresh interceptor', () => {
  const getRejectedHandler = () => api.interceptors.response.use.mock.calls[0][1];

  beforeEach(() => {
    localStorage.clear();
    mocks.client.mockClear();
    mocks.post.mockReset();
    mocks.consumePendingAction.mockReset();
  });

  it('rotates one refresh token for concurrent 401 responses and retries both requests', async () => {
    localStorage.setItem('refreshToken', 'old-refresh');
    mocks.post.mockResolvedValue({ data: { data: { accessToken: 'new-access', refreshToken: 'new-refresh', user: { user_id: 'u1' } } } });
    const reject = getRejectedHandler();

    await Promise.all([
      reject({ response: { status: 401 }, config: { url: '/users/profile', headers: {} } }),
      reject({ response: { status: 401 }, config: { url: '/notifications', headers: {} } }),
    ]);

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('token')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    expect(mocks.client).toHaveBeenCalledTimes(2);
    expect(mocks.client.mock.calls[0][0].headers.Authorization).toBe('Bearer new-access');
  });

  it('clears credentials and emits unauthorized when refresh fails', async () => {
    localStorage.setItem('token', 'expired-access');
    localStorage.setItem('refreshToken', 'expired-refresh');
    const unauthorized = vi.fn();
    window.addEventListener('campus-security:unauthorized', unauthorized);
    mocks.post.mockRejectedValue(new Error('expired refresh token'));

    await expect(getRejectedHandler()({ response: { status: 401 }, config: { url: '/users/profile', headers: {} } })).rejects.toBeDefined();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(unauthorized).toHaveBeenCalledTimes(1);
    window.removeEventListener('campus-security:unauthorized', unauthorized);
  });

  it('preserves an existing action confirmation without consuming another pending action', () => {
    const requestHandler = api.interceptors.request.use.mock.calls[0][0];
    const originalAction = { button: {}, createdAt: Date.now() };
    mocks.consumePendingAction.mockReturnValue({ button: {}, createdAt: Date.now() });

    const initialRequest = requestHandler({ headers: {} });
    expect(initialRequest.actionConfirmation).toBeTruthy();
    mocks.consumePendingAction.mockClear();

    const retriedRequest = requestHandler({ actionConfirmation: originalAction, headers: {} });
    expect(retriedRequest.actionConfirmation).toBe(originalAction);
    expect(mocks.consumePendingAction).not.toHaveBeenCalled();
  });
});
