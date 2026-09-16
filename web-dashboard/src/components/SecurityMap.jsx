import 'leaflet/dist/leaflet.css';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';

const CAMPUS_CENTER = [10.9854535, 39.2631819];
const locationTypes = ['all', 'university', 'administration', 'classroom', 'seminar', 'building/block', 'gate', 'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking', 'sports', 'emergency_point', 'other'];
const locationTypeLabels = {
  university: 'University', administration: 'Administration', classroom: 'Classroom', seminar: 'Seminar', 'building/block': 'Building / block', library: 'Library', dormitory: 'Dormitory',
  cafeteria: 'Cafeteria', clinic: 'Health / clinic', gate: 'Main gate', security_post: 'Security post',
  parking: 'Parking', sports: 'Sports / recreation', emergency_point: 'Emergency point', other: 'Campus place'
};
const markerIcon = (background, symbol) => divIcon({
  className: 'campus-map-marker',
  html: `<span style="background:${background}">${symbol}</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
});

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
  const searchable = `${location.name || ''} ${location.description || ''} ${location.block || ''} ${location.zone || ''}`.toLowerCase();
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
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const visibleLocations = useMemo(() => campusLocations.filter((location) => locationMatches(location, query, type)), [campusLocations, query, type]);
  const campusBounds = useMemo(() => [
    ...campusLocations.map((location) => coordinatesFor(location.latitude, location.longitude)).filter(Boolean),
    ...zones.flatMap((zone) => {
      const polygon = polygonCoordinatesFor(zone.coordinates);
      return polygon ? polygon.flat() : [zoneCenter(zone)].filter(Boolean);
    })
  ], [campusLocations, zones]);
  const invalidSOSCount = incidents.filter((incident) => incident.is_sos && !coordinatesFor(incident.latitude, incident.longitude)).length;
  const unavailableOfficerCount = officers.filter((officer) => !coordinatesFor(officer.latitude, officer.longitude)).length;

  return (
    <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: 520, width: '100%' }} scrollWheelZoom>
      <FitMapToData campusLocations={campusLocations} incidents={incidents} officers={officers} zones={zones} />
      <LocationMapEvents enabled={Boolean(selectedLocationId)} onMapClick={onMapClick} />
      <FitCampusButton bounds={campusBounds} />
      <div className="campus-map-toolbar">
        <label>Search campus places<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Library, gate, block..." /></label>
        <label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{locationTypes.map((value) => <option key={value} value={value}>{value === 'all' ? 'All places' : locationTypeLabels[value]}</option>)}</select></label>
      </div>
      <div className="campus-map-legend" aria-label="Map legend">
        <strong>Map legend</strong><span><i className="legend-dot place" />Campus place</span><span><i className="legend-dot officer" />Officer</span><span><i className="legend-dot incident" />Incident</span><span><i className="legend-dot sos" />SOS</span><span><i className="legend-dot zone" />Security zone</span>
      </div>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {incidents.map((incident) => {
        const position = coordinatesFor(incident.latitude, incident.longitude);
        if (!position) return null;
        const assigned = incident.responses?.[0]?.responder;
        return (
          <Marker key={`incident-${incident.incident_id}`} position={position} icon={incident.is_sos ? icons.sos : icons.incident}>
            <Popup>
              <strong>{incident.is_sos ? 'SOS' : 'Incident'}</strong>
              <br />Type: {incident.type}
              {incident.is_sos && <><br />Reporter: {incident.reporter?.name || 'Campus member'}</>}
              <br />Time: {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Unknown'}
              <br />Coordinates: {position[0].toFixed(7)}, {position[1].toFixed(7)}
              {!incident.is_sos && <><br />{assigned ? `Assigned: ${assigned.name}` : 'Unassigned'}</>}
            </Popup>
          </Marker>
        );
      })}
      {officers.map((officer) => {
        const position = coordinatesFor(officer.latitude, officer.longitude);
        if (!position) return null;
        const assignment = incidents.find((incident) => incident.responses?.some((response) => response.responder_id === officer.user_id || response.responder?.user_id === officer.user_id));
        const incidentPosition = assignment && coordinatesFor(assignment.latitude, assignment.longitude);
        return (
          <Marker key={`officer-${officer.user_id}`} position={position} icon={icons.officer}>
            <Popup>
              <strong>{officer.name}</strong>
              <br />Status: {officer.availability_status || 'unavailable'}
              <br />Assignment: {assignment?.type || 'None'}
              {incidentPosition && <><br />Distance: {formatDistance(distanceMeters(position, incidentPosition))}</>}
              <br />Last update: {officer.location_updated_at ? new Date(officer.location_updated_at).toLocaleString() : 'Unavailable'}
              {onAssign && <><br /><button type="button" onClick={() => onAssign(officer.user_id)}>Assign selected incident</button></>}
            </Popup>
          </Marker>
        );
      })}
      {zones.map((zone) => {
        const polygon = polygonCoordinatesFor(zone.coordinates);
        const center = coordinatesFor(zone.center_lat, zone.center_lng);
        const radius = Number(zone.radius);
        const hasCircle = center && Number.isInteger(radius) && radius > 0;
        const hasPolygonData = zone.coordinates !== null && zone.coordinates !== undefined && zone.coordinates !== '';
        const popupContent = (
          <>
            <strong>{zone.name}</strong>
            {zone.description && <><br />Description: {zone.description}</>}
            {hasCircle && <><br />Radius: {radius} m</>}
            {zone.security_contact && <><br />Security contact: {zone.security_contact}</>}
          </>
        );

        if (polygon) {
          return <Fragment key={`zone-group-${zone.zone_id}`}><Polygon positions={polygon} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.18 }}><Popup>{popupContent}</Popup></Polygon>{zoneCenter(zone) && <Marker position={zoneCenter(zone)} icon={icons.zone}><Popup>{popupContent}</Popup></Marker>}</Fragment>;
        }
        if (!hasPolygonData && hasCircle) {
          return <Fragment key={`zone-group-${zone.zone_id}`}><Circle center={center} radius={radius} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.18 }}><Popup>{popupContent}</Popup></Circle><Marker position={center} icon={icons.zone}><Popup>{popupContent}</Popup></Marker></Fragment>;
        }
        return null;
      })}
      {visibleLocations.map((location) => {
        const position = coordinatesFor(location.latitude, location.longitude);
        if (!position) return null;
        return <Marker key={`place-${location.location_id || location.id}`} position={position} draggable={location.location_id === selectedLocationId} eventHandlers={location.location_id === selectedLocationId ? { dragend: (event) => onLocationDragEnd?.(event.target.getLatLng()) } : undefined} icon={location.type === 'university' || location.type === 'campus' ? icons.campus : icons.place}><Popup><strong>{location.name}</strong><br />Type: {locationTypeLabels[location.type] || location.type || 'Campus place'}{location.description && <><br />{location.description}</>}{location.location_id === selectedLocationId && <><br />Drag to adjust, then save.</>}</Popup></Marker>;
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
  );
}
