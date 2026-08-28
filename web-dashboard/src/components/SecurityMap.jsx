import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';

const CAMPUS_CENTER = [9.0227, 38.7468];
const statusColor = {
  available: '#2d8a61',
  responding: '#d9533f',
  busy: '#c17a24',
  offline: '#68757a'
};

const coordinatesFor = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? [lat, lng]
    : null;
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

function RecenterOnLatestSOS({ incidents, focusIncidentId }) {
  const map = useMap();

  useEffect(() => {
    const focusedIncident = incidents.find((incident) => String(incident.incident_id) === String(focusIncidentId));
    const latestSOS = incidents.find((incident) => incident.is_sos && coordinatesFor(incident.latitude, incident.longitude));
    const target = focusedIncident || latestSOS;
    const position = target && coordinatesFor(target.latitude, target.longitude);
    if (position) map.setView(position, 17, { animate: true });
  }, [incidents, focusIncidentId, map]);

  return null;
}

export default function SecurityMap({ incidents = [], officers = [], onAssign, focusIncidentId }) {
  const invalidSOSCount = incidents.filter((incident) => incident.is_sos && !coordinatesFor(incident.latitude, incident.longitude)).length;
  const unavailableOfficerCount = officers.filter((officer) => !coordinatesFor(officer.latitude, officer.longitude)).length;

  return (
    <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: 360, width: '100%' }} scrollWheelZoom>
      <RecenterOnLatestSOS incidents={incidents} focusIncidentId={focusIncidentId} />
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
