import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { Circle, CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap } from 'react-leaflet';

const CAMPUS_CENTER = [9.0227, 38.7468];
const statusColor = {
  available: '#2d8a61',
  responding: '#d9533f',
  busy: '#c17a24',
  offline: '#68757a'
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
    } catch (error) {
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

function FitMapToData({ incidents, officers, zones }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current) return;

    const bounds = [];
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
    incidents.forEach((incident) => {
      const position = coordinatesFor(incident.latitude, incident.longitude);
      if (position) bounds.push(position);
    });
    officers.forEach((officer) => {
      const position = coordinatesFor(officer.latitude, officer.longitude);
      if (position) bounds.push(position);
    });

    if (!bounds.length) return;
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    hasFitted.current = true;
  }, [incidents, map, officers, zones]);

  return null;
}

export default function SecurityMap({ incidents = [], officers = [], zones = [], onAssign }) {
  const invalidSOSCount = incidents.filter((incident) => incident.is_sos && !coordinatesFor(incident.latitude, incident.longitude)).length;
  const unavailableOfficerCount = officers.filter((officer) => !coordinatesFor(officer.latitude, officer.longitude)).length;

  return (
    <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: 360, width: '100%' }} scrollWheelZoom>
      <FitMapToData incidents={incidents} officers={officers} zones={zones} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {incidents.map((incident) => {
        const position = coordinatesFor(incident.latitude, incident.longitude);
        if (!position) return null;
        const assigned = incident.responses?.[0]?.responder;
        return (
          <CircleMarker key={`incident-${incident.incident_id}`} center={position} radius={10} pathOptions={{ color: '#a71919', fillColor: '#d9533f', fillOpacity: 0.9 }}>
            <Popup>
              <strong>{incident.is_sos ? 'SOS' : 'Incident'}</strong>
              <br />Type: {incident.type}
              {incident.is_sos && <><br />Reporter: {incident.reporter?.name || 'Campus member'}</>}
              <br />Time: {incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Unknown'}
              <br />Coordinates: {position[0].toFixed(7)}, {position[1].toFixed(7)}
              {!incident.is_sos && <><br />{assigned ? `Assigned: ${assigned.name}` : 'Unassigned'}</>}
            </Popup>
          </CircleMarker>
        );
      })}
      {officers.map((officer) => {
        const position = coordinatesFor(officer.latitude, officer.longitude);
        if (!position) return null;
        const assignment = incidents.find((incident) => incident.responses?.some((response) => response.responder_id === officer.user_id || response.responder?.user_id === officer.user_id));
        const incidentPosition = assignment && coordinatesFor(assignment.latitude, assignment.longitude);
        return (
          <CircleMarker key={`officer-${officer.user_id}`} center={position} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: statusColor[officer.availability_status] || statusColor.offline, fillOpacity: 1 }}>
            <Popup>
              <strong>{officer.name}</strong>
              <br />Status: {officer.availability_status || 'unavailable'}
              <br />Assignment: {assignment?.type || 'None'}
              {incidentPosition && <><br />Distance: {formatDistance(distanceMeters(position, incidentPosition))}</>}
              <br />Last update: {officer.location_updated_at ? new Date(officer.location_updated_at).toLocaleString() : 'Unavailable'}
              {onAssign && <><br /><button type="button" onClick={() => onAssign(officer.user_id)}>Assign selected incident</button></>}
            </Popup>
          </CircleMarker>
        );
      })}
      {zones.map((zone) => {
        const polygon = polygonCoordinatesFor(zone.coordinates);
        const center = coordinatesFor(zone.center_lat, zone.center_lng);
        const radius = Number(zone.radius);
        const hasCircle = center && Number.isInteger(radius) && radius > 0;
        const hasPolygonData = zone.coordinates !== null && zone.coordinates !== undefined && zone.coordinates !== '';
        const popup = (
          <Popup>
            <strong>{zone.name}</strong>
            {zone.description && <><br />Description: {zone.description}</>}
            {hasCircle && <><br />Radius: {radius} m</>}
            {zone.security_contact && <><br />Security contact: {zone.security_contact}</>}
          </Popup>
        );

        if (polygon) {
          return <Polygon key={`zone-${zone.zone_id}`} positions={polygon} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.18 }}>{popup}</Polygon>;
        }
        if (!hasPolygonData && hasCircle) {
          return <Circle key={`zone-${zone.zone_id}`} center={center} radius={radius} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.18 }}>{popup}</Circle>;
        }
        return null;
      })}
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
