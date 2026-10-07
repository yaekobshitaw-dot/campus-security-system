import React, { useState } from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// setupTests.js ensures jsdom and basic globals are present; let real Leaflet/react-leaflet load under jsdom

import SecurityMap from './SecurityMap';

const sampleCampus = [
  { location_id: 'l1', name: 'Main Library', latitude: 10.9855, longitude: 39.2632, type: 'library', is_active: true },
  { location_id: 'l2', name: 'Main Gate', latitude: 10.9860, longitude: 39.2638, type: 'gate', is_active: true }
];

const sampleIncidents = [
  { incident_id: 'i1', campus_location_id: 'l1', latitude: 10.9856, longitude: 39.2633, is_sos: false, type: 'theft', status: 'open', severity: 2, responses: [] },
  { incident_id: 's1', campus_location_id: 'l2', latitude: 10.9845, longitude: 39.2625, is_sos: true, type: 'sos', status: 'open', severity: 3, responses: [] }
];

const campusValidationLocations = [
  { location_id: 'university', name: 'Mekdela Amba University', latitude: 10.9854535, longitude: 39.2631819, is_active: true },
  { location_id: 'library', name: 'Library', latitude: 10.9855, longitude: 39.2632, type: 'library', is_active: true },
  { location_id: 'inactive', name: 'Inactive Location', latitude: 10.986, longitude: 39.264, is_active: false },
];

const sampleOfficers = [
  { user_id: 'o1', name: 'Officer One', latitude: 10.9858, longitude: 39.2636, availability_status: 'available' },
  { user_id: 'o2', name: 'Officer Two', latitude: 10.9849, longitude: 39.2630, availability_status: 'responding' }
];
const sampleZones = [{
  zone_id: 'zone-1',
  name: 'Library Area',
  description: 'Library security zone',
  coordinates: {
    type: 'Polygon',
    coordinates: [[
      [39.262, 10.984],
      [39.264, 10.984],
      [39.264, 10.986],
      [39.262, 10.984],
    ]],
  },
  center_lat: 10.985,
  center_lng: 39.263,
  radius: 250,
  is_active: true,
}];

function DeletableZoneMap({ onDeleteZone, ...props }) {
  const [zones, setZones] = useState(sampleZones);
  return <SecurityMap
    {...props}
    zones={zones}
    canManageZones
    onDeleteZone={async (zone) => {
      await onDeleteZone(zone);
      setZones((current) => current.filter((item) => item.zone_id !== zone.zone_id));
    }}
  />;
}

