// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CampusLocationsPage from './CampusLocationsPage';

const { apiGet, apiPatch } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPatch: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: apiGet, patch: apiPatch } }));
vi.mock('./SecurityMap.jsx', () => ({ default: ({ onMapClick, onLocationDragEnd }) => <div><button type="button" onClick={() => onMapClick({ lat: 10.9855, lng: 39.2632 })}>Place on map</button><button type="button" onClick={() => onLocationDragEnd({ lat: 10.9856, lng: 39.2633 })}>Drag marker</button></div> }));

const locations = [{ location_id: 'admin-1', name: 'MAU Administration BD', type: 'administration', latitude: null, longitude: null }];

describe('CampusLocationsPage', () => {
  it('captures a map click, supports adjustment, and saves coordinates', async () => {
    apiGet.mockResolvedValue({ data: { data: locations } });
    apiPatch.mockResolvedValue({ data: { data: { ...locations[0], latitude: 10.9856, longitude: 39.2633 } } });
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    await screen.findAllByText('MAU Administration BD');
    fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
    expect(screen.getByText('10.9855000, 39.2632000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Drag marker' }));
    expect(screen.getByText('10.9856000, 39.2633000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save coordinates' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/campus-locations/admin-1', { latitude: 10.9856, longitude: 39.2633 }));
  });
});
