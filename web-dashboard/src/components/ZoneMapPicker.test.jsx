// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ZoneMapPicker from './ZoneMapPicker';

const leafletMock = vi.hoisted(() => ({ mapEvents: null }));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  Marker: ({ position, eventHandlers }) => (
    <button
      type="button"
      aria-label="Drag selected marker"
      data-position={position.join(',')}
      onClick={() => eventHandlers.dragend({ target: { getLatLng: () => ({ lat: 9.03, lng: 38.76 }) } })}
    />
  ),
  TileLayer: ({ url }) => <div data-testid="tile-layer" data-url={url} />,
  useMapEvents: (events) => { leafletMock.mapEvents = events; },
}));

describe('ZoneMapPicker', () => {
  beforeEach(() => {
    leafletMock.mapEvents = null;
  });

  it('selects a map point and updates the draggable marker and coordinates', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ZoneMapPicker latitude="" longitude="" onChange={onChange} />);

    act(() => leafletMock.mapEvents.click({ latlng: { lat: 9.01, lng: 38.74 } }));
    expect(onChange).toHaveBeenCalledWith('9.01', '38.74');

    rerender(<ZoneMapPicker latitude="9.01" longitude="38.74" onChange={onChange} />);
    expect(screen.getByText('9.010000')).toBeInTheDocument();
    expect(screen.getByText('38.740000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag selected marker' })).toHaveAttribute('data-position', '9.01,38.74');
    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain('openstreetmap.org');

    fireEvent.click(screen.getByRole('button', { name: 'Satellite' }));
    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain('World_Imagery');
    expect(screen.getByRole('button', { name: 'Drag selected marker' })).toHaveAttribute('data-position', '9.01,38.74');
    expect(screen.getByText('9.010000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Street Map' }));
    expect(screen.getByTestId('tile-layer').getAttribute('data-url')).toContain('openstreetmap.org');

    fireEvent.click(screen.getByRole('button', { name: 'Drag selected marker' }));
    expect(onChange).toHaveBeenLastCalledWith('9.03', '38.76');
  });
});
