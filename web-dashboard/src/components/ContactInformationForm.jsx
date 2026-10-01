import { useEffect, useState } from 'react';
import api from '../services/api';

const emptyContactInformation = { phone: '', email: '', location: '' };

export default function ContactInformationForm() {
  const [contactInformation, setContactInformation] = useState(emptyContactInformation);
  const [savedInformation, setSavedInformation] = useState(emptyContactInformation);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get('/content/contact')
      .then((response) => {
        if (!mounted) return;
        const values = { ...emptyContactInformation, ...response.data?.data };
        setContactInformation(values);
        setSavedInformation(values);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || 'Unable to load contact information.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const update = (field, value) => {
    setContactInformation((current) => ({ ...current, [field]: value }));
    setSuccess('');
  };

  const cancel = () => {
    setContactInformation(savedInformation);
    setError('');
    setSuccess('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.put('/content/contact', contactInformation);
      const values = { ...emptyContactInformation, ...response.data?.data };
      setContactInformation(values);
      setSavedInformation(values);
      setSuccess('Contact information saved.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save contact information.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="inline-loading" role="status">Loading contact information...</div>;

  return (
    <section className="dashboard-panel space-y-5 border-slate-200/80 bg-white" aria-labelledby="contact-information-heading">
      <div>
        <p className="dashboard-eyebrow">Public information</p>
        <h3 id="contact-information-heading" className="mt-1 text-lg font-black text-[#0b1f3a]">Contact Us Information</h3>
      </div>
      {error && <div className="dashboard-error" role="alert">{error}</div>}
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
        <label className="form-field">
          <span>Phone</span>
          <input aria-label="Phone" type="tel" value={contactInformation.phone} onChange={(event) => update('phone', event.target.value)} required />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input aria-label="Email" type="email" value={contactInformation.email} onChange={(event) => update('email', event.target.value)} required />
        </label>
        <label className="form-field sm:col-span-2">
          <span>Location</span>
          <input aria-label="Location" value={contactInformation.location} onChange={(event) => update('location', event.target.value)} required />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="dashboard-button primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button type="button" className="dashboard-button" onClick={cancel} disabled={saving}>Cancel</button>
          {success && <span className="text-sm font-bold text-emerald-700" role="status">{success}</span>}
        </div>
      </form>
    </section>
  );
}
