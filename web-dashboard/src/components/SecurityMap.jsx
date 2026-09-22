import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, LayersControl, useMap, useMapEvents } from 'react-leaflet';
import { UserAvatar } from './DashboardLayout';

const CAMPUS_CENTER = [10.9854535, 39.2631819];
const locationTypes = ['all', 'university', 'administration', 'classroom', 'seminar', 'building/block', 'gate', 'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking', 'sports', 'emergency_point', 'other'];
const locationTypeLabels = {
  cafeteria: 'Cafeteria', clinic: 'Health / clinic', gate: 'Main gate', security_post: 'Security post',
  parking: 'Parking', sports: 'Sports / recreation', emergency_point: 'Emergency point', other: 'Campus place'
};
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
  place: markerIcon('#0e7c86', 'P'),
  zone: markerIcon('#2563eb', 'Z'),
  incident: markerIcon('#d9534f', '!'),
  sos: markerIcon('#991b1b', 'SOS'),
  officer: markerIcon('#2d8a61', 'S'),
};

const coordinatesFor = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || latitude === '' || longitude === null || longitude === undefined || longitude === '') return null;
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

function FitCampusButton({ bounds }) {
  const map = useMap();
  return <button type="button" className="campus-map-control" onClick={() => bounds.length && map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 })}>Fit campus</button>;
}

