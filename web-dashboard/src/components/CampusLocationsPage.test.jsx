// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CampusLocationsPage from './CampusLocationsPage';

const { apiGet, apiPatch, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPatch: vi.fn(), apiPost: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: apiGet, patch: apiPatch, post: apiPost } }));
vi.mock('./SecurityMap.jsx', () => ({ default: ({ onMapClick, onLocationDragEnd }) => <div><button type="button" onClick={() => onMapClick({ lat: 10.9855, lng: 39.2632 })}>Place on map</button><button type="button" onClick={() => onLocationDragEnd({ lat: 10.9856, lng: 39.2633 })}>Drag marker</button></div> }));

const locations = [{
  location_id: 'admin-1',
  name: 'MAU Administration BD',
  type: 'administration',
  latitude: null,
  longitude: null,
  zone_id: null,
}];

describe('CampusLocationsPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPatch.mockReset();
    apiPost.mockReset();
  });

  it('shows the existing name and saves a rename without changing type, coordinates, or zone', async () => {
    const location = {
      ...locations[0],
      latitude: 10.984911,
      longitude: 39.262305,
      zone_id: 'admin-zone',
    };
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [{ zone_id: 'admin-zone', name: 'Administration Zone' }] : [location] },
    }));
    apiPatch.mockResolvedValue({
      data: { data: { ...location, name: 'MAU Administration Building' } },
    });
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    const nameInput = await screen.findByRole('textbox', { name: 'Location Name / Building Name' });
    expect(nameInput).toHaveValue('MAU Administration BD');
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('administration');
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveValue(10.984911);
    expect(screen.getByRole('spinbutton', { name: 'Longitude' })).toHaveValue(39.262305);
    expect(await screen.findByRole('combobox', { name: 'Assign to zone' })).toHaveValue('admin-zone');

    fireEvent.change(nameInput, { target: { value: 'MAU Administration Building' } });
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('administration');
    fireEvent.click(screen.getByRole('button', { name: 'Update location' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/campus-locations/admin-1', {
      name: 'MAU Administration Building',
      type: 'administration',
      latitude: 10.984911,
      longitude: 39.262305,
      zone_id: 'admin-zone',
    }));
    await waitFor(() => expect(nameInput).toHaveValue('MAU Administration Building'));
    expect(screen.getByRole('button', { name: /MAU Administration Building/ })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveValue(10.984911);
    expect(screen.getByRole('spinbutton', { name: 'Longitude' })).toHaveValue(39.262305);
    expect(screen.getByRole('combobox', { name: 'Assign to zone' })).toHaveValue('admin-zone');
  });

  it('changes and saves the type without changing name, coordinates, or zone', async () => {
    const location = {
      ...locations[0],
      latitude: 10.984911,
      longitude: 39.262305,
      zone_id: 'admin-zone',
    };
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [{ zone_id: 'admin-zone', name: 'Administration Zone' }] : [location] },
    }));
    apiPatch.mockResolvedValue({
      data: { data: { ...location, type: 'dormitory' } },
    });
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    const typeSelect = await screen.findByRole('combobox', { name: 'Type' });
    expect(typeSelect).toHaveValue('administration');
    expect(Array.from(typeSelect.options).map((option) => option.value)).toEqual([
      'university',
      'administration',
      'classroom',
      'seminar',
      'building/block',
      'gate',
      'security_post',
      'dormitory',
      'library',
      'clinic',
      'cafeteria',
      'parking',
      'sports',
      'emergency_point',
      'other',
    ]);

    fireEvent.change(typeSelect, { target: { value: 'dormitory' } });
    expect(screen.getByRole('textbox', { name: 'Location Name / Building Name' })).toHaveValue('MAU Administration BD');
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveValue(10.984911);
    expect(screen.getByRole('spinbutton', { name: 'Longitude' })).toHaveValue(39.262305);
    expect(screen.getByRole('combobox', { name: 'Assign to zone' })).toHaveValue('admin-zone');
    fireEvent.click(screen.getByRole('button', { name: 'Update location' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/campus-locations/admin-1', {
      name: 'MAU Administration BD',
      type: 'dormitory',
      latitude: 10.984911,
      longitude: 39.262305,
      zone_id: 'admin-zone',
    }));
  });

  it('allows changing type before placement but keeps saving disabled until coordinates are set', async () => {
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [] : locations },
    }));
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    const typeSelect = await screen.findByRole('combobox', { name: 'Type' });
    expect(apiPatch).not.toHaveBeenCalled();
    fireEvent.change(typeSelect, { target: { value: 'dormitory' } });

    expect(typeSelect).toHaveValue('dormitory');
    expect(apiPatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Update location' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Update location' }));
    expect(apiPatch).not.toHaveBeenCalled();
  });

  it('captures a map click, supports adjustment, and saves coordinates', async () => {
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [] : locations },
    }));
    apiPatch.mockResolvedValue({
      data: { data: { ...locations[0], latitude: 10.9856, longitude: 39.2633 } },
    });
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    await screen.findAllByText('MAU Administration BD');
    expect(screen.getByRole('textbox', { name: 'Location Name / Building Name' })).toHaveValue('MAU Administration BD');
    fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveValue(10.9855);
    expect(screen.getByRole('spinbutton', { name: 'Longitude' })).toHaveValue(39.2632);
    fireEvent.click(screen.getByRole('button', { name: 'Drag marker' }));
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveValue(10.9856);
    expect(screen.getByRole('spinbutton', { name: 'Longitude' })).toHaveValue(39.2633);
    fireEvent.click(screen.getByRole('button', { name: 'Update location' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/campus-locations/admin-1', {
      name: 'MAU Administration BD',
      type: 'administration',
      latitude: 10.9856,
      longitude: 39.2633,
      zone_id: null,
    }));
  });

  it('creates a named location at the map-selected coordinates and renders it after saving', async () => {
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [] : locations },
    }));
    const created = {
      location_id: 'library-1',
      name: 'Main Library',
      type: 'library',
      description: 'Main campus library',
      latitude: 10.9855,
      longitude: 39.2632,
      zone_id: null,
    };
    apiPost.mockResolvedValue({ data: { data: created } });
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create location' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Location Name / Building Name' }), {
      target: { value: 'Main Library' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'library' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'Main campus library' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Create location' })[1]);

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/campus-locations', {
      name: 'Main Library',
      type: 'library',
      latitude: 10.9855,
      longitude: 39.2632,
      zone_id: null,
      description: 'Main campus library',
    }));
    expect(await screen.findByText('Campus location created successfully.')).toBeInTheDocument();
    expect(screen.getAllByText('Main Library').length).toBeGreaterThan(0);
    expect(screen.getByRole('spinbutton', { name: 'Latitude' })).toHaveValue(10.9855);
    expect(screen.getByRole('spinbutton', { name: 'Longitude' })).toHaveValue(39.2632);
  });

  it('does not allow an empty name to be submitted', async () => {
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [] : locations },
    }));
    render(<CampusLocationsPage user={{ role: 'admin' }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));

    expect(screen.getAllByRole('button', { name: 'Create location' })[1]).toBeDisabled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('shows campus locations to security officers without management controls', async () => {
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [] : locations },
    }));
    render(<CampusLocationsPage user={{ role: 'security_officer' }} />);

    expect((await screen.findAllByText('MAU Administration BD')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Create location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Location Name / Building Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Type' })).not.toBeInTheDocument();
    expect(apiPatch).not.toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it.each(['student', 'faculty'])('does not expose management controls to %s users', async (role) => {
    apiGet.mockImplementation((path) => Promise.resolve({
      data: { data: path === '/zones' ? [] : locations },
    }));
    render(<CampusLocationsPage user={{ role }} />);

    expect((await screen.findAllByText('MAU Administration BD')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Create location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update location' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Location Name / Building Name' })).not.toBeInTheDocument();
  });
});
