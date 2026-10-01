// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionConfirmation from './ActionConfirmation';
import { consumePendingAction } from '../utils/actionConfirmation';
import api from '../services/api';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  consumePendingAction();
});

describe('ActionConfirmation', () => {
  it('shows an accessible confirmation only after a successful action request and dismisses it', async () => {
    vi.useFakeTimers();
    render(
      <>
        <button type="button">Save changes</button>
        <ActionConfirmation />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    const originalAdapter = api.defaults.adapter;
    api.defaults.adapter = (config) => Promise.resolve({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
    try {
      await act(async () => {
        await api.get('/test-action');
      });
    } finally {
      api.defaults.adapter = originalAdapter;
    }

    expect(screen.getByRole('status')).toHaveTextContent('Action completed');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveClass('action-confirmation');
    expect(screen.getByRole('status').style.left).toMatch(/px$/);

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
