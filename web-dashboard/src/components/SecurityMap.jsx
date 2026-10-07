import 'leaflet/dist/leaflet.css';
import './SecurityMap.css';
import L from 'leaflet';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { UserAvatar } from './DashboardLayout';

const CAMPUS_CENTER = [10.9854535, 39.2631819];
const locationTypes = ['all', 'university', 'administration', 'classroom', 'seminar', 'building/block', 'gate', 'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking', 'sports', 'emergency_point', 'other'];
const locationTypeLabels = {
  cafeteria: 'Cafeteria', clinic: 'Health / clinic', gate: 'Main gate', security_post: 'Security post',
  parking: 'Parking', sports: 'Sports / recreation', emergency_point: 'Emergency point', other: 'Campus place'
};
const hiddenLocationNames = new Set([
  'unknown location',
  'unknown',
  'unmatched',
  'fenta abnew',
  'mau administration bd',
  'administration building',
]);
const normalizeLocationName = (name) => String(name || '').trim().toLowerCase();
const hasVisibleLocationName = (location) => !hiddenLocationNames.has(normalizeLocationName(location?.name));
// Test environment detection (Vite / Vitest friendly). Use to enable test-only instrumentation.
const IS_TEST = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test') || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test');

// Use real Leaflet divIcon when available so markers open popups and remain interactive in the browser.
// Keep a jsdom-friendly fallback for tests when Leaflet is not fully initialized.
const markerIcon = (background, symbol, testId) => {
  const markerColor = background || '#888888';
  const testAttribute = testId && IS_TEST ? ` data-testid="${testId}"` : '';
  const html = `
    <span class="campus-map-marker-inner"${testAttribute} style="
      display:grid;
      width:30px;
      height:30px;
      place-items:center;
      border:2px solid #fff;
      border-radius:50%;
      background:${markerColor};
      color:#fff;
      font-size:9px;
      font-weight:900;
      box-shadow:0 2px 8px rgb(15 23 42 / 28%);
      pointer-events:auto;
    ">${symbol || ''}</span>
  `;

  if (typeof window !== 'undefined' && L && typeof L.divIcon === 'function') {
    return L.divIcon({
      className: 'campus-map-marker',
      html,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -12],
      tooltipAnchor: [0, -12],
      bgPos: [0, 0],
    });
  }

  return {
    createIcon: () => {
      if (typeof document === 'undefined') return null;
      const el = document.createElement('div');
      el.className = 'campus-map-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#fff';
      el.style.borderRadius = '50%';
      el.style.background = markerColor;
      if (testId && IS_TEST) el.setAttribute('data-testid', testId);
      el.textContent = symbol || '';
      return el;
    },
    createShadow: () => null,
  };
};

const icons = {
  campus: markerIcon('#0b1f3a', 'C'),
  place: markerIcon('#0e7c86', ''),
  zone: markerIcon('#2563eb', 'Z'),
  incident: markerIcon('#d9534f', '!'),
  sos: markerIcon('#991b1b', 'SOS'),
  officer: markerIcon('#2d8a61', 'S'),
};

const coordinatesFor = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || String(latitude).trim() === ''
    || longitude === null || longitude === undefined || String(longitude).trim() === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? [lat, lng]
    : null;
};

const polygonCoordinatesFor = (coordinates) => {
  let geometry = coordinates;
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return null;
    }
  }
  if (geometry?.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return null;

  const rings = geometry.coordinates.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) return null;
    const positions = ring.map((position) => Array.isArray(position) ? coordinatesFor(position[1], position[0]) : null);
    if (positions.some((position) => !position)) return null;
    const first = positions[0];
    const last = positions[positions.length - 1];
    return first[0] === last[0] && first[1] === last[1] ? positions : null;
  });

  return rings.every(Boolean) ? rings : null;
};

const zoneCenter = (zone) => {
  const directCenter = coordinatesFor(zone.center_lat, zone.center_lng);
  if (directCenter) return directCenter;
  const polygon = polygonCoordinatesFor(zone.coordinates);
  if (!polygon?.[0]?.length) return null;
  const positions = polygon[0];
  return positions.reduce((center, position) => [center[0] + position[0] / positions.length, center[1] + position[1] / positions.length], [0, 0]);
};

