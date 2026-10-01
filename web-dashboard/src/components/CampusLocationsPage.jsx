import { useEffect, useState } from 'react';
import api from '../services/api';
import SecurityMap from './SecurityMap.jsx';

const locationTypes = ['university', 'administration', 'classroom', 'seminar', 'building/block', 'gate', 'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking', 'sports', 'emergency_point', 'other'];
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const hasCoordinates = (location) => {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return location.latitude !== null && location.latitude !== undefined && location.latitude !== ''
    && location.longitude !== null && location.longitude !== undefined && location.longitude !== ''
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
};
const createDraft = () => ({
  location_id: 'new-location-draft',
  name: '',
  type: 'other',
  description: '',
  latitude: null,
  longitude: null,
  zone_id: null,
});

export default function CampusLocationsPage({ user }) {
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [zones, setZones] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState(createDraft);
  const canManage = String(user?.role || '').trim().toLowerCase() === 'admin';
  const selected = isCreating ? draft : locations.find((location) => location.location_id === selectedId);
  const mapLocations = isCreating ? [...locations, draft] : locations;

  const loadLocations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/campus-locations');
      const data = response.data?.data || [];
      setLocations(data);
      setSelectedId((current) => current || data.find((location) => !hasCoordinates(location))?.location_id || data[0]?.location_id || '');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load campus locations.');
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      const response = await api.get('/zones');
      setZones(response.data?.data || []);
    } catch {
      setZones([]);
    }
  };

  useEffect(() => { loadLocations(); loadZones(); }, []);

  const updateSelected = (field, value) => {
    setSuccess('');
    if (isCreating) {
      setDraft((current) => ({ ...current, [field]: value }));
      return;
    }
    setLocations((current) => current.map((location) => (
      location.location_id === selectedId ? { ...location, [field]: value } : location
    )));
  };

  const updateCoordinates = (latitude, longitude) => {
    updateSelected('latitude', latitude);
    updateSelected('longitude', longitude);
  };

  const startCreating = () => {
    setError('');
    setSuccess('');
    setDraft(createDraft());
    setSelectedId('new-location-draft');
    setIsCreating(true);
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setDraft(createDraft());
    setSelectedId(locations[0]?.location_id || '');
  };

  const saveSelected = async () => {
    if (!selected || saving) return;
    if (!selected.name.trim()) {
      setError('Location name is required.');
      return;
    }
    if (!hasCoordinates(selected)) {
      setError('Select valid latitude and longitude coordinates before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: selected.name.trim(),
        type: selected.type,
        latitude: Number(selected.latitude),
        longitude: Number(selected.longitude),
        zone_id: selected.zone_id ?? null,
      };
      if (selected.description !== undefined) payload.description = selected.description;

      if (isCreating) {
        const response = await api.post('/campus-locations', payload);
        const createdLocation = response.data?.data;
        if (!createdLocation) throw new Error('The server did not return the created campus location.');
        setLocations((current) => [...current, createdLocation]);
        setSelectedId(createdLocation.location_id);
        setIsCreating(false);
        setDraft(createDraft());
        setSuccess('Campus location created successfully.');
      } else {
        const response = await api.patch(`/campus-locations/${selected.location_id}`, payload);
        const updatedLocation = response.data?.data;
        if (!updatedLocation) throw new Error('The server did not return the updated campus location.');
        setLocations((current) => current.map((location) => (
          location.location_id === selected.location_id ? updatedLocation : location
        )));
        setSuccess('Campus location updated successfully.');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save campus location.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="live-map-page space-y-8">
    <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="dashboard-eyebrow">Campus configuration</p><h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">Campus locations</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Place named campus locations accurately on the map. Coordinates are never inferred from the reference image.</p></div>
      <div className="flex gap-2">
        {canManage && <button type="button" className="dashboard-button primary" onClick={startCreating}>Create location</button>}
        <button type="button" className="dashboard-button" onClick={loadLocations} disabled={loading}>Refresh</button>
      </div>
    </div>
    {error && <div className="dashboard-error" role="alert">{error}</div>}
    {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{success}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)] live-map-grid">
      <aside className="dashboard-panel live-map-controls border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-[#0b1f3a]">Named locations</h3><span className="text-xs font-bold text-slate-500">{locations.filter(hasCoordinates).length}/{locations.length} placed</span></div>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-slate-500">Loading locations...</p> : locations.map((location) => <button key={location.location_id} type="button" onClick={() => { setIsCreating(false); setSelectedId(location.location_id); setSuccess(''); setError(''); }} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === location.location_id && !isCreating ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 bg-slate-50 hover:border-cyan-200'}`}><span className="flex items-center justify-between gap-2"><strong className="text-sm text-[#0b1f3a]">{location.name}</strong><span className={`h-2.5 w-2.5 rounded-full ${hasCoordinates(location) ? 'bg-emerald-500' : 'bg-amber-400'}`} title={hasCoordinates(location) ? 'Placed' : 'Needs placement'} /></span><span className="mt-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{titleCase(location.type)}</span></button>)}
        </div>
        {selected && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{isCreating ? 'New campus location' : 'Selected location'}</p>
          <div className="mt-3">
            <label htmlFor="campus-location-name" className="text-xs font-bold text-slate-600">Location Name / Building Name</label>
            {canManage
              ? <input id="campus-location-name" type="text" maxLength={150} value={selected.name} onChange={(event) => updateSelected('name', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#0b1f3a] outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
              : <p className="mt-1 text-sm font-semibold text-[#0b1f3a]">{selected.name}</p>}
          </div>
          <div className="mt-3">
            <label htmlFor="campus-location-type" className="text-xs font-bold text-slate-600">Type</label>
            {canManage
              ? <select id="campus-location-type" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold text-slate-800" value={selected.type || 'other'} onChange={(event) => updateSelected('type', event.target.value)}>
                {locationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              : <p className="mt-1 text-sm text-slate-700">{titleCase(selected.type)}</p>}
          </div>
          <div className="mt-3">
            <label htmlFor="campus-location-description" className="text-xs font-bold text-slate-600">Description</label>
            {canManage
              ? <textarea id="campus-location-description" rows="2" value={selected.description || ''} onChange={(event) => updateSelected('description', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800" />
              : <p className="mt-1 text-sm text-slate-700">{selected.description || 'No description'}</p>}
          </div>
          <p className="mt-3 text-xs text-slate-600">Status: <span className={`font-bold ${hasCoordinates(selected) ? 'text-emerald-600' : 'text-amber-600'}`}>{hasCoordinates(selected) ? 'Placed' : 'Location needs placement'}</span></p>
          <div className="mt-3">
            <span className="block text-xs font-bold text-slate-600">Coordinates</span>
            {canManage
              ? <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">Latitude
                  <input aria-label="Latitude" type="number" min="-90" max="90" step="any" value={selected.latitude ?? ''} onChange={(event) => updateSelected('latitude', event.target.value === '' ? null : Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800" />
                </label>
                <label className="text-xs text-slate-600">Longitude
                  <input aria-label="Longitude" type="number" min="-180" max="180" step="any" value={selected.longitude ?? ''} onChange={(event) => updateSelected('longitude', event.target.value === '' ? null : Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800" />
                </label>
              </div>
              : <p className="mt-1 text-sm tabular-nums text-slate-700">{hasCoordinates(selected) ? `${Number(selected.latitude).toFixed(7)}, ${Number(selected.longitude).toFixed(7)}` : 'Coordinates not set.'}</p>}
            {canManage && <p className="mt-1 text-xs text-slate-500">Enter coordinates or click/drag a marker on the map.</p>}
          </div>
          {canManage && <div className="mt-3">
            <label htmlFor="campus-location-zone" className="text-xs font-bold text-slate-600">Assign to zone</label>
            <select id="campus-location-zone" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-800" value={selected.zone_id || ''} onChange={(event) => updateSelected('zone_id', event.target.value || null)}>
              <option value="">(No zone)</option>
              {zones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.name}</option>)}
            </select>
          </div>}
          {canManage && <div className="mt-4 flex gap-2">
            <button type="button" className="dashboard-button primary flex-1" onClick={saveSelected} disabled={!selected.name.trim() || !hasCoordinates(selected) || saving}>{saving ? 'Saving...' : isCreating ? 'Create location' : 'Update location'}</button>
            {isCreating && <button type="button" className="dashboard-button" onClick={cancelCreating} disabled={saving}>Cancel</button>}
          </div>}
        </div>}
        <p className="mt-4 text-xs leading-5 text-slate-500">Categories: {locationTypes.length}. Amber markers need an administrator to place them.</p>
      </aside>
      <section className="dashboard-panel overflow-hidden border-slate-200/80 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)] live-map-panel">
        <SecurityMap
          campusLocations={mapLocations}
          selectedLocationId={canManage ? selectedId : ''}
          onMapClick={canManage ? ({ lat, lng }) => updateCoordinates(lat, lng) : undefined}
          onLocationDragEnd={canManage ? ({ lat, lng }) => updateCoordinates(lat, lng) : undefined}
        />
      </section>
    </div>
  </div>;
}