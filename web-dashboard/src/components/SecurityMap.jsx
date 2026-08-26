import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';

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

export default function SecurityMap({ incidents = [], officers = [], onAssign }) {
  return (
    <MapContainer center={CAMPUS_CENTER} zoom={15} style={{ height: 360, width: '100%' }} scrollWheelZoom>
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
              <strong>{incident.is_sos ? 'SOS Emergency' : 'Incident'}</strong>
              <br />{incident.type} · {incident.status}
              <br />{assigned ? `Assigned: ${assigned.name}` : 'Unassigned'}
            </Popup>
          </CircleMarker>
        );
      })}
      {officers.map((officer) => {
        const position = coordinatesFor(officer.latitude, officer.longitude);
        if (!position) return null;
        return (
          <CircleMarker key={`officer-${officer.user_id}`} center={position} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: statusColor[officer.availability_status] || statusColor.offline, fillOpacity: 1 }}>
            <Popup>
              <strong>{officer.name}</strong>
              <br />{officer.availability_status}
              {onAssign && <><br /><button type="button" onClick={() => onAssign(officer.user_id)}>Assign selected incident</button></>}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
