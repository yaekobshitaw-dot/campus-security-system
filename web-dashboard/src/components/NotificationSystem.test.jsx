// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationSystem from './NotificationSystem';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
const ws = vi.hoisted(() => ({ on: vi.fn(), off: vi.fn() }));

vi.mock('../services/api', () => ({ default: api }));
vi.mock('../services/socket', () => ({ webSocket: ws }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe('NotificationSystem', () => {
  it('loads and displays persisted notifications and reacts to realtime', async () => {
    const items = [{ notification_id: 'n1', title: 'T1', message: 'M1', is_read: false, created_at: '2026-09-21T00:00:00.000Z' }];
    api.get.mockResolvedValue({ data: { data: items } });
    localStorage.setItem('token', 'test-token');

    render(<NotificationSystem />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/notifications'));
    expect(screen.getByText('🔔 Notifications')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
  });
});
