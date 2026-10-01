import '@testing-library/jest-dom/vitest';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginScreen } from './AuthScreens';

describe('LoginScreen success message from navigation state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays the success message passed via location state and auto-dismisses', async () => {
    const message = 'Password changed successfully. You can now log in.';
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { message } }]}>
        <Routes>
          <Route path="/login" element={<LoginScreen onLogin={() => {}} />} />
        </Routes>
      </MemoryRouter>
    );

    // The success message should be visible initially
    expect(screen.getByText(message)).toBeInTheDocument();

    // Advance timers by 5s to trigger auto-dismiss
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });
});
