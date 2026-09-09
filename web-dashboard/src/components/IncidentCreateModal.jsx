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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06162b]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="incident-create-title">
      <form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(8,29,53,0.28)]" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="dashboard-eyebrow">Incident intake</p><h2 id="incident-create-title" className="mt-2 text-2xl font-black tracking-tight text-[#0b1f3a]">Report an incident</h2><p className="mt-1 text-sm text-slate-500">Provide enough context for the response team to act.</p></div>
          <button type="button" className="table-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" onClick={onClose} aria-label="Close incident form">Close</button>
        </div>
        {error && <div className="dashboard-error mt-5" role="alert">{error}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Incident type *</span><select className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.type} onChange={update('type')} required><option value="">Select type</option>{incidentTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Severity *</span><select className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.severity} onChange={update('severity')} required>{severityOptions.map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 sm:col-span-2"><span>Description *</span><textarea className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.description} onChange={update('description')} rows="4" required placeholder="Describe what happened and who may need help." /></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Location name</span><input className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.location_name} onChange={update('location_name')} placeholder="North quad" /></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Building</span><input className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.building} onChange={update('building')} placeholder="Science block" /></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Room</span><input className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.room} onChange={update('room')} placeholder="204" /></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Floor</span><input className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" value={form.floor} onChange={update('floor')} placeholder="2" /></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Latitude</span><input className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={update('latitude')} placeholder="Optional" /></label>
          <label className="flex flex-col gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Longitude</span><input className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={update('longitude')} placeholder="Optional" /></label>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.is_anonymous} onChange={update('is_anonymous')} /> Report anonymously</label>
        <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" className="dashboard-button secondary" onClick={onClose}>Cancel</button><button type="submit" className="dashboard-button primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Report incident'}</button></div>
      </form>
    </div>
  );
}

export default IncidentCreateModal;
