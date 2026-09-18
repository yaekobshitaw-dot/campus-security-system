// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { put: vi.fn(), delete: vi.fn() } }));

const user = { user_id: 'user-1', name: 'Ada Student', profile_photo_url: null };

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:profile-preview');
  globalThis.URL.revokeObjectURL = vi.fn();
  api.put.mockResolvedValue({ data: { success: true, data: { ...user, profile_photo_url: '/uploads/new.jpg' } } });
});

describe('ProfilePhotoEditor', () => {
  it('rejects non-image files and previews a valid selection before saving', async () => {
    const onUpdated = vi.fn();
    const { container } = render(<ProfilePhotoEditor user={user} onUpdated={onUpdated} selfOnly />);
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, WebP, or GIF image.');

    fireEvent.change(input, { target: { files: [new File(['photo'], 'profile.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByAltText('Selected profile preview')).toHaveAttribute('src', 'blob:profile-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/me/profile-photo', expect.any(FormData)));
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ profile_photo_url: '/uploads/new.jpg' }));
  });

  it('rejects images larger than 5 MB', () => {
    const { container } = render(<ProfilePhotoEditor user={user} onUpdated={vi.fn()} selfOnly />);
    const input = container.querySelector('input[type="file"]');
    const file = new File(['photo'], 'profile.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('alert')).toHaveTextContent('5 MB or smaller');
  });
});