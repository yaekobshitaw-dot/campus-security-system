// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MLDashboard from './MLDashboard';
import mlService from '../services/mlService';

vi.mock('../services/mlService', () => ({
  default: {
    health: vi.fn(),
    detectHotzones: vi.fn(),
    predictRisk: vi.fn(),
  },
}));

describe('MLDashboard', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mlService.health.mockResolvedValue({ status: 'healthy' });
    mlService.detectHotzones.mockResolvedValue({ hotzones: [] });
    mlService.predictRisk.mockResolvedValue(null);
  });

  it('does not display hotzones without a matching location identifier', async () => {
    mlService.detectHotzones.mockResolvedValue({
      hotzones: [
        { location: 'Science Block 3', risk_score: 0.85, incident_count: 12, incident_types: ['fire'] },
        { location: 'Main Parking Lot', risk_score: 0.75, incident_count: 8, incident_types: ['theft'] },
        { location: 'Library', risk_score: 0.45, incident_count: 5, incident_types: ['medical'] },
      ],
    });
    render(<MLDashboard
      campusLocations={[{ location_id: 'location-1', name: 'Administration' }]}
      incidents={[{ incident_id: 'incident-1', location_name: 'Administration', type: 'theft' }]}
    />);

    expect(await screen.findByText('The ML service returned no validated high-risk areas for these records.')).toBeInTheDocument();
    expect(screen.queryByText(/Science Block|Main Parking Lot|Library/)).not.toBeInTheDocument();
    expect(screen.queryByText('12 incidents')).not.toBeInTheDocument();
  });

  it('uses campus and incident records for a verified location risk entry', async () => {
    mlService.detectHotzones.mockResolvedValue({
      hotzones: [{
        location_id: 'location-1',
        location: 'Untrusted response label',
        risk_score: 0.7,
        incident_count: 99,
        incident_types: ['fake'],
      }],
    });
    const campusLocations = [{ location_id: 'location-1', name: 'Administration' }];
    const incidents = [
      { incident_id: 'incident-1', location_name: ' administration ', type: 'theft' },
      { incident_id: 'incident-2', building: 'Administration', type: 'medical' },
    ];
    render(<MLDashboard campusLocations={campusLocations} incidents={incidents} />);

    expect(await screen.findByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.tagName === 'SPAN' && element?.textContent?.includes('2') && element?.textContent?.includes('incidents')).length).toBeGreaterThan(0);
    expect(screen.getByText((_, element) => element?.tagName === 'SPAN' && element?.textContent?.includes('theft, medical'))).toBeInTheDocument();
    expect(screen.queryByText('99 incidents')).not.toBeInTheDocument();
    expect(screen.queryByText('fake')).not.toBeInTheDocument();
    await waitFor(() => expect(mlService.detectHotzones).toHaveBeenCalledWith(
      [{ location_id: 'location-1', name: 'Administration', is_active: undefined }],
      [
        { incident_id: 'incident-1', campus_location_id: undefined, location_name: ' administration ', building: undefined, type: 'theft' },
        { incident_id: 'incident-2', campus_location_id: undefined, location_name: undefined, building: 'Administration', type: 'medical' },
      ]
    ));
  });

  it('sends GPS-matched campus locations to hotzone processing', async () => {
    mlService.detectHotzones.mockResolvedValue({
      hotzones: [{
        location_id: 'location-1',
        location: 'Administration',
        risk_score: 0.9,
      }],
    });
    const campusLocations = [{ location_id: 'location-1', name: 'Administration', is_active: true }];
    const incidents = [{
      incident_id: 'gps-incident',
      campus_location_id: 'location-1',
      campus_location: { location_id: 'location-1', name: 'Administration' },
      location_name: 'Current device location',
      latitude: 10.9854,
      longitude: 39.2631,
      type: 'security_threat',
    }];

    render(<MLDashboard campusLocations={campusLocations} incidents={incidents} />);

    expect(await screen.findByText('Administration')).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.tagName === 'SPAN' && element?.textContent?.includes('1') && element?.textContent?.includes('incidents')).length).toBeGreaterThan(0);
    await waitFor(() => expect(mlService.detectHotzones).toHaveBeenCalledWith(
      [{ location_id: 'location-1', name: 'Administration', is_active: true }],
      [{
        incident_id: 'gps-incident',
        campus_location_id: 'location-1',
        location_name: 'Administration',
        building: undefined,
        type: 'security_threat',
      }]
    ));
  });

  it('does not infer a campus name for unmatched GPS incidents or invalid campus IDs', async () => {
    const campusLocations = [{ location_id: 'active-location', name: 'Administration', is_active: true }];
    render(<MLDashboard
      campusLocations={campusLocations}
      incidents={[
        {
          incident_id: 'unmatched-gps',
          campus_location_id: null,
          location_name: 'Current device location',
          latitude: 10.9,
          longitude: 39.2,
          type: 'medical',
        },
        {
          incident_id: 'unknown-match',
          campus_location_id: 'not-a-campus-location',
          location_name: 'Current device location',
          latitude: 10.9,
          longitude: 39.2,
          type: 'theft',
        },
      ]}
    />);

    await waitFor(() => expect(mlService.detectHotzones).toHaveBeenCalledWith(
      [{ location_id: 'active-location', name: 'Administration', is_active: true }],
      [
        {
          incident_id: 'unmatched-gps',
          campus_location_id: undefined,
          location_name: 'Current device location',
          building: undefined,
          type: 'medical',
        },
        {
          incident_id: 'unknown-match',
          campus_location_id: undefined,
          location_name: 'Current device location',
          building: undefined,
          type: 'theft',
        },
      ]
    ));
  });

  it('labels validated campus matches and GPS-only unmatched incidents distinctly', async () => {
    mlService.predictRisk.mockResolvedValue({
      risk_level: 'high',
      confidence: 0.8,
      estimated_response_time: 5,
    });
    const campusLocations = [{ location_id: 'location-1', name: 'Administration', is_active: true }];

    render(<MLDashboard
      campusLocations={campusLocations}
      incidents={[
        {
          incident_id: 'matched-gps',
          campus_location_id: 'location-1',
          campus_location: { location_id: 'location-1', name: 'Administration' },
          latitude: 10.984911,
          longitude: 39.262305,
          location_name: 'Current device location',
          type: 'security_threat',
        },
        {
          incident_id: 'unmatched-gps',
          latitude: 10.99,
          longitude: 39.27,
          location_name: 'Current device location',
          type: 'medical',
        },
      ]}
    />);

    expect(await screen.findByText('Validated campus location: Administration')).toBeInTheDocument();
    expect(screen.getByText('Reported text: Current device location')).toBeInTheDocument();
    expect(screen.getByText('GPS-only / unmatched location: Current device location')).toBeInTheDocument();
    expect(screen.queryByText('Location: Current device location')).not.toBeInTheDocument();
  });

  it('explains a genuine empty hotzones response', async () => {
    mlService.detectHotzones.mockResolvedValue({ hotzones: [] });
    render(<MLDashboard
      campusLocations={[{ location_id: 'location-1', name: 'Administration' }]}
      incidents={[{ incident_id: 'incident-1', location_name: 'Administration', type: 'theft' }]}
    />);

    expect(await screen.findByText('The ML service returned no validated high-risk areas for these records.')).toBeInTheDocument();
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
  });

  it('deduplicates repeated prediction records by stable incident ID', async () => {
    mlService.predictRisk.mockResolvedValue({
      risk_level: 'critical',
      confidence: 0.63,
      estimated_response_time: 2,
      suggested_action: 'Immediate emergency response',
    });
    const incident = {
      incident_id: 'incident-duplicate',
      type: 'security_threat',
      severity: 'critical',
      location_name: 'Main Gate',
    };
    render(<MLDashboard incidents={[incident, { ...incident }]} />);

    expect(await screen.findByText('Incident: incident-duplicate')).toBeInTheDocument();
    expect(screen.getAllByText('SECURITY_THREAT')).toHaveLength(1);
    expect(mlService.predictRisk).toHaveBeenCalledTimes(1);
  });

  it('keeps different incidents with the same type and displays their source details', async () => {
    mlService.predictRisk
      .mockResolvedValueOnce({
        risk_level: 'critical',
        confidence: 0.63,
        estimated_response_time: 2,
        suggested_action: 'Immediate emergency response',
      })
      .mockResolvedValueOnce({
        risk_level: 'critical',
        confidence: 0.83,
        estimated_response_time: 2,
        suggested_action: 'Dispatch campus security',
      });
    render(<MLDashboard incidents={[
      {
        incident_id: 'incident-a',
        type: 'security_threat',
        description: 'Threat near the library',
        severity: 'critical',
        location_name: 'Library',
        created_at: '2026-09-20T10:15:00.000Z',
      },
      {
        incident_id: 'incident-b',
        type: 'security_threat',
        description: 'Threat near the north gate',
        severity: 'critical',
        building: 'North Gate',
        created_at: '2026-09-21T11:30:00.000Z',
        is_sos: true,
      },
    ]} />);

    expect(await screen.findByText('Incident: incident-a')).toBeInTheDocument();
    expect(screen.getByText('Incident: incident-b')).toBeInTheDocument();
    expect(screen.getAllByText('SECURITY_THREAT')).toHaveLength(2);
    expect(screen.getByText('Reported location: Library')).toBeInTheDocument();
    expect(screen.getByText('Reported location: North Gate')).toBeInTheDocument();
    expect(screen.getAllByText(/^Reported:/)).toHaveLength(2);
    expect(screen.getByText((content) => content.includes('63') && content.includes('%'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('83') && content.includes('%'))).toBeInTheDocument();
    expect(screen.getAllByText(/Critical/)).toHaveLength(2);
    const predictionType = screen.getAllByText('SECURITY_THREAT')[1];
    const sosBadge = screen.getByText(/SOS/);
    expect(predictionType.parentElement).not.toBe(sosBadge.parentElement);
    expect(sosBadge.parentElement).toBe(screen.getAllByText(/Critical/)[1].parentElement);
    expect(sosBadge.parentElement).toHaveStyle({ display: 'grid', rowGap: '8px' });
    expect(screen.getByText('Incident: incident-a').parentElement).toHaveStyle({ display: 'grid' });
    expect(screen.getByText(/Confidence: 63%/).parentElement).toHaveStyle({ display: 'grid' });
    expect(screen.getByText('Threat near the library')).toBeInTheDocument();
  });

  it('shows offline status and a safe empty prediction state when the ML service is unavailable', async () => {
    mlService.health.mockResolvedValue(null);
    mlService.detectHotzones.mockResolvedValue(null);
    mlService.predictRisk.mockResolvedValue(null);
    render(<MLDashboard incidents={[{
      incident_id: 'incident-offline',
      type: 'medical',
      severity: 'high',
    }]} />);

    expect(await screen.findByText(/Offline/)).toBeInTheDocument();
    expect(screen.getByText('No predictions available')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument();
  });

  it('omits malformed prediction fields instead of displaying raw null or undefined', async () => {
    mlService.predictRisk.mockResolvedValue({
      risk_level: null,
      confidence: undefined,
      estimated_response_time: null,
      suggested_action: null,
    });
    render(<MLDashboard incidents={[{
      incident_id: 'incident-partial',
      type: 'medical',
      description: null,
      location_name: null,
      building: null,
      created_at: null,
    }]} />);

    expect(await screen.findByText('Incident: incident-partial')).toBeInTheDocument();
    expect(screen.getByText('Risk unavailable')).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument();
  });
});





