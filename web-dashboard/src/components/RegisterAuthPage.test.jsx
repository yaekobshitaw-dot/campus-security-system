// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from '../services/api';
import { AuthPage } from './PublicSite';

vi.mock('../services/api', () => ({
  default: {
    defaults: { baseURL: '/api' },
    get: vi.fn(),
    post: vi.fn()
  }
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<AuthPage mode="register" onLogin={vi.fn()} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Register page additions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { success: true } });
  });

  it('shows the existing logo, phone field, and Google auth in English', () => {
    renderRegister();

    const logos = screen.getAllByAltText('Mekdela Amba University logo');
    expect(logos.length).toBeGreaterThan(0);
    expect(logos.every((logo) => logo.getAttribute('src') === '/images/logo.png')).toBe(true);
    expect(screen.getByLabelText('Phone Number')).toHaveAttribute('type', 'tel');
    expect(screen.getByPlaceholderText('Enter your phone number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('localizes the phone field and Google button using the saved Amharic preference', () => {
    localStorage.setItem('campussecure-language', 'am');
    renderRegister();

    expect(screen.getByLabelText('ስልክ ቁጥር')).toHaveAttribute('type', 'tel');
    expect(screen.getByPlaceholderText('ስልክ ቁጥርዎን ያስገቡ').getAttribute('name')).toBe('phone');
    expect(screen.getByRole('button', { name: 'በGoogle ይቀጥሉ' })).toBeInTheDocument();
  });

  it('submits the phone number through the supported registration API field', async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Campus email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '+1 555 123 4567' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      phone: '+1 555 123 4567',
      role: 'student'
    }));
  });
});
