// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactInformationForm from './ContactInformationForm';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn() }
}));

const savedContact = { phone: '0976296127', email: 'yaekobshitaw@gmail.com', location: 'Tuluawulia' };

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.get.mockResolvedValue({ data: { data: savedContact } });
  api.put.mockImplementation((_url, values) => Promise.resolve({ data: { data: values } }));
});

afterEach(() => cleanup());

describe('ContactInformationForm', () => {
  it('loads current Phone, Email, and Location from the backend', async () => {
    render(<ContactInformationForm />);

    expect(await screen.findByLabelText('Phone')).toHaveValue(savedContact.phone);
    expect(screen.getByLabelText('Email')).toHaveValue(savedContact.email);
    expect(screen.getByLabelText('Location')).toHaveValue(savedContact.location);
    expect(api.get).toHaveBeenCalledWith('/content/contact');
  });

  it.each([
    ['Phone', '0976000000'],
    ['Email', 'updated@example.com'],
    ['Location', 'Updated campus location'],
  ])('saves an updated %s and reports success', async (field, value) => {
    render(<ContactInformationForm />);
    const input = await screen.findByLabelText(field);
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/content/contact', {
      ...savedContact,
      [field.toLowerCase()]: value,
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Contact information saved.');
  });

  it('restores the loaded information when Cancel is selected', async () => {
    render(<ContactInformationForm />);
    fireEvent.change(await screen.findByLabelText('Location'), { target: { value: 'Unsaved location' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Location')).toHaveValue(savedContact.location);
    expect(api.put).not.toHaveBeenCalled();
  });

  it('shows backend save errors', async () => {
    api.put.mockRejectedValue({ response: { data: { message: 'Invalid contact information.' } } });
    render(<ContactInformationForm />);
    await screen.findByLabelText('Phone');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid contact information.');
  });
});
