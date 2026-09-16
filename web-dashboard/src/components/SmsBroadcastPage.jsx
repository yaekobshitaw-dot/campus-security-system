import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import Refresh from '@mui/icons-material/Refresh';
import SmsOutlined from '@mui/icons-material/SmsOutlined';
import { useEffect, useMemo, useState } from 'react';
import { listSmsHistory, listSmsRecipients, sendSmsBroadcast } from '../services/sms';

const roleFilters = [
  { value: 'all', label: 'All users' },
  { value: 'student', label: 'Students' },
  { value: 'security', label: 'Security officers' },
];

const requestMessage = (error, fallback) => error?.response?.data?.message || fallback;
const makeIdempotencyKey = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `sms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const statusClass = {
  sent: 'bg-emerald-50 text-emerald-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  queued: 'bg-amber-50 text-amber-700',
};

export default function SmsBroadcastPage() {
  const [role, setRole] = useState('all');
  const [recipients, setRecipients] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [recipientResponse, historyResponse] = await Promise.all([listSmsRecipients(role), listSmsHistory()]);
      setRecipients(recipientResponse.data?.data || []);
      setHistory(historyResponse.data?.data || []);
      setSelectedIds(new Set());
    } catch (requestError) {
      setError(requestMessage(requestError, 'Unable to load SMS recipients and history.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [role]);

  const validRecipients = useMemo(() => recipients.filter((recipient) => recipient.phone_valid), [recipients]);
  const allSelected = validRecipients.length > 0 && validRecipients.every((recipient) => selectedIds.has(recipient.user_id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(validRecipients.map((recipient) => recipient.user_id)));
  };

  const toggleRecipient = (userId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const sendBroadcast = async () => {
    if (!selectedIds.size || !message.trim() || sending) return;
    if (!window.confirm(`Send this SMS to ${selectedIds.size} selected recipient${selectedIds.size === 1 ? '' : 's'}?`)) return;

    setSending(true);
    setError('');
    setResult(null);
    try {
      const response = await sendSmsBroadcast({
        recipientUserIds: [...selectedIds],
        message,
        idempotencyKey: makeIdempotencyKey(),
      });
      setResult(response.data?.data || null);
      setMessage('');
      setSelectedIds(new Set());
      const historyResponse = await listSmsHistory();
      setHistory(historyResponse.data?.data || []);
    } catch (requestError) {
      setError(requestMessage(requestError, 'Unable to send the SMS broadcast.'));
    } finally {
      setSending(false);
    }
  };

  return <div className="space-y-8">
    <div className="dashboard-heading mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="dashboard-eyebrow">Admin communications</p><h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">SMS broadcast</h2><p className="mt-1 block max-w-2xl text-sm leading-6 text-slate-500">Send a direct cellular SMS to selected active campus users.</p></div>
      <button type="button" className="dashboard-button" onClick={loadData} disabled={loading}><Refresh className="text-[18px]" /> Refresh</button>
    </div>
    {error && <div className="dashboard-error" role="alert"><ErrorOutline /><span>{error}</span></div>}
    {result && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status"><strong>Broadcast complete.</strong> {result.successful || 0} successful, {result.failed || 0} failed, {result.queued || 0} queued.</div>}
    <section className="dashboard-panel space-y-5 border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="dashboard-eyebrow">Recipients</p><h3 className="mt-1 text-lg font-black text-[#0b1f3a]">Choose who receives this message</h3></div><div className="flex flex-wrap gap-2" role="group" aria-label="Recipient filters">{roleFilters.map((filter) => <button type="button" key={filter.value} className={`rounded-full border px-3 py-1.5 text-xs font-black ${role === filter.value ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`} onClick={() => setRole(filter.value)}>{filter.label}</button>)}</div></div>
      <label className="flex items-center gap-3 border-b border-slate-100 pb-3 text-sm font-black text-[#0b1f3a]"><input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!validRecipients.length || loading} /> Select all valid recipients <span className="font-normal text-slate-500">({validRecipients.length})</span></label>
      {loading ? <div className="inline-loading">Loading recipients...</div> : recipients.length ? <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-slate-200"><table className="dashboard-table"><thead><tr><th>Select</th><th>Name</th><th>Role</th><th>Phone</th></tr></thead><tbody>{recipients.map((recipient) => <tr key={recipient.user_id}><td><input type="checkbox" checked={selectedIds.has(recipient.user_id)} onChange={() => toggleRecipient(recipient.user_id)} disabled={!recipient.phone_valid} aria-label={`Select ${recipient.name}`} /></td><td className="font-bold text-[#0b1f3a]">{recipient.name}</td><td>{recipient.role}</td><td className={recipient.phone_valid ? 'text-slate-600' : 'text-red-600'}>{recipient.phone || 'No phone on file'}{!recipient.phone_valid && <span className="ml-2 text-xs">Invalid</span>}</td></tr>)}</tbody></table></div> : <div className="flex min-h-[150px] flex-col items-center justify-center text-center text-slate-500"><PeopleAltOutlined className="mb-2 text-[38px] text-slate-300" />No active users found.</div>}
    </section>
    <section className="dashboard-panel space-y-5 border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div><p className="dashboard-eyebrow">Message</p><h3 className="mt-1 text-lg font-black text-[#0b1f3a]">Compose SMS</h3></div>
      <textarea className="min-h-[140px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 1600))} maxLength={1600} placeholder="Write a campus safety message..." aria-label="SMS message" />
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{message.length} / 1600 characters</span><button type="button" className="dashboard-button primary" onClick={sendBroadcast} disabled={sending || !selectedIds.size || !message.trim()}><SmsOutlined className="text-[18px]" />{sending ? 'Sending...' : `Send SMS (${selectedIds.size})`}</button></div>
    </section>
    <section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><div className="mb-4 flex items-center gap-2"><CheckCircleOutline className="text-emerald-600" /><div><p className="dashboard-eyebrow">Delivery records</p><h3 className="mt-1 text-lg font-black text-[#0b1f3a]">SMS history</h3></div></div>{history.length ? <div className="overflow-x-auto"><table className="dashboard-table"><thead><tr><th>Recipient</th><th>Phone</th><th>Message</th><th>Status</th><th>Created</th></tr></thead><tbody>{history.map((item) => <tr key={item.sms_id}><td className="font-bold text-[#0b1f3a]">{item.name || item.user_id}</td><td>{item.phone}</td><td className="max-w-[320px] truncate">{item.message}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status}</span>{item.error && <p className="mt-1 max-w-[220px] text-xs text-red-600">{item.error}</p>}</td><td className="whitespace-nowrap text-xs text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No SMS records yet.</p>}</section>
  </div>;
}
