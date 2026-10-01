import L from 'leaflet';
import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

const CAMPUS_CENTER = [10.9854535, 39.2631819];
const markerIcon = L.divIcon({
  className: 'zone-map-picker-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function LocationSelector({ onSelect }) {
  useMapEvents({
    click: (event) => onSelect(event.latlng),
  });
  return null;
}

export default function ZoneMapPicker({ latitude, longitude, onChange, disabled = false }) {
  const [baseLayer, setBaseLayer] = useState('street');
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  const hasLocation = latitude !== '' && latitude !== null && latitude !== undefined
    && longitude !== '' && longitude !== null && longitude !== undefined
    && Number.isFinite(numericLatitude) && numericLatitude >= -90 && numericLatitude <= 90
    && Number.isFinite(numericLongitude) && numericLongitude >= -180 && numericLongitude <= 180;
  const position = hasLocation ? [numericLatitude, numericLongitude] : null;
  const mapCenter = position || CAMPUS_CENTER;

  const selectLocation = ({ lat, lng }) => {
    if (!disabled) onChange(String(lat), String(lng));
  };

  return (
    <div className="zone-map-picker sm:col-span-2">
      <p className="text-sm font-bold text-slate-700">Select circle center *</p>
      <p className="text-xs text-slate-500">Click the map or drag the marker to set the zone location.</p>
      <div className="zone-map-picker-layers" role="group" aria-label="Map layer">
        <button type="button" className={baseLayer === 'street' ? 'active' : ''} aria-pressed={baseLayer === 'street'} onClick={() => setBaseLayer('street')}>Street Map</button>
        <button type="button" className={baseLayer === 'satellite' ? 'active' : ''} aria-pressed={baseLayer === 'satellite'} onClick={() => setBaseLayer('satellite')}>Satellite</button>
      </div>
      <div className="zone-map-picker-map">
        <MapContainer center={mapCenter} zoom={15} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
          {baseLayer === 'street' ? (
            <TileLayer
              key="street"
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              key="satellite"
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}
          <LocationSelector onSelect={selectLocation} />
          {position && (
            <Marker
              position={position}
              icon={markerIcon}
              draggable={!disabled}
              eventHandlers={{ dragend: (event) => selectLocation(event.target.getLatLng()) }}
            />
          )}
        </MapContainer>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2" aria-live="polite">
        <div><span className="font-semibold text-slate-600">Latitude: </span><output>{hasLocation ? Number(latitude).toFixed(6) : 'Not selected'}</output></div>
        <div><span className="font-semibold text-slate-600">Longitude: </span><output>{hasLocation ? Number(longitude).toFixed(6) : 'Not selected'}</output></div>
      </div>
    </div>
  );
}
