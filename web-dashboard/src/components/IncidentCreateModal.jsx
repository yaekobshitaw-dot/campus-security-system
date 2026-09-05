import { useState } from 'react';
import api from '../services/api';

const incidentTypes = [
  'fire', 'medical', 'security_threat', 'suspicious_package', 'flood',
  'power_outage', 'missing_person', 'natural_disaster', 'assault',
  'theft', 'vandalism', 'other'
];
const severityOptions = ['low', 'medium', 'high', 'critical'];
const initialForm = {
  type: '', description: '', severity: 'medium', location_name: '',
  building: '', room: '', floor: '', latitude: '', longitude: '', is_anonymous: false
};

function IncidentCreateModal({ onClose, onSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (event) => setForm((current) => ({
    ...current,
    [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.type || !form.description.trim()) {
      setError('Incident type and description are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...form, description: form.description.trim() };
      ['latitude', 'longitude'].forEach((field) => {
        if (payload[field] === '') delete payload[field];
      });
      await api.post('/incidents', payload);
      onSuccess();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to report incident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="incident-create-title">
      <form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="dashboard-eyebrow">Incident intake</p><h2 id="incident-create-title" className="mt-2 text-2xl font-black text-slate-950">Report an incident</h2><p className="mt-1 text-sm text-slate-500">Provide enough context for the response team to act.</p></div>
          <button type="button" className="table-action" onClick={onClose} aria-label="Close incident form">Close</button>
        </div>
        {error && <div className="dashboard-error mt-5" role="alert">{error}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="form-field"><span>Incident type *</span><select value={form.type} onChange={update('type')} required><option value="">Select type</option>{incidentTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="form-field"><span>Severity *</span><select value={form.severity} onChange={update('severity')} required>{severityOptions.map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label>
          <label className="form-field sm:col-span-2"><span>Description *</span><textarea value={form.description} onChange={update('description')} rows="4" required placeholder="Describe what happened and who may need help." /></label>
          <label className="form-field"><span>Location name</span><input value={form.location_name} onChange={update('location_name')} placeholder="North quad" /></label>
          <label className="form-field"><span>Building</span><input value={form.building} onChange={update('building')} placeholder="Science block" /></label>
          <label className="form-field"><span>Room</span><input value={form.room} onChange={update('room')} placeholder="204" /></label>
          <label className="form-field"><span>Floor</span><input value={form.floor} onChange={update('floor')} placeholder="2" /></label>
          <label className="form-field"><span>Latitude</span><input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={update('latitude')} placeholder="Optional" /></label>
          <label className="form-field"><span>Longitude</span><input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={update('longitude')} placeholder="Optional" /></label>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.is_anonymous} onChange={update('is_anonymous')} /> Report anonymously</label>
        <div className="mt-6 flex justify-end gap-3"><button type="button" className="dashboard-button secondary" onClick={onClose}>Cancel</button><button type="submit" className="dashboard-button primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Report incident'}</button></div>
      </form>
    </div>
  );
}

export default IncidentCreateModal;
