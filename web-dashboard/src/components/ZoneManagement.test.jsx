// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ZoneManagement from './ZoneManagement';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./ZoneMapPicker', () => ({
  default: ({ latitude, longitude, onChange }) => (
    <div>
      <button type="button" onClick={() => onChange('9.02', '38.75')}>Choose map location</button>
      <output>{latitude},{longitude}</output>
    </div>
  ),
}));

const refresh = vi.fn().mockResolvedValue(undefined);

function renderZones(role = 'admin', zones = []) {
  return render(<ZoneManagement zones={zones} loading={false} error="" canManage={role === 'admin'} onRefresh={refresh} />);
}

describe('ZoneManagement', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue(undefined);
  });

  it('shows zone write controls to admins only', () => {
    const { unmount } = renderZones('admin');
    expect(screen.getByRole('button', { name: 'Create zone' })).toBeInTheDocument();
    unmount();
    const { unmount: unmountStudent } = renderZones('student');
    expect(screen.queryByRole('button', { name: 'Create zone' })).not.toBeInTheDocument();
    unmountStudent();
    renderZones('security');
    expect(screen.queryByRole('button', { name: 'Create zone' })).not.toBeInTheDocument();
  });

  it('shows the expected empty state', () => {
    renderZones('student');
    expect(screen.getByText('No zones configured yet.')).toBeInTheDocument();
  });

  it('keeps zone details visible to security officers without any write controls', () => {
    renderZones('security', [{ zone_id: 'zone-1', name: 'North Gate', radius: 500, is_active: true }]);

    expect(screen.getByText('North Gate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create zone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('rejects an invalid circle before making a request', () => {
    renderZones('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '   ' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '500' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create zone' })[1]);
    expect(screen.getByText('Name is required and must be 100 characters or fewer.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits a valid circle and refreshes the shared zone state', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });
    renderZones('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'North Gate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose map location' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '500' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create zone' })[1]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/zones', expect.objectContaining({
      name: 'North Gate',
      coordinates: null,
      center_lat: 9.02,
      center_lng: 38.75,
      radius: 500,
    })));
    expect(refresh).toHaveBeenCalled();
  });

  it('loads existing circle coordinates into the map picker for editing', () => {
    renderZones('admin', [{
      zone_id: 'zone-1',
      name: 'North Gate',
      center_lat: 9.02,
      center_lng: 38.75,
      radius: 500,
      is_active: true,
    }]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('9.02,38.75')).toBeInTheDocument();
  });

  it('rejects malformed polygon JSON before making a request', () => {
    renderZones('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'polygon' } });
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Library Area' } });
    fireEvent.change(textboxes[3], { target: { value: '{"type":"Polygon","coordinates":[]}' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create zone' })[1]);
    expect(screen.getByText('Coordinates must be a GeoJSON Polygon with at least one ring.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
