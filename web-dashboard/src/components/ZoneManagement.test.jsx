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

const refresh = vi.fn().mockResolvedValue(undefined);

function renderZones(role = 'admin', zones = []) {
  return render(<ZoneManagement zones={zones} loading={false} error="" canManage={['admin', 'security'].includes(role)} onRefresh={refresh} />);
}

describe('ZoneManagement', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue(undefined);
  });

  it('shows write controls to admins and security users only', () => {
    const { unmount } = renderZones('admin');
    expect(screen.getByRole('button', { name: 'Create zone' })).toBeInTheDocument();
    unmount();
    renderZones('student');
    expect(screen.queryByRole('button', { name: 'Create zone' })).not.toBeInTheDocument();
  });

  it('shows the expected empty state', () => {
    renderZones('student');
    expect(screen.getByText('No zones configured yet.')).toBeInTheDocument();
  });

  it('rejects an invalid circle before making a request', () => {
    renderZones('admin');
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '   ' } });
    fireEvent.change(inputs[0], { target: { value: '9.02' } });
    fireEvent.change(inputs[1], { target: { value: '38.75' } });
    fireEvent.change(inputs[2], { target: { value: '500' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create zone' })[1]);
    expect(screen.getByText('Name is required and must be 100 characters or fewer.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits a valid circle and refreshes the shared zone state', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });
    renderZones('security');
    fireEvent.click(screen.getByRole('button', { name: 'Create zone' }));
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'North Gate' } });
    fireEvent.change(inputs[0], { target: { value: '9.02' } });
    fireEvent.change(inputs[1], { target: { value: '38.75' } });
    fireEvent.change(inputs[2], { target: { value: '500' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create zone' })[1]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/zones', expect.objectContaining({ name: 'North Gate', coordinates: null, radius: 500 })));
    expect(refresh).toHaveBeenCalled();
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
