import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginScreen } from './AuthScreens';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

describe('MFA login modes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('submits a six-digit authenticator code by default', async () => {
    api.post
      .mockResolvedValueOnce({ data: { data: { mfaRequired: true, challengeToken: 'challenge' } } })
      .mockResolvedValueOnce({ data: { data: { user: { user_id: 'u1' }, accessToken: 'access', refreshToken: 'refresh' } } });
    render(<MemoryRouter><LoginScreen onLogin={vi.fn()} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Campus email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to dashboard' }));
    const codeInput = await screen.findByLabelText('Authenticator code');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/auth/mfa/verify', { challengeToken: 'challenge', code: '123456' }));
  });

  it('submits a recovery code when recovery mode is selected', async () => {
    api.post
      .mockResolvedValueOnce({ data: { data: { mfaRequired: true, challengeToken: 'challenge' } } })
      .mockResolvedValueOnce({ data: { data: { user: { user_id: 'u1' }, accessToken: 'access', refreshToken: 'refresh' } } });
    render(<MemoryRouter><LoginScreen onLogin={vi.fn()} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Campus email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to dashboard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use recovery code' }));
    fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: 'a1b2c3d4e5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/auth/mfa/verify', { challengeToken: 'challenge', recoveryCode: 'a1b2c3d4e5' }));
  });

  it('returns to the protected Contacts destination after successful login', async () => {
    api.post.mockResolvedValue({
      data: { data: {
        user: { user_id: 'u1', role: 'student' },
        accessToken: 'access',
        refreshToken: 'refresh'
      } }
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/contacts' } } }]}>
        <Routes>
          <Route path="/login" element={<LoginScreen onLogin={vi.fn()} />} />
          <Route path="/contacts" element={<p>Contacts destination</p>} />
          <Route path="/dashboard" element={<p>Dashboard destination</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Campus email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to dashboard' }));

    expect(await screen.findByText('Contacts destination')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard destination')).not.toBeInTheDocument();
  });

  it('returns to Contacts after successful MFA verification', async () => {
    api.post
      .mockResolvedValueOnce({ data: { data: { mfaRequired: true, challengeToken: 'challenge' } } })
      .mockResolvedValueOnce({ data: { data: {
        user: { user_id: 'u1', role: 'student' },
        accessToken: 'access',
        refreshToken: 'refresh'
      } } });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/contacts' } } }]}>
        <Routes>
          <Route path="/login" element={<LoginScreen onLogin={vi.fn()} />} />
          <Route path="/contacts" element={<p>Contacts destination</p>} />
          <Route path="/dashboard" element={<p>Dashboard destination</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Campus email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to dashboard' }));
    fireEvent.change(await screen.findByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    expect(await screen.findByText('Contacts destination')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard destination')).not.toBeInTheDocument();
  });

  it.each(['https://external.example/path', '//external.example/path', '/\\external.example/path'])(
    'rejects unsafe post-login destination %s', async (requestedPath) => {
      api.post.mockResolvedValue({ data: { data: {
        user: { user_id: 'u1', role: 'student' },
        accessToken: 'access',
        refreshToken: 'refresh'
      } } });
      render(
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: requestedPath } }]}>
          <Routes>
            <Route path="/login" element={<LoginScreen onLogin={vi.fn()} />} />
            <Route path="/contacts" element={<p>Contacts destination</p>} />
            <Route path="/dashboard" element={<p>Dashboard destination</p>} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText('Campus email'), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Sign in to dashboard' }));

      expect(await screen.findByText('Dashboard destination')).toBeInTheDocument();
      expect(screen.queryByText('Contacts destination')).not.toBeInTheDocument();
    },
  );
});