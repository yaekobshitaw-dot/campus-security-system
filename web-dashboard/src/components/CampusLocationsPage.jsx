import { useEffect, useState } from 'react';
import api from '../services/api';
import SecurityMap from './SecurityMap.jsx';

const locationTypes = ['university', 'administration', 'classroom', 'seminar', 'building/block', 'gate', 'security_post', 'dormitory', 'library', 'clinic', 'cafeteria', 'parking', 'sports', 'emergency_point', 'other'];
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const hasCoordinates = (location) => location.latitude !== null && location.latitude !== undefined && location.latitude !== ''
  && location.longitude !== null && location.longitude !== undefined && location.longitude !== ''
  && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));

export default function CampusLocationsPage({ user }) {
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = locations.find((location) => location.location_id === selectedId);

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

  useEffect(() => { loadLocations(); }, []);

  const updateCoordinates = (latitude, longitude) => {
    setLocations((current) => current.map((location) => location.location_id === selectedId ? { ...location, latitude, longitude } : location));
  };

  const saveSelected = async () => {
    if (!selected || !hasCoordinates(selected)) return;
    setSaving(true);
    setError('');
    try {
      const response = await api.patch(`/campus-locations/${selected.location_id}`, { latitude: selected.latitude, longitude: selected.longitude });
      setLocations((current) => current.map((location) => location.location_id === selected.location_id ? response.data.data : location));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save campus location.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') return <div className="dashboard-error" role="alert">Only administrators can manage campus locations.</div>;

  return <div className="space-y-8">
    <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="dashboard-eyebrow">Campus configuration</p><h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">Campus locations</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Place named campus locations accurately on the map. Coordinates are never inferred from the reference image.</p></div>
      <button type="button" className="dashboard-button" onClick={loadLocations} disabled={loading}>Refresh</button>
    </div>
    {error && <div className="dashboard-error" role="alert">{error}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="dashboard-panel overflow-hidden border-slate-200/80 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <SecurityMap campusLocations={locations} selectedLocationId={selectedId} onMapClick={({ lat, lng }) => updateCoordinates(lat, lng)} onLocationDragEnd={({ lat, lng }) => updateCoordinates(lat, lng)} />
      </section>
      <aside className="dashboard-panel border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-[#0b1f3a]">Named locations</h3><span className="text-xs font-bold text-slate-500">{locations.filter(hasCoordinates).length}/{locations.length} placed</span></div>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-slate-500">Loading locations...</p> : locations.map((location) => <button key={location.location_id} type="button" onClick={() => setSelectedId(location.location_id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === location.location_id ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 bg-slate-50 hover:border-cyan-200'}`}><span className="flex items-center justify-between gap-2"><strong className="text-sm text-[#0b1f3a]">{location.name}</strong><span className={`h-2.5 w-2.5 rounded-full ${hasCoordinates(location) ? 'bg-emerald-500' : 'bg-amber-400'}`} title={hasCoordinates(location) ? 'Placed' : 'Needs placement'} /></span><span className="mt-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{titleCase(location.type)}</span></button>)}
        </div>
        {selected && <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Selected location</p><p className="mt-1 font-black text-[#0b1f3a]">{selected.name}</p><p className="mt-2 text-xs text-slate-500">{hasCoordinates(selected) ? `${Number(selected.latitude).toFixed(7)}, ${Number(selected.longitude).toFixed(7)}` : 'Click its exact position on the map.'}</p><button type="button" className="dashboard-button primary mt-4 w-full" onClick={saveSelected} disabled={!hasCoordinates(selected) || saving}>{saving ? 'Saving...' : 'Save coordinates'}</button></div>}
        <p className="mt-4 text-xs leading-5 text-slate-500">Categories: {locationTypes.length}. Amber markers need an administrator to place them.</p>
      </aside>
    </div>
  </div>;
}
