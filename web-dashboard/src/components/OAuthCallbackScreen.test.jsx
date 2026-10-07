import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OAuthCallbackScreen } from './AuthScreens';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

describe('OAuthCallbackScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/oauth/callback');
  });

  it('reads a ticket from the query string and exchanges it exactly once', async () => {
    const onLogin = vi.fn();
    api.post.mockResolvedValue({ data: { data: { user: { user_id: 'u1' }, accessToken: 'tok', refreshToken: 'refresh-tok' } } });
    window.history.replaceState({}, '', '/oauth/callback?ticket=test-ticket-123');

    render(
      <MemoryRouter initialEntries={['/oauth/callback?ticket=test-ticket-123']}>
        <Routes>
          <Route path="/oauth/callback" element={<OAuthCallbackScreen onLogin={onLogin} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/oauth/exchange', { ticket: 'test-ticket-123' }));
    await waitFor(() => expect(localStorage.getItem('token')).toBe('tok'));
    expect(localStorage.getItem('refreshToken')).toBe('refresh-tok');
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('');
  });

  it('does not make a second exchange when StrictMode mounts twice', async () => {
    const onLogin = vi.fn();
    api.post.mockResolvedValue({ data: { data: { user: { user_id: 'u1' }, accessToken: 'tok', refreshToken: 'refresh-tok' } } });
    window.history.replaceState({}, '', '/oauth/callback?ticket=strict-ticket');

    render(
      <MemoryRouter initialEntries={['/oauth/callback?ticket=strict-ticket']}>
        <Routes>
          <Route path="/oauth/callback" element={<React.StrictMode><OAuthCallbackScreen onLogin={onLogin} /></React.StrictMode>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/auth/oauth/exchange', { ticket: 'strict-ticket' });
    expect(window.location.search).toBe('');
  });
});