describe('SecurityMap Phase 1 features', () => {
  beforeEach(() => {
    // clear window trackers
    if (typeof window !== 'undefined') {
      window._map_last_setView = undefined;
      window._map_last_setViewRequested = undefined;
      window._map_last_fitBounds = undefined;
    }
  });

  test('normal mode renders a visible map, search, filters, legend, and map controls', () => {
    const { container } = render(
      <SecurityMap incidents={sampleIncidents} officers={sampleOfficers} zones={sampleZones} campusLocations={sampleCampus} />,
    );
    const mapWrapper = container.querySelector('.campus-map-fullscreen-container');
    const mapRegion = screen.getByRole('region', { name: 'Live campus map' });
    const leafletMap = mapRegion.querySelector('.leaflet-container');

    expect(mapWrapper).toBeInTheDocument();
    expect(mapWrapper).toHaveStyle({
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: 'clamp(24rem, 65vh, 48rem)',
      minHeight: '24rem',
    });
    expect(mapRegion).toBeVisible();
    expect(leafletMap).toBeInTheDocument();
    expect(leafletMap).toBeVisible();
    expect(screen.getByPlaceholderText('Library, gate, block...')).toBeVisible();
    expect(screen.getByLabelText('Severity')).toBeVisible();
    expect(screen.getByLabelText('Campus places')).toBeVisible();
    expect(screen.getByLabelText('Officer availability')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Map Controls' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Map Style' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Satellite' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Standard' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fit Campus' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open fullscreen map' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Map legend' })).toBeVisible();
  });

  test('Layer toggles hide/show the correct marker groups', async () => {
    render(<SecurityMap incidents={sampleIncidents} officers={sampleOfficers} zones={[]} campusLocations={sampleCampus} />);

    // markers initially present
    expect(screen.getByTestId('marker-incident-i1')).toBeInTheDocument();
    expect(screen.getByTestId('marker-incident-s1')).toBeInTheDocument();
    expect(screen.getByTestId('marker-officer-o1')).toBeInTheDocument();
    expect(screen.getByTestId('marker-officer-o2')).toBeInTheDocument();
    expect(screen.getByTestId('marker-place-l1')).toBeInTheDocument();

    // toggle incidents off
    const incidentsToggle = screen.getByLabelText('Incidents');
    fireEvent.click(incidentsToggle);

    // incident non-SOS should be hidden
    await waitFor(() => expect(screen.queryByTestId('marker-incident-i1')).not.toBeInTheDocument());

    // SOS still present because SOS layer still on
    expect(screen.getByTestId('marker-incident-s1')).toBeInTheDocument();

    // toggle SOS off
    const sosToggle = screen.getByLabelText('SOS');
    fireEvent.click(sosToggle);

    await waitFor(() => expect(screen.queryByTestId('marker-incident-s1')).not.toBeInTheDocument());
  });

  test('Incident filters work', async () => {
    render(<SecurityMap incidents={sampleIncidents} officers={[]} zones={[]} campusLocations={sampleCampus} />);

    // severity filter to 3 should hide severity 2 incident
    const severitySelect = screen.getByLabelText('Severity');
    fireEvent.change(severitySelect, { target: { value: '3' } });

    await waitFor(() => expect(screen.queryByTestId('marker-incident-i1')).not.toBeInTheDocument());
    // SOS with severity 3 should still be present
    expect(screen.getByTestId('marker-incident-s1')).toBeInTheDocument();

    // SOS-only filter on should hide non-sos incidents
    const sosOnly = screen.getByLabelText('SOS only');
    fireEvent.click(sosOnly);

    await waitFor(() => expect(screen.queryByTestId('marker-incident-i1')).not.toBeInTheDocument());
  });

  test.each([
    ['valid campus_location_id', { incident_id: 'valid-id', campus_location_id: 'library', latitude: 10.9, longitude: 39.2 }],
    ['valid nested campus location id', { incident_id: 'valid-nested-id', campus_location: { location_id: 'library' }, latitude: 10.9, longitude: 39.2 }],
    ['null campus location', { incident_id: 'null-location', campus_location_id: null, latitude: 10.9855, longitude: 39.2632 }],
    ['Unknown Location', { incident_id: 'unknown-location', location_name: 'Unknown Location', latitude: 10.9855, longitude: 39.2632 }],
    ['Unknown', { incident_id: 'unknown-title', location_name: 'Unknown', latitude: 10.9855, longitude: 39.2632 }],
    ['Unmatched location', { incident_id: 'unmatched-location', location_name: 'Unmatched', latitude: 10.9855, longitude: 39.2632 }],
    ['lowercase unknown', { incident_id: 'lowercase-unknown', location_name: 'unknown', latitude: 10.9855, longitude: 39.2632 }],
    ['lowercase unmatched', { incident_id: 'lowercase-unmatched', location_name: 'unmatched', latitude: 10.9855, longitude: 39.2632 }],
    ['GPS-only incident', { incident_id: 'gps-only', latitude: 10.9855, longitude: 39.2632 }],
    ['Current device location without validation', { incident_id: 'device-only', location_name: 'Current device location', latitude: 10.9855, longitude: 39.2632 }],
    ['Library location', { incident_id: 'library-location', campus_location_id: 'library', latitude: 10.9855, longitude: 39.2632 }],
  ])('handles %s incident validation', async (label, incident) => {
    render(<SecurityMap incidents={[incident]} officers={[]} zones={[]} campusLocations={campusValidationLocations} />);

    if (label === 'valid campus_location_id' || label === 'valid nested campus location id' || label === 'Library location') {
      expect(await screen.findByTestId(`marker-incident-${incident.incident_id}`)).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId(`marker-incident-${incident.incident_id}`)).not.toBeInTheDocument();
    }
  });

  test('uses the validated campus location for Current device location incidents', async () => {
    const incident = {
      incident_id: 'device-with-campus-location',
      campus_location_id: 'library',
      location_name: 'Current device location',
      latitude: null,
      longitude: null,
    };

    render(<SecurityMap incidents={[incident]} officers={[]} zones={[]} campusLocations={campusValidationLocations} />);

    expect(await screen.findByTestId('marker-incident-device-with-campus-location')).toBeInTheDocument();
  });

  test('hides unknown campus location names from place markers and search text', () => {
    const unknownLocations = ['Unknown Location', 'Unknown', 'Unmatched', 'unknown', 'unmatched'].map((name, index) => ({
      location_id: `hidden-${index}`,
      name,
      latitude: 10.9855 + index / 10000,
      longitude: 39.2632,
      is_active: true,
    }));

    render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={unknownLocations} />);

    unknownLocations.forEach((location) => {
      expect(screen.queryByTestId(`marker-place-${location.location_id}`)).not.toBeInTheDocument();
      expect(screen.queryByText(location.name, { exact: true })).not.toBeInTheDocument();
    });
  });

  test('hides excluded campus locations and incidents while keeping allowed locations visible', async () => {
    const locations = [
      { location_id: 'fenta', name: '    ', latitude: 10.985, longitude: 39.263, is_active: true },
      { location_id: 'mau-admin', name:  ', latitude: 10.986, longitude: 39.264, is_active: true },
      { location_id: 'admin-building', name: ' ADMINISTRATION BUILDING ', latitude: 10.987, longitude: 39.265, is_active: true },
      { location_id: 'administration', name: 'Administration', latitude: 10.988, longitude: 39.266, is_active: true },
      { location_id: 'library', name: 'Library', latitude: 10.989, longitude: 39.267, is_active: true },
      { location_id: 'university', name: 'Mekdela Amba University', latitude: 10.990, longitude: 39.268, is_active: true },
    ];
    const excludedIncident = { incident_id: 'excluded-incident', campus_location_id: 'fenta', type: 'theft', status: 'open' };

    render(<SecurityMap incidents={[excludedIncident]} officers={[]} zones={[]} campusLocations={locations} />);

    expect(screen.queryByTestId('marker-place-fenta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marker-place-mau-admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marker-place-admin-building')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marker-incident-excluded-incident')).not.toBeInTheDocument();
    expect(screen.getByTestId('marker-place-administration')).toBeInTheDocument();
    expect(screen.getByTestId('marker-place-library')).toBeInTheDocument();
    expect(screen.getByTestId('marker-place-university')).toBeInTheDocument();

    const search = screen.getByPlaceholderText('Library, gate, block...');
    fireEvent.change(search, { target: { value: 'administration' } });
    expect(screen.queryByTestId('search-result-fenta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-result-mau-admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-result-admin-building')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-result-administration')).toBeInTheDocument();
  });

  test('focuses and opens the popup for the selected incident despite existing filters', async () => {
    const selectedIncident = {
      incident_id: 'focused-1',
      campus_location_id: 'l1',
      latitude: 10.9856,
      longitude: 39.2633,
      type: 'theft',
      status: 'closed',
      severity: 2,
      responses: [],
    };
    render(<SecurityMap incidents={[selectedIncident]} officers={[]} zones={[]} campusLocations={sampleCampus} focusedIncidentId="focused-1" />);

    expect(screen.getByTestId('marker-incident-focused-1')).toBeInTheDocument();
    await waitFor(() => {
      expect(window._map_last_setView.pos[0]).toBeCloseTo(10.9855, 4);
      expect(window._map_last_setView.pos[1]).toBeCloseTo(39.2632, 4);
    });
    expect(document.querySelector('.leaflet-popup-content')).toHaveTextContent('Type: theft');
  });

  test('Officer availability filter works', async () => {
    render(<SecurityMap incidents={[]} officers={sampleOfficers} zones={[]} campusLocations={[]} />);

    // set filter to available
    const availability = screen.getByLabelText('Officer availability');
    fireEvent.change(availability, { target: { value: 'available' } });

    await waitFor(() => expect(screen.getByTestId('marker-officer-o1')).toBeInTheDocument());
    expect(screen.queryByTestId('marker-officer-o2')).not.toBeInTheDocument();
  });

  test('admin can select and highlight a zone on the map and see its details', () => {
    const onMapClick = vi.fn();
    render(<SecurityMap zones={sampleZones} canManageZones selectedLocationId="l1" onMapClick={onMapClick} />);

    fireEvent.click(screen.getByTestId('marker-zone-zone-1'));

    expect(screen.getByTestId('selected-zone-details')).toHaveTextContent('Library Area');
    expect(screen.getByTestId('selected-zone-details')).toHaveTextContent('Library security zone');
    expect(screen.getByTestId('marker-zone-zone-1')).toHaveAttribute('style', expect.stringContaining('background:#dc2626'));
    expect(screen.getByRole('button', { name: 'Remove Zone' })).toBeInTheDocument();
    expect(onMapClick).not.toHaveBeenCalled();
  });

  test('security officers can select zones but do not see the remove action', () => {
    render(<SecurityMap zones={sampleZones} />);

    fireEvent.click(screen.getByTestId('marker-zone-zone-1'));

    expect(screen.getByTestId('selected-zone-details')).toHaveTextContent('Library Area');
    expect(screen.queryByRole('button', { name: 'Remove Zone' })).not.toBeInTheDocument();
  });

  test('does not display synthetic zones derived from campus location categories', () => {
    render(<SecurityMap zones={[]} campusLocations={sampleCampus} />);

    expect(screen.queryByTestId('marker-zone-group-student-services')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marker-zone-group-other')).not.toBeInTheDocument();
  });

  test('requires confirmation and removes a zone immediately after successful deletion', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteZone = vi.fn().mockResolvedValue(undefined);
    render(
      <DeletableZoneMap
        onDeleteZone={deleteZone}
        incidents={sampleIncidents}
        officers={sampleOfficers}
        campusLocations={sampleCampus}
      />,
    );

    fireEvent.click(screen.getByTestId('marker-zone-zone-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Zone' }));

    await waitFor(() => expect(deleteZone).toHaveBeenCalledWith(expect.objectContaining({
      zone_id: 'zone-1',
      name: 'Library Area',
    })));
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete this zone?');
    await waitFor(() => expect(screen.queryByTestId('marker-zone-zone-1')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Zone deleted successfully.');
    expect(screen.getByTestId('marker-incident-i1')).toBeInTheDocument();
    expect(screen.getByTestId('marker-incident-s1')).toBeInTheDocument();
    expect(screen.getByTestId('marker-officer-o1')).toBeInTheDocument();
    expect(screen.getByTestId('marker-place-l1')).toBeInTheDocument();

    confirm.mockRestore();
  });

  test('cancelling confirmation does not request deletion', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteZone = vi.fn();
    render(<DeletableZoneMap onDeleteZone={deleteZone} />);

    fireEvent.click(screen.getByTestId('marker-zone-zone-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Zone' }));

    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete this zone?');
    expect(deleteZone).not.toHaveBeenCalled();
    expect(screen.getByTestId('marker-zone-zone-1')).toBeInTheDocument();
    confirm.mockRestore();
  });

  test('failed deletion reports the error and keeps the zone visible', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteZone = vi.fn().mockRejectedValue({
      response: { data: { message: 'Reassign campus locations first.' } },
    });
    render(<DeletableZoneMap onDeleteZone={deleteZone} />);

    fireEvent.click(screen.getByTestId('marker-zone-zone-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Zone' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reassign campus locations first.');
    expect(screen.getByTestId('marker-zone-zone-1')).toBeInTheDocument();
    confirm.mockRestore();
  });

  test('clicking incident, officer, or campus markers does not select a zone', () => {
    render(
      <SecurityMap
        zones={sampleZones}
        incidents={sampleIncidents}
        officers={sampleOfficers}
        campusLocations={sampleCampus}
        selectedLocationId="l1"
        onMapClick={vi.fn()}
        canManageZones
      />,
    );

    fireEvent.click(screen.getByTestId('marker-incident-i1'));
    fireEvent.click(screen.getByTestId('marker-officer-o1'));
    fireEvent.click(screen.getByTestId('marker-place-l1'));

    expect(screen.queryByTestId('selected-zone-details')).not.toBeInTheDocument();
  });

  test('Search results can be selected', async () => {
    render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={sampleCampus} />);

    const input = screen.getByPlaceholderText('Library, gate, block...');
    fireEvent.change(input, { target: { value: 'Library' } });

    // search result should appear
    const result = await screen.findByTestId('search-result-l1');
    expect(result).toBeInTheDocument();

    fireEvent.click(result);

    // map.setView should have been called (mock records in window) or at least requested
    await waitFor(() => {
      if (window._map_last_setView) {
        expect(window._map_last_setView).toBeDefined();
        expect(window._map_last_setView.pos[0]).toBeCloseTo(10.9855, 3);
      } else {
        expect(window._map_last_setViewRequested).toBeDefined();
        expect(window._map_last_setViewRequested[0]).toBeCloseTo(10.9855, 3);
      }
    });
  });

  test('campus place markers have no P symbol and reveal the location name on hover', async () => {
    render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={sampleCampus} />);

    const marker = screen.getByTestId('marker-place-l1');
    expect(marker.textContent).toBe('');
    expect(marker).not.toHaveTextContent('P');

    const leafletMarker = marker.closest('.leaflet-marker-icon');
    fireEvent.mouseOver(leafletMarker);
    expect(await screen.findByRole('tooltip', { name: 'Main Library' })).toBeInTheDocument();

    fireEvent.mouseOut(leafletMarker);
    await waitFor(() => expect(screen.queryByRole('tooltip', { name: 'Main Library' })).not.toBeInTheDocument());
  });

  test('map controls are separated from the map and map-style selection remains available', () => {
    render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={sampleCampus} />);
    const mapControls = screen.getByRole('region', { name: 'Map Controls' });
    const mapStyle = screen.getByRole('region', { name: 'Map Style' });
    const map = screen.getByRole('region', { name: 'Live campus map' });
    expect(screen.getByRole('button', { name: 'Fit Campus' })).toBeInTheDocument();
    expect(mapControls).not.toContainElement(map);
    expect(mapStyle).not.toContainElement(map);
    expect(mapControls).not.toContainElement(mapStyle);

    const satellite = screen.getByRole('button', { name: 'Satellite' });
    const standard = screen.getByRole('button', { name: 'Standard' });
    expect(standard).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(satellite);
    expect(satellite).toHaveAttribute('aria-pressed', 'true');
    expect(standard).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(standard);
    expect(standard).toHaveAttribute('aria-pressed', 'true');
  });

  test('fullscreen button is available in normal mode', () => {
    render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={[]} />);

    expect(screen.getByRole('button', { name: 'Open fullscreen map' })).toHaveTextContent('Fullscreen');
  });

  test('fullscreen requests the map-only wrapper', async () => {
    const requestFullscreenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
    let requestedElement;
    const requestFullscreen = vi.fn(function () {
      requestedElement = this;
      return Promise.resolve();
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });

    try {
      const { container } = render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={[]} />);
      const mapOnlyWrapper = container.querySelector('.campus-map-fullscreen-container');
      const mapControls = mapOnlyWrapper.querySelector('.campus-map-map-controls');
      const mapContainer = mapOnlyWrapper.querySelector('.campus-map-container');
      const searchAndFilters = container.querySelector('.campus-map-toolbar');
      const legend = container.querySelector('.campus-map-legend');

      expect(mapOnlyWrapper).toContainElement(mapContainer.querySelector('.leaflet-container'));
      expect(mapOnlyWrapper).toContainElement(mapControls);
      expect(Array.from(mapOnlyWrapper.children)).toEqual([mapControls, mapContainer]);
      expect(searchAndFilters).toBeInTheDocument();
      expect(searchAndFilters).not.toHaveAttribute('hidden');
      expect(mapOnlyWrapper).not.toContainElement(searchAndFilters);
      expect(legend).toBeInTheDocument();
      expect(legend).not.toHaveAttribute('hidden');
      expect(mapOnlyWrapper).not.toContainElement(legend);
      fireEvent.click(screen.getByRole('button', { name: 'Open fullscreen map' }));

      await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
      expect(requestedElement).toBe(mapOnlyWrapper);
      await waitFor(() => expect(searchAndFilters).toHaveAttribute('hidden'));
      expect(legend).toHaveAttribute('hidden');
    } finally {
      if (requestFullscreenDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', requestFullscreenDescriptor);
      } else {
        delete HTMLElement.prototype.requestFullscreen;
      }
    }
  });

  test('fullscreenchange tracks browser entry and exit and restores normal controls', async () => {
    const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');

    try {
      const { container } = render(<SecurityMap incidents={[]} officers={[]} zones={sampleZones} campusLocations={[]} />);
      const mapOnlyWrapper = container.querySelector('.campus-map-fullscreen-container');
      const searchAndFilters = container.querySelector('.campus-map-toolbar');
      const legend = container.querySelector('.campus-map-legend');
      const mapControls = mapOnlyWrapper.querySelector('.campus-map-map-controls');
      fireEvent.click(screen.getByTestId('marker-zone-zone-1'));
      expect(screen.getByTestId('selected-zone-details')).toBeVisible();
      const changeFullscreenElement = (element) => {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element });
        document.dispatchEvent(new Event('fullscreenchange'));
      };

      changeFullscreenElement(mapOnlyWrapper);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Exit fullscreen map' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.getByRole('button', { name: 'Exit fullscreen map' })).toHaveTextContent('Exit Fullscreen');
      expect(mapControls).toBeVisible();
      expect(mapOnlyWrapper).toContainElement(screen.getByRole('button', { name: 'Satellite' }));
      expect(mapOnlyWrapper).toContainElement(screen.getByRole('button', { name: 'Standard' }));
      expect(mapOnlyWrapper).toContainElement(screen.getByRole('button', { name: 'Fit Campus' }));
      expect(mapOnlyWrapper).toContainElement(screen.getByRole('button', { name: 'Exit fullscreen map' }));
      expect(searchAndFilters).toHaveAttribute('hidden');
      expect(container.querySelector('.campus-map-controls')).toHaveAttribute('hidden');
      expect(screen.getByTestId('selected-zone-details')).not.toBeVisible();
      expect(legend).toHaveAttribute('hidden');

      fireEvent.click(screen.getByRole('button', { name: 'Satellite' }));
      expect(screen.getByRole('button', { name: 'Satellite' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Standard' }));
      expect(screen.getByRole('button', { name: 'Standard' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Fit Campus' }));

      changeFullscreenElement(null);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Open fullscreen map' })).toHaveAttribute('aria-pressed', 'false'));
      expect(searchAndFilters).not.toHaveAttribute('hidden');
      expect(legend).not.toHaveAttribute('hidden');
      expect(screen.getByPlaceholderText('Library, gate, block...')).toBeInTheDocument();
      expect(screen.getByLabelText('Severity')).toBeInTheDocument();
      expect(screen.getByTestId('selected-zone-details')).toBeVisible();
    } finally {
      if (fullscreenElementDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', fullscreenElementDescriptor);
      } else {
        delete document.fullscreenElement;
      }
    }
  });

  test('Exit Fullscreen calls document.exitFullscreen', async () => {
    const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const exitFullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');

    try {
      const { container } = render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={[]} />);
      const mapOnlyWrapper = container.querySelector('.campus-map-fullscreen-container');
      const changeFullscreenElement = (element) => {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element });
        document.dispatchEvent(new Event('fullscreenchange'));
      };
      const exitFullscreen = vi.fn(() => {
        changeFullscreenElement(null);
        return Promise.resolve();
      });
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });

      changeFullscreenElement(mapOnlyWrapper);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Exit fullscreen map' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen map' }));

      await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1));
      expect(screen.getByPlaceholderText('Library, gate, block...')).toBeInTheDocument();
      expect(container.querySelector('.campus-map-toolbar')).not.toHaveAttribute('hidden');
      expect(container.querySelector('.campus-map-legend')).not.toHaveAttribute('hidden');
    } finally {
      if (fullscreenElementDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', fullscreenElementDescriptor);
      } else {
        delete document.fullscreenElement;
      }
      if (exitFullscreenDescriptor) {
        Object.defineProperty(document, 'exitFullscreen', exitFullscreenDescriptor);
      } else {
        delete document.exitFullscreen;
      }
    }
  });

  test('fullscreen control uses the viewport fallback and can exit it', async () => {
    const requestFullscreenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });

    try {
      const { container } = render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={[]} />);
      const fullscreenButton = screen.getByRole('button', { name: 'Open fullscreen map' });
      const experience = container.querySelector('.campus-map-experience');
      const searchAndFilters = container.querySelector('.campus-map-toolbar');
      const legend = container.querySelector('.campus-map-legend');

      expect(searchAndFilters).not.toHaveAttribute('hidden');
      expect(legend).not.toHaveAttribute('hidden');
      fireEvent.click(fullscreenButton);
      await waitFor(() => expect(experience).toHaveClass('is-fullscreen-fallback'));
      expect(screen.getByRole('button', { name: 'Exit fullscreen map' })).toHaveAttribute('aria-pressed', 'true');
      expect(searchAndFilters).toHaveAttribute('hidden');
      expect(legend).toHaveAttribute('hidden');
      expect(screen.getByRole('button', { name: 'Fit Campus' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Satellite' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen map' }));
      await waitFor(() => expect(experience).not.toHaveClass('is-fullscreen-fallback'));
      expect(screen.getByRole('button', { name: 'Open fullscreen map' })).toHaveAttribute('aria-pressed', 'false');
      expect(searchAndFilters).not.toHaveAttribute('hidden');
      expect(legend).not.toHaveAttribute('hidden');
    } finally {
      if (requestFullscreenDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', requestFullscreenDescriptor);
      } else {
        delete HTMLElement.prototype.requestFullscreen;
      }
    }
  });
});