const locationMatches = (location, query, type) => {
  const matchesType = type === 'all' || location.type === type;
  const searchable = `${location.name || ''} ${location.description || ''} ${location.block || ''} ${location.zone || ''} ${location.zone_id || ''}`.toLowerCase();
  return matchesType && searchable.includes(query.toLowerCase());
};

const distanceMeters = (from, to) => {
  const earthRadius = 6371000;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = radians(to[0] - from[0]);
  const deltaLongitude = radians(to[1] - from[1]);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;

const isActiveCampusLocation = (location) => (
  location?.is_active === true
  || location?.is_active === 1
  || location?.is_active === '1'
  || location?.is_active === 'true'
);

const validatedCampusLocationFor = (incident, campusLocations) => {
  const incidentLocationIds = [incident?.campus_location_id, incident?.campus_location?.location_id]
    .filter((locationId) => locationId !== null && locationId !== undefined && String(locationId).trim() !== '')
    .map((locationId) => String(locationId));
  if (!incidentLocationIds.length) return null;

  return (Array.isArray(campusLocations) ? campusLocations : []).find((location) => (
    isActiveCampusLocation(location)
    && hasVisibleLocationName(location)
    && location?.location_id !== null
    && location?.location_id !== undefined
    && incidentLocationIds.includes(String(location.location_id))
  )) || null;
};

function FitMapToData({ campusLocations, incidents, officers, zones }) {
  const map = useMap();
  const fittedKey = useRef('');

  useEffect(() => {
    const bounds = [];
    campusLocations.filter(hasVisibleLocationName).forEach((location) => {
      const position = coordinatesFor(location.latitude, location.longitude);
      if (position) bounds.push(position);
    });
    zones.forEach((zone) => {
      const polygon = polygonCoordinatesFor(zone.coordinates);
      if (polygon) {
        polygon.flat().forEach((position) => bounds.push(position));
        return;
      }

      const center = coordinatesFor(zone.center_lat, zone.center_lng);
      if (center && (zone.coordinates === null || zone.coordinates === undefined || zone.coordinates === '')) {
        bounds.push(center);
      }
    });
    if (!bounds.length) {
      incidents.forEach((incident) => {
        const location = validatedCampusLocationFor(incident, campusLocations);
        const position = location ? coordinatesFor(location.latitude, location.longitude) : null;
        if (position) bounds.push(position);
      });
      officers.forEach((officer) => {
        const position = coordinatesFor(officer.latitude, officer.longitude);
        if (position) bounds.push(position);
      });
    }

    const dataKey = bounds.map((position) => position.join(',')).join('|');
    if (!bounds.length || fittedKey.current === dataKey) return;
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    fittedKey.current = dataKey;
  }, [campusLocations, incidents, map, officers, zones]);

  return null;
}

function LocationMapEvents({ enabled, onMapClick }) {
  useMapEvents({ click: (event) => { if (enabled) onMapClick?.(event.latlng); } });
  return null;
}

function MapInstanceBridge({ onMapReady }) {
  const map = useMap();

  useEffect(() => {
    if (IS_TEST && typeof window !== 'undefined' && typeof map.setView === 'function') {
      const setView = map.setView.bind(map);
      map.setView = (position, zoom) => {
        window._map_last_setView = { pos: position, zoom };
        return setView(position, zoom);
      };
    }
    onMapReady(map);
    if (typeof map.invalidateSize === 'function') setTimeout(() => map.invalidateSize(), 150);
  }, [map, onMapReady]);

  return null;
}

export default function SecurityMap({ incidents = [], officers = [], zones = [], campusLocations = [], onAssign, selectedLocationId, onMapClick, onLocationDragEnd, focusedIncidentId, focusRequestKey, defaultMapStyle = 'standard', defaultOfficerAvailability = 'all', canManageZones = false, onDeleteZone }) {
  // Search and type
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');

  // Map instance (used for programmatic pan/zoom)
  const [map, setMap] = useState(null);
  const [mapStyle, setMapStyle] = useState(defaultMapStyle === 'satellite' ? 'satellite' : 'standard');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [zoneActionError, setZoneActionError] = useState('');
  const [zoneActionSuccess, setZoneActionSuccess] = useState('');
  const [deletingZone, setDeletingZone] = useState(false);
  const mapFullscreenRef = useRef(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const fullscreenActive = nativeFullscreen || fullscreenFallback;

  useEffect(() => {
    setMapStyle(defaultMapStyle === 'satellite' ? 'satellite' : 'standard');
  }, [defaultMapStyle]);

  // Layer toggles
  const [layers, setLayers] = useState({
    campusPlaces: true,
    zones: true,
    officers: true,
    incidents: true,
    sos: true
  });

  // Incident filters
  const [incidentFilters, setIncidentFilters] = useState({ status: 'all', severity: 'all', sosOnly: false });

  // Officer filter
  const [officerAvailability, setOfficerAvailability] = useState(defaultOfficerAvailability);

  const markerRefs = useRef({});

  useEffect(() => {
    setOfficerAvailability(defaultOfficerAvailability);
  }, [defaultOfficerAvailability]);

  const displayableCampusLocations = useMemo(() => campusLocations.filter(hasVisibleLocationName), [campusLocations]);
  const visibleLocations = useMemo(() => displayableCampusLocations.filter((location) => locationMatches(location, query, type)), [displayableCampusLocations, query, type]);
  const effectiveZones = useMemo(() => zones
    .filter((zone) => zone && zone.is_active !== false)
    .map((zone) => ({
      ...zone,
      buildings: displayableCampusLocations
        .filter((location) => location && (
          location.zone_id === zone.zone_id
          || location.zone === zone.name
          || location.zone === zone.zone_id
        ))
        .map((location) => ({
          location_id: location.location_id || location.id,
          name: location.name,
          type: location.type,
          description: location.description,
          latitude: location.latitude,
          longitude: location.longitude,
          placed: coordinatesFor(location.latitude, location.longitude) !== null,
        })),
    })), [displayableCampusLocations, zones]);
  const selectedZone = effectiveZones.find((zone) => zone.zone_id === selectedZoneId);
  const selectedBackendZone = selectedZone && !String(selectedZone.zone_id).startsWith('group-');

  useEffect(() => {
    if (selectedZoneId && !effectiveZones.some((zone) => zone.zone_id === selectedZoneId)) {
      setSelectedZoneId('');
      setZoneActionError('');
    }
  }, [effectiveZones, selectedZoneId]);

  const selectZone = (zone, event) => {
    event?.originalEvent?.stopPropagation?.();
    setSelectedZoneId(zone.zone_id);
    setZoneActionError('');
    setZoneActionSuccess('');
  };

  const removeSelectedZone = async () => {
    if (!canManageZones || !selectedBackendZone || !onDeleteZone || deletingZone) return;
    if (!window.confirm('Are you sure you want to delete this zone?')) return;

    setDeletingZone(true);
    setZoneActionError('');
    setZoneActionSuccess('');
    try {
      await onDeleteZone(selectedZone);
      setSelectedZoneId('');
      setZoneActionSuccess('Zone deleted successfully. Existing incidents are preserved; database zone references are cleared.');
    } catch (error) {
      setZoneActionError(error.response?.data?.message || error.message || 'Unable to delete zone.');
    } finally {
      setDeletingZone(false);
    }
  };
  const campusBounds = useMemo(() => [
    ...displayableCampusLocations.map((location) => coordinatesFor(location.latitude, location.longitude)).filter(Boolean),
    ...effectiveZones.flatMap((zone) => {
      const polygon = polygonCoordinatesFor(zone.coordinates);
      return polygon ? polygon.flat() : [zoneCenter(zone)].filter(Boolean);
    })
  ], [displayableCampusLocations, effectiveZones]);
  const invalidSOSCount = incidents.filter((incident) => incident.is_sos && !coordinatesFor(incident.latitude, incident.longitude)).length;
  const unavailableOfficerCount = officers.filter((officer) => !coordinatesFor(officer.latitude, officer.longitude)).length;

  // Derived filtered incident and officer lists according to layer toggles and filters
  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const campusLocation = validatedCampusLocationFor(incident, campusLocations);
    const pos = campusLocation ? coordinatesFor(campusLocation.latitude, campusLocation.longitude) : null;
    if (!pos) return false;
    if (focusedIncidentId && String(incident.incident_id) === String(focusedIncidentId)) return true;
    if (['resolved', 'closed', 'cancelled'].includes(String(incident.status || '').toLowerCase())) return false;
    // Layer toggles
    if (incident.is_sos && !layers.sos) return false;
    if (!incident.is_sos && !layers.incidents) return false;
    // SOS-only filter
    if (incidentFilters.sosOnly && !incident.is_sos) return false;
    // Status filter (if provided and not 'all')
    if (incidentFilters.status !== 'all' && incident.status && incidentFilters.status !== incident.status) return false;
    // Severity filter
    if (incidentFilters.severity !== 'all' && incident.severity && incidentFilters.severity !== String(incident.severity)) return false;
    return true;
  }), [campusLocations, incidents, incidentFilters, layers, focusedIncidentId]);

  const focusedIncident = focusedIncidentId
    ? filteredIncidents.find((incident) => String(incident.incident_id) === String(focusedIncidentId))
    : null;
  useEffect(() => {
    if (!map || !focusedIncident) return;
    const campusLocation = validatedCampusLocationFor(focusedIncident, campusLocations);
    const position = campusLocation ? coordinatesFor(campusLocation.latitude, campusLocation.longitude) : null;
    if (!position) return;
    map.setView(position, Math.max(map.getZoom(), 17));
    const marker = markerRefs.current[`incident-${focusedIncident.incident_id}`];
    marker?.openPopup?.();
  }, [campusLocations, focusRequestKey, focusedIncident, map]);

  const filteredOfficers = useMemo(() => officers.filter((officer) => {
    const pos = coordinatesFor(officer.latitude, officer.longitude);
    if (!pos) return false;
    if (!layers.officers) return false;
    if (officerAvailability !== 'all' && (officer.availability_status || 'offline') !== officerAvailability) return false;
    return true;
  }), [officers, officerAvailability, layers]);

  const handleSelectLocation = (location) => {
    const position = coordinatesFor(location.latitude, location.longitude);
    if (!position) return;
    if (IS_TEST && typeof window !== 'undefined') window._map_last_setViewRequested = position;
    if (!map) return;
    try {
      map.setView(position, 17);
      const markerKey = `place-${location.location_id || location.id}`;
      const marker = markerRefs.current[markerKey];
      if (marker && typeof marker.openPopup === 'function') {
        marker.openPopup();
      } else if (marker && marker._popup && marker._openPopup) {
        marker._openPopup();
      }
    } catch (e) {
      // silently ignore programmatic open failures to preserve existing behavior
      // map panning still attempted
    }
  };

  const fitCampus = () => {
    if (campusBounds.length) map?.fitBounds(campusBounds, { padding: [30, 30], maxZoom: 17 });
  };

  const toggleFullscreen = async () => {
    const mapContainer = mapFullscreenRef.current;
    if (!mapContainer) return;

    if (fullscreenFallback) {
      setFullscreenFallback(false);
      return;
    }

    if (document.fullscreenElement === mapContainer) {
      if (typeof document.exitFullscreen !== 'function') {
        setNativeFullscreen(false);
        setFullscreenFallback(true);
        return;
      }
      await document.exitFullscreen();
      setNativeFullscreen(false);
      return;
    }

    if (typeof mapContainer.requestFullscreen !== 'function') {
      setFullscreenFallback(true);
      return;
    }

    try {
      await mapContainer.requestFullscreen();
      setNativeFullscreen(true);
      setFullscreenFallback(false);
    } catch {
      setFullscreenFallback(true);
    }
  };

  useEffect(() => {
    const updateFullscreenState = () => {
      setNativeFullscreen(document.fullscreenElement === mapFullscreenRef.current);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  useEffect(() => {
    if (!map) return undefined;

    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const timeout = window.setTimeout(() => map.invalidateSize({ pan: false }), 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [fullscreenActive, map]);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return undefined;
    let resizeFrame = null;
    const refreshMap = () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        map.invalidateSize({ pan: false });
      });
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(refreshMap);
    if (resizeObserver && mapFullscreenRef.current) {
      resizeObserver.observe(mapFullscreenRef.current);
    }
    refreshMap();
    window.addEventListener('resize', refreshMap);
    return () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', refreshMap);
    };
  }, [map]);

  return (
    <div
      className={`campus-map-experience${fullscreenFallback ? ' is-fullscreen-fallback' : ''}`}
    >
      <div className="campus-map-controls dashboard-panel" aria-label="Map search and filters" hidden={fullscreenActive}>
        <div className="campus-map-toolbar" hidden={fullscreenActive}>
          <label>Search campus places<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Library, gate, block..." /></label>
          <label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{locationTypes.map((value) => <option key={value} value={value}>{value === 'all' ? 'All places' : locationTypeLabels[value]}</option>)}</select></label>

          <div className="layer-toggles" style={{ marginTop: 8 }}>
            <label><input type="checkbox" checked={layers.campusPlaces} onChange={() => setLayers((l) => ({ ...l, campusPlaces: !l.campusPlaces }))} /> Campus places</label>
            <label><input type="checkbox" checked={layers.zones} onChange={() => setLayers((l) => ({ ...l, zones: !l.zones }))} /> Zones</label>
            <label><input type="checkbox" checked={layers.officers} onChange={() => setLayers((l) => ({ ...l, officers: !l.officers }))} /> Security officers</label>
            <label><input type="checkbox" checked={layers.incidents} onChange={() => setLayers((l) => ({ ...l, incidents: !l.incidents }))} /> Incidents</label>
            <label><input type="checkbox" checked={layers.sos} onChange={() => setLayers((l) => ({ ...l, sos: !l.sos }))} /> SOS</label>
          </div>

          <div className="incident-filters" style={{ marginTop: 8 }}>
            <label>Status<select value={incidentFilters.status} onChange={(e) => setIncidentFilters((f) => ({ ...f, status: e.target.value }))}><option value="all">All</option><option value="open">Open</option><option value="closed">Closed</option><option value="responding">Responding</option></select></label>
            <label>Severity<select value={incidentFilters.severity} onChange={(e) => setIncidentFilters((f) => ({ ...f, severity: e.target.value }))}><option value="all">All</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
            <label><input type="checkbox" checked={incidentFilters.sosOnly} onChange={(e) => setIncidentFilters((f) => ({ ...f, sosOnly: e.target.checked }))} /> SOS only</label>
          </div>

          <div className="officer-filter" style={{ marginTop: 8 }}>
            <label>Officer availability<select value={officerAvailability} onChange={(e) => setOfficerAvailability(e.target.value)}><option value="all">All</option><option value="available">available</option><option value="responding">responding</option><option value="busy">busy</option><option value="offline">offline</option></select></label>
          </div>

          <div className="search-results" style={{ marginTop: 8 }}>
            {query && visibleLocations.length === 0 && <div className="search-no-results">No matching places</div>}
            {visibleLocations.length > 0 && (
              <ul style={{ maxHeight: 160, overflow: 'auto', padding: 0, margin: '6px 0', listStyle: 'none' }}>
                {visibleLocations.map((loc) => (
                  <li key={`search-${loc.location_id || loc.id}`} style={{ padding: '6px 8px', cursor: 'pointer' }} onClick={() => handleSelectLocation(loc)} data-testid={`search-result-${loc.location_id || loc.id}`}>
                    <strong>{loc.name}</strong><div style={{ fontSize: 12 }}>{locationTypeLabels[loc.type] || loc.type}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {selectedZone && <section className="mt-3 rounded-xl border border-cyan-300 bg-cyan-50 p-3" aria-label="Selected zone" data-testid="selected-zone-details" aria-live="polite">
          <p className="text-xs font-black uppercase tracking-wide text-cyan-800">Selected zone</p>
          <h3 className="mt-1 text-sm font-black text-[#0b1f3a]">{selectedZone.name}</h3>
          {selectedZone.description && <p className="mt-1 text-xs text-slate-700">{selectedZone.description}</p>}
          {selectedZone.radius && <p className="mt-1 text-xs text-slate-700">Radius: {selectedZone.radius} m</p>}
          {selectedBackendZone && selectedZone.buildings?.length > 0 && <p className="mt-1 text-xs text-slate-700">Assigned campus locations: {selectedZone.buildings.map((building) => building.name).join(', ')}</p>}
          {selectedBackendZone && selectedZone.buildings?.length > 0 && <p className="mt-1 text-xs font-semibold text-amber-800">Reassign or unassign these campus locations before deleting this zone.</p>}
          {canManageZones && selectedBackendZone && <button type="button" className="dashboard-button mt-3 border-red-200 text-red-700 hover:bg-red-50" onClick={removeSelectedZone} disabled={deletingZone}>{deletingZone ? 'Removing...' : 'Remove Zone'}</button>}
          {zoneActionError && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{zoneActionError}</p>}
        </section>}
        {zoneActionSuccess && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{zoneActionSuccess}</p>}

      </div>

      <div
        ref={mapFullscreenRef}
        className="campus-map-wrapper campus-map-fullscreen-container"
        style={!fullscreenActive ? {
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr)',
          height: 'clamp(24rem, 65vh, 48rem)',
          minHeight: '24rem',
        } : undefined}
      >
        <div className="campus-map-map-controls" aria-label="Map controls">
          <section aria-label="Map Controls">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Map Controls</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="dashboard-button" onClick={fitCampus}>Fit Campus</button>
              <button
                type="button"
                className="dashboard-button campus-map-fullscreen-button"
                onClick={toggleFullscreen}
                aria-label={fullscreenActive ? 'Exit fullscreen map' : 'Open fullscreen map'}
                aria-pressed={fullscreenActive}
                title={fullscreenActive ? 'Exit fullscreen map' : 'Open fullscreen map'}
              >
                <span aria-hidden="true">⛶</span>
                {fullscreenActive ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </section>
          <section aria-label="Map Style">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Map Style</h3>
            <div className="mt-2 flex gap-2">
              <button type="button" className={`dashboard-button ${mapStyle === 'satellite' ? 'primary' : ''}`} aria-pressed={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')}>Satellite</button>
              <button type="button" className={`dashboard-button ${mapStyle === 'standard' ? 'primary' : ''}`} aria-pressed={mapStyle === 'standard'} onClick={() => setMapStyle('standard')}>Standard</button>
            </div>
          </section>
        </div>
        <div className="campus-map-container" role="region" aria-label="Live campus map">
        <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <MapInstanceBridge onMapReady={setMap} />
          <FitMapToData campusLocations={campusLocations} incidents={incidents} officers={officers} zones={zones} />
          <LocationMapEvents enabled={Boolean(selectedLocationId)} onMapClick={onMapClick} />
          {mapStyle === 'standard'
            ? <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            : <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />}

          {filteredIncidents.map((incident) => {
            const campusLocation = validatedCampusLocationFor(incident, campusLocations);
            const position = campusLocation ? coordinatesFor(campusLocation.latitude, campusLocation.longitude) : null;
            if (!position) return null;
            const assigned = incident.responses?.[0]?.responder;
            const incidentIcon = markerIcon(incident.is_sos ? '#991b1b' : '#d9534f', incident.is_sos ? 'SOS' : '!', `marker-incident-${incident.incident_id}`);
            return (
              <Marker
                key={`incident-${incident.incident_id}`}
                position={position}
                icon={incidentIcon}
                ref={(marker) => { markerRefs.current[`incident-${incident.incident_id}`] = marker; }}
              >
                <Popup>
                  <strong>{incident.is_sos ? 'SOS' : 'Incident'}</strong>
                  <br />Type: {incident.type}
                  {incident.is_sos && <><br />Reporter: {incident.reporter ? <span className="inline-flex items-center gap-1"><UserAvatar user={incident.reporter} size="h-6 w-6" /><span>{incident.reporter.name || 'Campus member'}</span></span> : 'Campus member'}</>}
                  <br />Time: {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Unknown'}
                  <br />Coordinates: {position[0].toFixed(7)}, {position[1].toFixed(7)}
                  {incident.location_accuracy !== null && incident.location_accuracy !== undefined && Number.isFinite(Number(incident.location_accuracy)) && Number(incident.location_accuracy) >= 0 && <><br />GPS accuracy: {Number(incident.location_accuracy)} m</>}
                  {incident.location_timestamp && <><br />Location captured: {new Date(incident.location_timestamp).toLocaleString()}</>}
                  {!incident.is_sos && <><br />{assigned ? `Assigned: ${assigned.name}` : 'Unassigned'}</>}
                </Popup>
              </Marker>
            );
          })}

          {filteredOfficers.map((officer) => {
            const position = coordinatesFor(officer.latitude, officer.longitude);
            if (!position) return null;
            const assignment = incidents.find((incident) => incident.responses?.some((response) => response.responder_id === officer.user_id || response.responder?.user_id === officer.user_id));
            const activeAssignment = assignment?.responses?.find((response) => response.responder_id === officer.user_id || response.responder?.user_id === officer.user_id);
            const officerAssignmentStatus = activeAssignment?.assignment_status;
            const displayStatus = officerAssignmentStatus === 'pending' ? 'Assignment pending' : officerAssignmentStatus === 'accepted' ? 'Responding' : (officer.availability_status || 'unavailable');
            const incidentPosition = assignment && coordinatesFor(assignment.latitude, assignment.longitude);
            const officerIcon = markerIcon('#2d8a61', 'S', `marker-officer-${officer.user_id}`);
            return (
              <Marker key={`officer-${officer.user_id}`} position={position} icon={officerIcon}>
                <Popup>
                  <span className="inline-flex items-center gap-2"><UserAvatar user={officer} size="h-7 w-7" /><strong>{officer.name}</strong></span>
                  <br />Status: {displayStatus}
                  <br />Assignment: {officerAssignmentStatus === 'pending' ? 'Assignment pending' : assignment?.type || 'None'}
                  {incidentPosition && <><br />Distance: {formatDistance(distanceMeters(position, incidentPosition))}</>}
                  <br />Last update: {officer.location_updated_at ? new Date(officer.location_updated_at).toLocaleString() : 'Unavailable'}
                  {onAssign && <><br /><button type="button" onClick={() => onAssign(officer.user_id)}>Assign selected incident</button></>}
                </Popup>
              </Marker>
            );
          })}

          {layers.zones && effectiveZones.map((zone) => {
            const polygon = polygonCoordinatesFor(zone.coordinates);
            const center = coordinatesFor(zone.center_lat, zone.center_lng);
            const radius = Number(zone.radius) > 0 ? Number(zone.radius) : 500;
            const hasCircle = center && Number.isFinite(radius) && radius > 0;
            const hasPolygonData = zone.coordinates !== null && zone.coordinates !== undefined && zone.coordinates !== '';
            const popupContent = (
              <>
                <strong>{zone.name}</strong>
                {zone.description && <><br />Description: {zone.description}</>}
                {zone.status && <><br />Status: {zone.status}</>}
                {hasCircle && <><br />Radius: {radius} m</>}
                {zone.security_contact && <><br />Security contact: {zone.security_contact}</>}
                {zone.buildings && zone.buildings.length > 0 && (
                  <>
                    <br />Buildings:
                    <ul style={{ margin: '6px 0 0 12px', padding: 0 }}>
                      {zone.buildings.map((b) => (
                        <li key={b.location_id} style={{ listStyle: 'disc', marginLeft: 6, fontSize: 13 }}>
                                          <strong style={{ marginRight: 6 }}>{b.name}</strong>
                                          <span style={{ fontSize: 12, color: '#334155' }}>{b.type || 'Campus place'}</span>
                                          <div style={{ fontSize: 12, color: '#475569' }}>{b.placed ? `${Number(b.latitude).toFixed(7)}, ${Number(b.longitude).toFixed(7)}` : 'Needs placement'}</div>
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}
              </>
            );

            if (polygon) {
              // In test environments jsdom+leaflet can throw when rendering vector layers (Polygon).
              // Fall back to a simple Marker for tests while keeping full Polygon in real browsers.
              if (IS_TEST) {
                const centerPos = zoneCenter(zone);
                return centerPos ? (
                  <Marker key={`zone-group-${zone.zone_id}`} position={centerPos} icon={markerIcon(selectedZoneId === zone.zone_id ? '#dc2626' : '#2563eb','Z', `marker-zone-${zone.zone_id}`)} eventHandlers={{ click: (event) => selectZone(zone, event) }}>
                    <Popup>{popupContent}</Popup>
                  </Marker>
                ) : null;
              }

              const selected = selectedZoneId === zone.zone_id;
              const zonePathOptions = {
                color: selected ? '#dc2626' : '#2563eb',
                fillColor: selected ? '#f87171' : '#60a5fa',
                fillOpacity: selected ? 0.4 : 0.22,
                weight: selected ? 4 : 2,
                className: selected ? 'selected-security-zone' : 'selectable-security-zone',
              };
              return <Fragment key={`zone-group-${zone.zone_id}`}><Polygon positions={polygon} bubblingMouseEvents={false} eventHandlers={{ click: (event) => selectZone(zone, event) }} pathOptions={zonePathOptions}><Popup>{popupContent}</Popup></Polygon>{zoneCenter(zone) && <Marker position={zoneCenter(zone)} icon={markerIcon(selected ? '#dc2626' : '#2563eb','Z', `marker-zone-${zone.zone_id}`)} eventHandlers={{ click: (event) => selectZone(zone, event) }}><Popup>{popupContent}</Popup></Marker>}</Fragment>;
            }
            if (!hasPolygonData && hasCircle) {
              if (IS_TEST) {
                return (
                  <Marker key={`zone-group-${zone.zone_id}`} position={center} icon={markerIcon(selectedZoneId === zone.zone_id ? '#dc2626' : '#2563eb','Z', `marker-zone-${zone.zone_id}`)} eventHandlers={{ click: (event) => selectZone(zone, event) }}>
                    <Popup>{popupContent}</Popup>
                  </Marker>
                );
              }

              const selected = selectedZoneId === zone.zone_id;
              const zonePathOptions = {
                color: selected ? '#dc2626' : '#2563eb',
                fillColor: selected ? '#f87171' : '#60a5fa',
                fillOpacity: selected ? 0.4 : 0.22,
                weight: selected ? 4 : 2,
              };
              return <Fragment key={`zone-group-${zone.zone_id}`}><Circle center={center} radius={radius} bubblingMouseEvents={false} eventHandlers={{ click: (event) => selectZone(zone, event) }} pathOptions={zonePathOptions}><Popup>{popupContent}</Popup></Circle><Marker position={center} icon={markerIcon(selected ? '#dc2626' : '#2563eb','Z', `marker-zone-${zone.zone_id}`)} eventHandlers={{ click: (event) => selectZone(zone, event) }}><Popup>{popupContent}</Popup></Marker></Fragment>;
            }
            return null;
          })}

          {layers.campusPlaces && visibleLocations.map((location) => {
            const position = coordinatesFor(location.latitude, location.longitude);
            if (!position) return null;
            const key = `place-${location.location_id || location.id}`;
            const placeIcon = markerIcon(location.type === 'university' || location.type === 'campus' ? '#0b1f3a' : '#0e7c86', '', `marker-place-${location.location_id || location.id}`);
            return (
              <Marker
                key={key}
                position={position}
                draggable={location.location_id === selectedLocationId}
                eventHandlers={location.location_id === selectedLocationId ? { dragend: (event) => onLocationDragEnd?.(event.target.getLatLng()) } : undefined}
                icon={placeIcon}
                ref={(r) => { markerRefs.current[key] = r; }}
              >
                <Tooltip direction="top" offset={[0, -10]}>{location.name}</Tooltip>
                <Popup>
                  <strong>{location.name}</strong>
                  <br />Type: {locationTypeLabels[location.type] || location.type || 'Campus place'}
                  {location.description && <><br />{location.description}</>}
                  {location.location_id === selectedLocationId && <><br />Drag to adjust, then save.</>}
                </Popup>
              </Marker>
            );
          })}

          {!campusLocations.some((location) => location.type !== 'university' && location.type !== 'campus' && coordinatesFor(location.latitude, location.longitude)) && !zones.length && <div className="campus-map-notice" hidden={fullscreenActive}>No individual campus locations have verified coordinates yet. Select a location and place it on the map.</div>}

          {invalidSOSCount > 0 && (
            <div className="campus-map-status-notice" hidden={fullscreenActive} style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, padding: '8px 10px', background: '#fff', color: '#8a1c1c', border: '1px solid #e4b4b4', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>
              SOS: Location unavailable
            </div>
          )}
          {unavailableOfficerCount > 0 && (
            <div className="campus-map-status-notice" hidden={fullscreenActive} style={{ position: 'absolute', top: invalidSOSCount ? 52 : 12, left: 12, zIndex: 1000, padding: '8px 10px', background: '#fff', color: '#68757a', border: '1px solid #cbd5d6', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>
              {unavailableOfficerCount} officer location{unavailableOfficerCount === 1 ? '' : 's'} unavailable
            </div>
          )}
        </MapContainer>
      </div>
      </div>

      <div className="campus-map-legend" aria-label="Map legend" hidden={fullscreenActive}>
        <strong>Map legend</strong>
        <div className="campus-map-legend-items">
          <span><i className="legend-dot place" />Campus place</span>
          <span><i className="legend-dot officer" />Officer</span>
          <span><i className="legend-dot incident" />Incident</span>
          <span><i className="legend-dot sos" />SOS</span>
          <span><i className="legend-dot zone" />Security zone</span>
        </div>
      </div>
    </div>
  );
}
