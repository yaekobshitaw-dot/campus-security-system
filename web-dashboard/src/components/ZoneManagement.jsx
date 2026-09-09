import { useState } from 'react';
import api from '../services/api';

const polygonExample = `{
  "type": "Polygon",
  "coordinates": [
    [
      [38.74, 9.01],
      [38.75, 9.01],
      [38.75, 9.02],
      [38.74, 9.01]
    ]
  ]
}`;

const initialForm = {
  type: 'circle',
  name: '',
  description: '',
  center_lat: '',
  center_lng: '',
  radius: '',
  security_contact: '',
  is_active: true,
  coordinates: polygonExample,
};

const isNumberInRange = (value, minimum, maximum) => {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) return false;
  const number = Number(value);
  return number >= minimum && number <= maximum;
};

const parsePolygon = (value) => {
  let polygon;
  try {
    polygon = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error) {
    throw new Error('Polygon coordinates must be valid JSON.');
  }

  if (!polygon || typeof polygon !== 'object' || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) || !polygon.coordinates.length) {
    throw new Error('Coordinates must be a GeoJSON Polygon with at least one ring.');
  }

  polygon.coordinates.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error('Each polygon ring must contain at least four positions.');
    ring.forEach((position) => {
      if (!Array.isArray(position) || position.length !== 2 || !isNumberInRange(position[0], -180, 180) || !isNumberInRange(position[1], -90, 90)) {
        throw new Error('Each polygon position must be exactly [longitude, latitude] within valid ranges.');
      }
    });
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Each polygon ring must be closed.');
  });

  return polygon;
};

const polygonFromZone = (zone) => {
  try {
    const polygon = parsePolygon(zone.coordinates);
    return JSON.stringify(polygon, null, 2);
  } catch (error) {
    return polygonExample;
  }
};

const isPolygonZone = (zone) => {
  try {
    return parsePolygon(zone.coordinates).type === 'Polygon';
  } catch (error) {
    return false;
  }
};

const zoneType = (zone) => (isPolygonZone(zone) ? 'Polygon' : 'Circle');

const apiMessage = (requestError, fallback) => {
  const status = requestError.response?.status;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to manage zones.';
  if (status === 404) return 'Zone was not found. Refresh the list and try again.';
  if (status === 409) return requestError.response?.data?.message || 'A zone with this name already exists.';
  if (status === 400) return requestError.response?.data?.message || 'The zone data is invalid.';
  return requestError.response?.data?.message || fallback;
};

