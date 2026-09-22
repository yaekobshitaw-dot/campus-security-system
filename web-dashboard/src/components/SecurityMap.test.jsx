import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// setupTests.js ensures jsdom and basic globals are present; let real Leaflet/react-leaflet load under jsdom

import SecurityMap from './SecurityMap';

const sampleCampus = [
  { location_id: 'l1', name: 'Main Library', latitude: 10.9855, longitude: 39.2632, type: 'library' },
  { location_id: 'l2', name: 'Main Gate', latitude: 10.9860, longitude: 39.2638, type: 'gate' }
];

const sampleIncidents = [
  { incident_id: 'i1', latitude: 10.9856, longitude: 39.2633, is_sos: false, type: 'theft', status: 'open', severity: 2, responses: [] },
  { incident_id: 's1', latitude: 10.9845, longitude: 39.2625, is_sos: true, type: 'sos', status: 'open', severity: 3, responses: [] }
];

const sampleOfficers = [
  { user_id: 'o1', name: 'Officer One', latitude: 10.9858, longitude: 39.2636, availability_status: 'available' },
  { user_id: 'o2', name: 'Officer Two', latitude: 10.9849, longitude: 39.2630, availability_status: 'responding' }
];

describe('SecurityMap Phase 1 features', () => {
  beforeEach(() => {
    // clear window trackers
    if (typeof window !== 'undefined') {
      window._map_last_setView = undefined;
      window._map_last_fitBounds = undefined;
    }
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
    render(<SecurityMap incidents={sampleIncidents} officers={[]} zones={[]} campusLocations={[]} />);

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

  test('Officer availability filter works', async () => {
    render(<SecurityMap incidents={[]} officers={sampleOfficers} zones={[]} campusLocations={[]} />);

    // set filter to available
    const availability = screen.getByLabelText('Officer availability');
    fireEvent.change(availability, { target: { value: 'available' } });

    await waitFor(() => expect(screen.getByTestId('marker-officer-o1')).toBeInTheDocument());
    expect(screen.queryByTestId('marker-officer-o2')).not.toBeInTheDocument();
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

  test('Fit Campus control remains available', () => {
    render(<SecurityMap incidents={[]} officers={[]} zones={[]} campusLocations={sampleCampus} />);
    expect(screen.getByText('Fit campus')).toBeInTheDocument();
  });
});