function FitMapToData({ campusLocations, incidents, officers, zones }) {
  const map = useMap();
  const fittedKey = useRef('');

  useEffect(() => {
    const bounds = [];
    campusLocations.forEach((location) => {
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
        const position = coordinatesFor(incident.latitude, incident.longitude);
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

export default function SecurityMap({ incidents = [], officers = [], zones = [], campusLocations = [], onAssign, selectedLocationId, onMapClick, onLocationDragEnd }) {
  // Search and type
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');

  // Map instance (used for programmatic pan/zoom)
  const [map, setMap] = useState(null);

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
  const [officerAvailability, setOfficerAvailability] = useState('all');

  const markerRefs = useRef({});

  const visibleLocations = useMemo(() => campusLocations.filter((location) => locationMatches(location, query, type)), [campusLocations, query, type]);
  const effectiveZones = useMemo(() => {
    // Start with any active backend zones
    const backendZones = zones.filter((z) => z && z.is_active !== false);

    // Group campus locations by logical zone categories for MAU Tulu Awuliya campus
    const groupDefs = [
      { id: 'campus-core', name: 'MAU Tulu Awuliya Campus Core', types: ['university', 'campus'] },
      { id: 'administration', name: 'Administration Zone', types: ['administration'] },
      { id: 'academic', name: 'Academic Zone', types: ['classroom', 'seminar', 'building/block'] },
      { id: 'student-services', name: 'Student Services Zone', types: ['library', 'cafeteria', 'clinic'] },
      { id: 'residential', name: 'Residential Zone', types: ['dormitory'] },
      { id: 'other', name: 'Other campus places', types: ['other', 'security_post', 'gate', 'parking', 'sports', 'emergency_point'] },
    ];

    const groups = groupDefs.map((def) => {
      const members = campusLocations
        .filter((loc) => def.types.includes(loc.type))
        .map((loc) => ({
          location_id: loc.location_id || loc.id,
          name: loc.name,
          type: loc.type,
          description: loc.description,
          latitude: loc.latitude,
          longitude: loc.longitude,
          placed: coordinatesFor(loc.latitude, loc.longitude) !== null,
        }));

      // compute center from placed members (average lat/lng) if any
      const placedPositions = members.map((m) => coordinatesFor(m.latitude, m.longitude)).filter(Boolean);
      let center = null;
      if (placedPositions.length) {
        const avgLat = placedPositions.reduce((s, p) => s + p[0], 0) / placedPositions.length;
        const avgLng = placedPositions.reduce((s, p) => s + p[1], 0) / placedPositions.length;
        center = [avgLat, avgLng];
      }

      return {
        id: def.id,
        zone_id: `group-${def.id}`,
        name: def.name,
        description: `${def.name} (logical grouping of campus locations)`,
        center_lat: center ? Number(center[0]) : null,
        center_lng: center ? Number(center[1]) : null,
        radius: 250, // display radius for grouped zones (client-side only)
        is_active: true,
        buildings: members,
      };
    });

    // Merge backend zones and client-side grouped zones.
    // If backend zones exist, include them first and also include any grouped zones that do not overlap (no backend zone with same name)
    if (backendZones.length) {
      // Attach building lists to backend zones by scanning campusLocations for explicit zone assignment
      const backendWithBuildings = backendZones.map((bz) => {
        const members = campusLocations
          .filter((loc) => loc && (loc.zone_id === bz.zone_id || loc.zone_id === bz.zone_id || loc.zone === bz.name || loc.zone === bz.zone_id))
          .map((loc) => ({
            location_id: loc.location_id || loc.id,
            name: loc.name,
            type: loc.type,
            description: loc.description,
            latitude: loc.latitude,
            longitude: loc.longitude,
            placed: coordinatesFor(loc.latitude, loc.longitude) !== null,
          }));
        return { ...bz, buildings: members };
      });

      const backendNames = new Set(backendZones.map((bz) => bz.name));
      const extraGroups = groups.filter((g) => !backendNames.has(g.name));
      return [...backendWithBuildings, ...extraGroups];
    }

    // If no backend zones, show grouped zones so the map is useful for admins immediately
    return groups;
  }, [campusLocations, zones]);
  const campusBounds = useMemo(() => [
    ...campusLocations.map((location) => coordinatesFor(location.latitude, location.longitude)).filter(Boolean),
    ...effectiveZones.flatMap((zone) => {
      const polygon = polygonCoordinatesFor(zone.coordinates);
      return polygon ? polygon.flat() : [zoneCenter(zone)].filter(Boolean);
    })
  ], [campusLocations, effectiveZones]);
  const invalidSOSCount = incidents.filter((incident) => incident.is_sos && !coordinatesFor(incident.latitude, incident.longitude)).length;
  const unavailableOfficerCount = officers.filter((officer) => !coordinatesFor(officer.latitude, officer.longitude)).length;

  // Derived filtered incident and officer lists according to layer toggles and filters
  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const pos = coordinatesFor(incident.latitude, incident.longitude);
    if (!pos) return false;
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
  }), [incidents, incidentFilters, layers]);

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

  useEffect(() => {
    if (!map || typeof window === 'undefined') return undefined;
    const refreshMap = () => {
      try {
        setTimeout(() => {
          if (map && typeof map.invalidateSize === 'function') map.invalidateSize();
        }, 120);
      } catch (e) {
        // ignore invalidation failures
      }
    };
    refreshMap();
    window.addEventListener('resize', refreshMap);
    return () => window.removeEventListener('resize', refreshMap);
  }, [map]);

  return (
    <div className="campus-map-wrapper">
      <div className="campus-map-controls dashboard-panel" aria-label="Map controls">
        <div className="campus-map-toolbar">
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

        <div className="campus-map-legend" aria-label="Map legend">
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

      <div className="campus-map-container" role="region" aria-label="Live campus map">
        <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom whenCreated={(m) => {
          setMap(m);
          if (typeof window !== 'undefined' && m && typeof m.setView === 'function') {
            const orig = m.setView.bind(m);
            m.setView = (pos, z) => { window._map_last_setView = { pos, zoom: z }; return orig(pos, z); };
          }
          if (m && typeof m.invalidateSize === 'function') setTimeout(() => m.invalidateSize(), 150);
        }}>
          <FitMapToData campusLocations={campusLocations} incidents={incidents} officers={officers} zones={zones} />
          <LocationMapEvents enabled={Boolean(selectedLocationId)} onMapClick={onMapClick} />
          <FitCampusButton bounds={campusBounds} />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Street map (OSM)">
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite (Esri)">
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {filteredIncidents.map((incident) => {
            const position = coordinatesFor(incident.latitude, incident.longitude);
            if (!position) return null;
            const assigned = incident.responses?.[0]?.responder;
            const incidentIcon = markerIcon(incident.is_sos ? '#991b1b' : '#d9534f', incident.is_sos ? 'SOS' : '!', `marker-incident-${incident.incident_id}`);
            return (
              <Marker key={`incident-${incident.incident_id}`} position={position} icon={incidentIcon}>
                <Popup>
                  <strong>{incident.is_sos ? 'SOS' : 'Incident'}</strong>
                  <br />Type: {incident.type}
                  {incident.is_sos && <><br />Reporter: {incident.reporter ? <span className="inline-flex items-center gap-1"><UserAvatar user={incident.reporter} size="h-6 w-6" /><span>{incident.reporter.name || 'Campus member'}</span></span> : 'Campus member'}</>}
                  <br />Time: {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Unknown'}
                  <br />Coordinates: {position[0].toFixed(7)}, {position[1].toFixed(7)}
                  {!incident.is_sos && <><br />{assigned ? `Assigned: ${assigned.name}` : 'Unassigned'}</>}
                </Popup>
              </Marker>
            );
          })}

          {filteredOfficers.map((officer) => {
            const position = coordinatesFor(officer.latitude, officer.longitude);
            if (!position) return null;
            const assignment = incidents.find((incident) => incident.responses?.some((response) => response.responder_id === officer.user_id || response.responder?.user_id === officer.user_id));
            const incidentPosition = assignment && coordinatesFor(assignment.latitude, assignment.longitude);
            const officerIcon = markerIcon('#2d8a61', 'S', `marker-officer-${officer.user_id}`);
            return (
              <Marker key={`officer-${officer.user_id}`} position={position} icon={officerIcon}>
                <Popup>
                  <span className="inline-flex items-center gap-2"><UserAvatar user={officer} size="h-7 w-7" /><strong>{officer.name}</strong></span>
                  <br />Status: {officer.availability_status || 'unavailable'}
                  <br />Assignment: {assignment?.type || 'None'}
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
                  <Marker key={`zone-group-${zone.zone_id}`} position={centerPos} icon={markerIcon('#2563eb','Z', `marker-zone-${zone.zone_id}`)}>
                    <Popup>{popupContent}</Popup>
                  </Marker>
                ) : null;
              }

              return <Fragment key={`zone-group-${zone.zone_id}`}><Polygon positions={polygon} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.22, weight: 2 }}><Popup>{popupContent}</Popup></Polygon>{zoneCenter(zone) && <Marker position={zoneCenter(zone)} icon={markerIcon('#2563eb','Z', `marker-zone-${zone.zone_id}`)}><Popup>{popupContent}</Popup></Marker>}</Fragment>;
            }
            if (!hasPolygonData && hasCircle) {
              if (IS_TEST) {
                return (
                  <Marker key={`zone-group-${zone.zone_id}`} position={center} icon={markerIcon('#2563eb','Z', `marker-zone-${zone.zone_id}`)}>
                    <Popup>{popupContent}</Popup>
                  </Marker>
                );
              }

              return <Fragment key={`zone-group-${zone.zone_id}`}><Circle center={center} radius={radius} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.22, weight: 2 }}><Popup>{popupContent}</Popup></Circle><Marker position={center} icon={markerIcon('#2563eb','Z', `marker-zone-${zone.zone_id}`)}><Popup>{popupContent}</Popup></Marker></Fragment>;
            }
            return null;
          })}

          {layers.campusPlaces && visibleLocations.map((location) => {
            const position = coordinatesFor(location.latitude, location.longitude);
            if (!position) return null;
            const key = `place-${location.location_id || location.id}`;
            const placeIcon = markerIcon(location.type === 'university' || location.type === 'campus' ? '#0b1f3a' : '#0e7c86', 'P', `marker-place-${location.location_id || location.id}`);
            return (
              <Marker
                key={key}
                position={position}
                draggable={location.location_id === selectedLocationId}
                eventHandlers={location.location_id === selectedLocationId ? { dragend: (event) => onLocationDragEnd?.(event.target.getLatLng()) } : undefined}
                icon={placeIcon}
                ref={(r) => { markerRefs.current[key] = r; }}
              >
                <Popup>
                  <strong>{location.name}</strong>
                  <br />Type: {locationTypeLabels[location.type] || location.type || 'Campus place'}
                  {location.description && <><br />{location.description}</>}
                  {location.location_id === selectedLocationId && <><br />Drag to adjust, then save.</>}
                </Popup>
              </Marker>
            );
          })}

          {!campusLocations.some((location) => location.type !== 'university' && location.type !== 'campus' && coordinatesFor(location.latitude, location.longitude)) && !zones.length && <div className="campus-map-notice">No individual campus locations have verified coordinates yet. Select a location and place it on the map.</div>}

          {invalidSOSCount > 0 && (
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, padding: '8px 10px', background: '#fff', color: '#8a1c1c', border: '1px solid #e4b4b4', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>
              SOS: Location unavailable
            </div>
          )}
          {unavailableOfficerCount > 0 && (
            <div style={{ position: 'absolute', top: invalidSOSCount ? 52 : 12, left: 12, zIndex: 1000, padding: '8px 10px', background: '#fff', color: '#68757a', border: '1px solid #cbd5d6', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>
              {unavailableOfficerCount} officer location{unavailableOfficerCount === 1 ? '' : 's'} unavailable
            </div>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