function ZoneForm({ zone, submitting, onClose, onSubmit }) {
  const [form, setForm] = useState(() => zone ? {
    type: isPolygonZone(zone) ? 'polygon' : 'circle',
    name: zone.name || '',
    description: zone.description || '',
    center_lat: zone.center_lat ?? '',
    center_lng: zone.center_lng ?? '',
    radius: zone.radius ?? '',
    security_contact: zone.security_contact || '',
    is_active: zone.is_active !== false,
    coordinates: polygonFromZone(zone),
  } : initialForm);
  const [error, setError] = useState('');

  const update = (field) => (event) => setForm((current) => ({
    ...current,
    [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
  }));

  const chooseType = (type) => setForm((current) => ({
    ...current,
    type,
    center_lat: type === 'circle' ? current.center_lat : '',
    center_lng: type === 'circle' ? current.center_lng : '',
    radius: type === 'circle' ? current.radius : '',
  }));

  const submit = (event) => {
    event.preventDefault();
    try {
      const name = form.name.trim();
      if (!name || name.length > 100) throw new Error('Name is required and must be 100 characters or fewer.');

      if (form.type === 'circle') {
        if (!isNumberInRange(form.center_lat, -90, 90)) throw new Error('Center latitude must be between -90 and 90.');
        if (!isNumberInRange(form.center_lng, -180, 180)) throw new Error('Center longitude must be between -180 and 180.');
        if (!Number.isInteger(Number(form.radius)) || Number(form.radius) <= 0) throw new Error('Radius must be a positive integer in meters.');
        onSubmit({
          name,
          description: form.description.trim(),
          coordinates: null,
          center_lat: Number(form.center_lat),
          center_lng: Number(form.center_lng),
          radius: Number(form.radius),
          security_contact: form.security_contact.trim(),
          is_active: form.is_active,
        });
        return;
      }

      onSubmit({
        name,
        description: form.description.trim(),
        coordinates: parsePolygon(form.coordinates),
        center_lat: null,
        center_lng: null,
        radius: null,
        security_contact: form.security_contact.trim(),
        is_active: form.is_active,
      });
    } catch (validationError) {
      setError(validationError.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06162b]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="zone-form-title">
      <form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(8,29,53,0.28)]" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="dashboard-eyebrow">Zone management</p><h2 id="zone-form-title" className="mt-2 text-2xl font-black tracking-tight text-[#0b1f3a]">{zone ? 'Edit zone' : 'Create zone'}</h2><p className="mt-1 text-sm text-slate-500">Define a circle or GeoJSON polygon for campus coverage.</p></div>
          <button type="button" className="table-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" onClick={onClose} disabled={submitting}>Close</button>
        </div>
        {error && <div className="dashboard-error mt-5" role="alert">{error}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="form-field sm:col-span-2"><span>Zone type *</span><select value={form.type} onChange={(event) => chooseType(event.target.value)} disabled={submitting}><option value="circle">Circle</option><option value="polygon">Polygon</option></select></label>
          <label className="form-field"><span>Name *</span><input value={form.name} onChange={update('name')} maxLength="100" required disabled={submitting} /></label>
          <label className="form-field"><span>Security contact</span><input value={form.security_contact} onChange={update('security_contact')} disabled={submitting} /></label>
          <label className="form-field sm:col-span-2"><span>Description</span><textarea value={form.description} onChange={update('description')} rows="3" disabled={submitting} /></label>
          {form.type === 'circle' ? <>
            <label className="form-field"><span>Center latitude *</span><input type="number" step="any" min="-90" max="90" value={form.center_lat} onChange={update('center_lat')} required disabled={submitting} /></label>
            <label className="form-field"><span>Center longitude *</span><input type="number" step="any" min="-180" max="180" value={form.center_lng} onChange={update('center_lng')} required disabled={submitting} /></label>
            <label className="form-field"><span>Radius in meters *</span><input type="number" step="1" min="1" value={form.radius} onChange={update('radius')} required disabled={submitting} /></label>
          </> : <label className="form-field sm:col-span-2"><span>GeoJSON Polygon coordinates *</span><textarea value={form.coordinates} onChange={update('coordinates')} rows="10" spellCheck="false" required disabled={submitting} placeholder={polygonExample} /></label>}
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.is_active} onChange={update('is_active')} disabled={submitting} /> Active zone</label>
        <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" className="dashboard-button secondary" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" className="dashboard-button primary" disabled={submitting}>{submitting ? 'Saving...' : zone ? 'Save changes' : 'Create zone'}</button></div>
      </form>
    </div>
  );
}

export default function ZoneManagement({ zones = [], loading, error, canManage, onRefresh }) {
  const [formZone, setFormZone] = useState(undefined);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [requestError, setRequestError] = useState('');

  const mutate = async (request, successMessage) => {
    setSubmitting(true);
    setFeedback('');
    setRequestError('');
    try {
      await request();
      await onRefresh();
      setFeedback(successMessage);
      setFormZone(undefined);
      setDeleteTarget(null);
    } catch (requestException) {
      setRequestError(apiMessage(requestException, 'Zone request failed. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const saveZone = (payload) => mutate(
    () => formZone?.zone_id ? api.patch(`/zones/${formZone.zone_id}`, payload) : api.post('/zones', payload),
    formZone?.zone_id ? 'Zone updated successfully.' : 'Zone created successfully.',
  );

  const toggleZone = (zone) => mutate(
    () => api.patch(`/zones/${zone.zone_id}`, { is_active: zone.is_active === false }),
    zone.is_active === false ? 'Zone activated successfully.' : 'Zone deactivated successfully.',
  );

  const deleteZone = () => mutate(
    () => api.delete(`/zones/${deleteTarget.zone_id}`),
    'Zone deleted successfully.',
  );

  return (
    <div className="space-y-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-eyebrow">Coverage controls</p><h2 className="mt-2 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">Zones</h2><span className="mt-1 block text-sm leading-6 text-slate-500">Manage active campus coverage zones and their geometry.</span></div>{canManage && <button type="button" className="dashboard-button primary" onClick={() => { setFeedback(''); setRequestError(''); setFormZone(null); }}>Create zone</button>}</div>
      {(error || requestError) && <div className="dashboard-error" role="alert"><div><strong>Zone management issue</strong><p>{requestError || error}</p></div><button type="button" className="table-action" onClick={requestError ? () => setRequestError('') : onRefresh}>Retry</button></div>}
      {feedback && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">{feedback}</div>}
      {loading ? <div className="inline-loading">Loading zones...</div> : zones.length ? <div className="grid gap-5 lg:grid-cols-2">{zones.map((zone) => <article key={zone.zone_id} className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-black text-[#0b1f3a]">{zone.name}</p><p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{zoneType(zone)} · {zone.is_active === false ? 'Inactive' : 'Active'}</p></div><span className={`status-badge ${zone.is_active === false ? '' : 'resolved'}`}>{zone.is_active === false ? 'Inactive' : 'Active'}</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{zone.description || 'No description provided.'}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Radius</dt><dd className="mt-1 font-semibold text-slate-800">{zone.radius ? `${zone.radius} m` : 'Not applicable'}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Security contact</dt><dd className="mt-1 font-semibold text-slate-800">{zone.security_contact || 'Not provided'}</dd></div></dl>{canManage && <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="table-action" onClick={() => { setFeedback(''); setRequestError(''); setFormZone(zone); }} disabled={submitting}>Edit</button><button type="button" className="table-action" onClick={() => toggleZone(zone)} disabled={submitting}>{zone.is_active === false ? 'Activate' : 'Deactivate'}</button><button type="button" className="table-action border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDeleteTarget(zone)} disabled={submitting}>Delete</button></div>}</article>)}</div> : <div className="dashboard-panel border-dashed bg-white"><h3 className="text-lg font-black text-[#0b1f3a]">No zones configured yet.</h3><p className="mt-2 text-sm text-slate-500">Create a circle or polygon zone to define campus coverage.</p></div>}
      {formZone !== undefined && <ZoneForm zone={formZone} submitting={submitting} onClose={() => setFormZone(undefined)} onSubmit={saveZone} />}
      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06162b]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="zone-delete-title"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(8,29,53,0.28)]"><p className="dashboard-eyebrow">Destructive action</p><h2 id="zone-delete-title" className="mt-2 text-xl font-black text-[#0b1f3a]">Delete {deleteTarget.name}?</h2><p className="mt-3 text-sm leading-6 text-slate-600">You are permanently deleting this zone. This action cannot be undone.</p><div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" className="dashboard-button secondary" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</button><button type="button" className="dashboard-button primary border-red-700 bg-red-700 hover:bg-red-800" onClick={deleteZone} disabled={submitting}>{submitting ? 'Deleting...' : 'Delete permanently'}</button></div></div></div>}
    </div>
  );
}
