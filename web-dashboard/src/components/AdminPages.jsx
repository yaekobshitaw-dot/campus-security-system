import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AnnouncementsPage from './AnnouncementsPage';
import { useTranslate } from '../utils/language';
import ContactInformationForm from './ContactInformationForm';

const titleCase = (value) => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Unknown';
const normalizeNotification = (item) => ({
  ...item,
  data: item.type === 'contact_message' && typeof item.data === 'string' ? JSON.parse(item.data) : item.data,
  is_read: item.is_read === true || item.is_read === 1 || (
    typeof item.is_read === 'string' && ['1', 'true'].includes(item.is_read.trim().toLowerCase())
  ),
});

function PageShell({ eyebrow, title, description, children, onRefresh, loading, illustration }) {
  const t = useTranslate();
  return <div className="space-y-8"><div className="dashboard-heading mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex min-w-0 items-center gap-3">{illustration && <img className="h-10 w-10 shrink-0 rounded-xl border border-sky-100 bg-sky-50 p-1 object-contain sm:h-12 sm:w-12" src={`/images/dashboard-features/${illustration.file}`} alt={illustration.alt} width="48" height="48" />}<div className="min-w-0"><p className="dashboard-eyebrow">{t(eyebrow)}</p><h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">{t(title)}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{t(description)}</p></div></div>{onRefresh && <button type="button" className="dashboard-button self-start sm:self-auto" onClick={onRefresh} disabled={loading}>{t('Refresh')}</button>}</div>{children}</div>;
}

const State = ({ loading, error, empty, children, onRetry }) => {
  const t = useTranslate();
  if (loading) return <div className="inline-loading">{t('Loading...')}</div>;
  if (error) return <div className="dashboard-error" role="alert"><span>{t(error)}</span><button type="button" className="table-action" onClick={onRetry}>{t('Retry')}</button></div>;
  if (empty) return <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">{t('Nothing to display.')}</div>;
  return children;
};

export function NotificationsPage({ user, onUnreadCountChange = () => {}, onHistoryCleared = () => {}, onNotificationsChange = () => {} }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications');
      const nextItems = (response.data?.data || []).map(normalizeNotification);
      setItems(nextItems);
      onUnreadCountChange(nextItems.filter((item) => !item.is_read).length);
      onNotificationsChange(nextItems);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const markAllRead = () => setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    const clearItems = () => setItems([]);
    window.addEventListener('campussecure:notifications-read-all', markAllRead);
    window.addEventListener('campussecure:notifications-cleared', clearItems);
    return () => {
      window.removeEventListener('campussecure:notifications-read-all', markAllRead);
      window.removeEventListener('campussecure:notifications-cleared', clearItems);
    };
  }, []);
  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      const nextItems = items.map((item) => item.notification_id === id ? { ...item, is_read: true } : item);
      setItems(nextItems);
      onNotificationsChange(nextItems);
      if (items.some((item) => item.notification_id === id && !item.is_read)) {
        onUnreadCountChange(Math.max(0, items.filter((item) => !item.is_read).length - 1));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update notification.');
    }
  };
  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      const nextItems = items.map((item) => ({ ...item, is_read: true }));
      setItems(nextItems);
      onNotificationsChange(nextItems);
      onUnreadCountChange(0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update notifications.');
    }
  };
  const clearHistory = async () => {
    if (clearing || !window.confirm("Clear your notification history? This won't delete incidents or other operational records.")) return;
    setClearing(true);
    setError('');
    try {
      await api.delete('/notifications/history');
      setItems([]);
      onNotificationsChange([]);
      onUnreadCountChange(0);
      onHistoryCleared();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to clear notification history.');
    } finally {
      setClearing(false);
    }
  };
  const unreadCount = items.filter((item) => !item.is_read).length;
  return (
    <PageShell
      eyebrow="Campus communications"
      title="Notifications"
      description="Review notifications for your account, including incident, SOS, assignment, and system updates."
      onRefresh={load}
      loading={loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800" aria-label={`Unread notifications: ${unreadCount}`}>
          {unreadCount} unread
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="dashboard-button primary" onClick={markAllRead} disabled={!unreadCount}>Mark all as read</button>
          {user?.user_id && <button type="button" className="dashboard-button" onClick={clearHistory} disabled={!items.length || clearing}>{clearing ? 'Clearing...' : 'Clear'}</button>}
        </div>
      </div>
      <State loading={loading} error={error} empty={!items.length} onRetry={load}>
        <div className="dashboard-panel dashboard-table-scroll border-slate-200/80 bg-white">
          <table className="dashboard-table notification-table">
            <thead><tr><th>Notification</th><th>Type</th><th>Created</th><th className="status-cell">Status</th><th>Resource</th></tr></thead>
            <tbody>{items.map((item) => {
              const contactMessage = item.type === 'contact_message' ? item.data : null;
              return (
                <tr key={item.notification_id}>
                  <td className="font-bold text-[#0b1f3a]">
                    {item.title ? <><span className="block">{item.title}</span><span className="text-xs font-normal text-slate-500">{item.message}</span></> : item.message}
                    {contactMessage && <dl className="mt-3 grid gap-1 text-xs font-normal text-slate-600"><div><dt className="inline font-bold">Name: </dt><dd className="inline">{contactMessage.name}</dd></div><div><dt className="inline font-bold">Email: </dt><dd className="inline">{contactMessage.email}</dd></div><div><dt className="inline font-bold">Topic: </dt><dd className="inline">{titleCase(contactMessage.topic)}</dd></div><div><dt className="inline font-bold">Message: </dt><dd className="inline whitespace-pre-wrap">{contactMessage.message}</dd></div></dl>}
                  </td>
                  <td>{titleCase(item.type || 'system')}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td className="status-cell">{item.is_read ? 'Read' : 'Unread'}</td>
                  <td>
                    {item.link && <button type="button" className="table-action" onClick={() => { if (!item.is_read) markRead(item.notification_id); navigate(item.link); }}>Open</button>}
                    {!item.is_read && !item.link && <button type="button" className="table-action" aria-label={`Mark read: ${item.title || item.message}`} onClick={() => markRead(item.notification_id)}>Mark read</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </State>
    </PageShell>
  );
}

export function AuditLogsPage() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [query, setQuery] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const load = async () => { setLoading(true); setError(''); try { const params = { ...(query ? { q: query } : {}), ...(from ? { from } : {}), ...(to ? { to: `${to}T23:59:59.999Z` } : {}) }; const response = await api.get('/audit-logs', { params }); setItems(response.data?.data || []); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load audit logs.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const pageStart = (page - 1) * pageSize;
  const visibleItems = items.slice(pageStart, pageStart + pageSize);
  const rangeStart = items.length ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + pageSize, items.length);
  const firstVisiblePage = Math.max(1, page - 2);
  const lastVisiblePage = Math.min(totalPages, page + 2);
  const pageNumbers = Array.from({ length: lastVisiblePage - firstVisiblePage + 1 }, (_, index) => firstVisiblePage + index);

  return <PageShell eyebrow="Accountability" title="Audit logs" description="Server-generated records of security-sensitive administrative actions." onRefresh={load} loading={loading}><div className="dashboard-panel flex min-w-0 max-w-full flex-wrap gap-3 border-slate-200/80 bg-white"><input className="min-h-10 min-w-0 max-w-full flex-1 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Search action or resource" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} /><label className="flex items-center gap-2 text-xs font-bold text-slate-500">From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setCurrentPage(1); }} /></label><label className="flex items-center gap-2 text-xs font-bold text-slate-500">To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setCurrentPage(1); }} /></label><button type="button" className="dashboard-button" onClick={() => { setCurrentPage(1); load(); }}>Search</button></div><State loading={loading} error={error} empty={!items.length} onRetry={load}>  <div className="min-w-0 max-w-full"><div className="dashboard-panel dashboard-table-scroll max-w-full overflow-x-auto border-slate-200/80 bg-white"><table className="dashboard-table audit-table"><thead><tr><th>Administrator</th><th>Action</th><th>Resource</th><th>Details</th><th>Date</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.audit_id}><td>{item.actor?.name || item.actor_id || 'System'}</td><td className="font-bold">{titleCase(item.action)}</td><td>{titleCase(item.resource_type)} {item.resource_id ? `(${item.resource_id})` : ''}</td><td className="details-cell">{item.details || 'No details'}</td><td className="whitespace-nowrap">{formatDate(item.created_at)}</td></tr>)}</tbody></table></div><div className="flex min-w-0 flex-col gap-3 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600" aria-live="polite">Showing {rangeStart}–{rangeEnd} of {items.length}</p><nav className="flex min-w-0 flex-wrap items-center gap-1" aria-label="Audit log pagination"><button type="button" className="dashboard-button px-2.5 sm:px-3.5" onClick={() => setCurrentPage((pageNumber) => Math.max(1, pageNumber - 1))} disabled={page === 1} aria-label="Previous page">Previous</button>{firstVisiblePage > 1 && <><button type="button" className="dashboard-button px-3" onClick={() => setCurrentPage(1)} aria-label="Page 1">1</button>{firstVisiblePage > 2 && <span className="px-1 text-slate-500" aria-hidden="true">…</span>}</>}{pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" className={`dashboard-button px-3 ${pageNumber === page ? 'primary' : ''}`} onClick={() => setCurrentPage(pageNumber)} aria-label={`Page ${pageNumber}`} aria-current={pageNumber === page ? 'page' : undefined}>{pageNumber}</button>)}{lastVisiblePage < totalPages && <>{lastVisiblePage < totalPages - 1 && <span className="px-1 text-slate-500" aria-hidden="true">…</span>}<button type="button" className="dashboard-button px-3" onClick={() => setCurrentPage(totalPages)} aria-label={`Page ${totalPages}`}>{totalPages}</button></>}<button type="button" className="dashboard-button px-2.5 sm:px-3.5" onClick={() => setCurrentPage((pageNumber) => Math.min(totalPages, pageNumber + 1))} disabled={page === totalPages} aria-label="Next page">Next</button></nav></div></div></State></PageShell>;
}

export function SystemSettingsPage() {
  const [settings, setSettings] = useState([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = async () => { setLoading(true); setError(''); try { const response = await api.get('/settings'); setSettings(response.data?.data || []); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load system settings.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const save = async () => { setSaving(true); setError(''); setMessage(''); try { await api.put('/settings', { settings: settings.map(({ key, value }) => ({ key, value })) }); setMessage('Settings saved.'); await load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save system settings.'); } finally { setSaving(false); } };
  const systemActive = settings.find((setting) => setting.key === 'system.active')?.value !== 'false';
  const grouped = settings.filter((setting) => setting.key !== 'system.active').reduce((groups, setting) => ({ ...groups, [setting.category]: [...(groups[setting.category] || []), setting] }), {});
  const setSystemActive = async (active) => {
    setSaving(true); setError(''); setMessage('');
    try {
      await api.put('/settings', { settings: [{ key: 'system.active', value: active }] });
      setMessage(active ? 'System activated.' : 'System deactivated. Admin access remains available.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update system status.');
    } finally {
      setSaving(false);
    }
  };
  return <PageShell eyebrow="Configuration" title="System settings" description="Manage operational settings and application availability. Provider secrets remain server-side and are never returned." onRefresh={load} loading={loading} illustration={{ file: 'system-settings.svg', alt: 'System settings' }}><State loading={loading} error={error} empty={!settings.length} onRetry={load}><div className="space-y-5"><section className="dashboard-panel space-y-4 border-slate-200/80 bg-white"><div><p className="dashboard-eyebrow">System Management</p><h3 className="mt-1 text-lg font-black text-[#0b1f3a]">System Status</h3><p className="text-sm text-slate-600">Current status: <strong>{systemActive ? 'Active' : 'Deactivated'}</strong></p><p className="text-sm leading-6 text-slate-500">Deactivation blocks non-admin access to protected system APIs. Administrators can still sign in and activate the system here.</p></div><div className="flex flex-wrap gap-3"><button type="button" className="dashboard-button primary" onClick={() => setSystemActive(true)} disabled={saving || systemActive}>{saving ? 'Saving...' : 'Activate System'}</button><button type="button" className="dashboard-button" onClick={() => setSystemActive(false)} disabled={saving || !systemActive}>{saving ? 'Saving...' : 'Deactivate System'}</button></div>{message && <span className="text-sm font-bold text-emerald-700" role="status">{message}</span>}</section>{Object.entries(grouped).map(([category, values]) => <section className="dashboard-panel space-y-4 border-slate-200/80 bg-white" key={category}><div><p className="dashboard-eyebrow">{titleCase(category)}</p><h3 className="mt-1 text-lg font-black text-[#0b1f3a]">{titleCase(category)} settings</h3></div>{values.map((setting) => <label className="form-field" key={setting.key}><span>{titleCase(setting.key.split('.').slice(1).join(' '))}</span>{setting.type === 'boolean' ? <select value={setting.value} onChange={(event) => setSettings((current) => current.map((item) => item.key === setting.key ? { ...item, value: event.target.value } : item))}><option value="true">Enabled</option><option value="false">Disabled</option></select> : <input type={setting.type === 'integer' ? 'number' : 'text'} value={setting.value || ''} onChange={(event) => setSettings((current) => current.map((item) => item.key === setting.key ? { ...item, value: event.target.value } : item))} />}</label>)}</section>)}<div className="flex items-center gap-3"><button type="button" className="dashboard-button primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button></div></div></State></PageShell>;
}

export function ContentManagementPage({ user }) {
  const types = [{ key: 'faq', label: 'FAQ' }, { key: 'safety_resource', label: 'Safety resources' }, { key: 'emergency_contact', label: 'Emergency contacts' }, { key: 'service', label: 'Services / public information' }];
  const empty = { type: 'faq', title: '', summary: '', body: '', contact_name: '', phone: '', email: '', url: '', priority: 0, is_active: true };
  const [type, setType] = useState('faq'); const [items, setItems] = useState([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { const response = await api.get('/content', { params: { type } }); setItems(response.data?.data || []); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load content.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [type]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { const payload = { ...form, type, priority: Number(form.priority) || 0 }; const response = editing ? await api.patch(`/content/${editing.content_id}`, payload) : await api.post('/content', payload); setItems((current) => editing ? current.map((item) => item.content_id === editing.content_id ? response.data.data : item) : [response.data.data, ...current]); setForm({ ...empty, type }); setEditing(null); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save content.'); } finally { setSaving(false); } };
  const edit = (item) => { setEditing(item); setForm({ ...empty, ...item }); };
  const deactivate = async (item) => { if (!window.confirm(`Deactivate ${item.title}?`)) return; try { await api.delete(`/content/${item.content_id}`); setItems((current) => current.filter((entry) => entry.content_id !== item.content_id)); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to deactivate content.'); } };
  return (
    <div className="space-y-8">
      <ContactInformationForm />
      <PageShell
        eyebrow="Public information"
        title="Content management"
        description="Manage persisted FAQ, safety resources, emergency contacts, and campus services used by public pages."
        onRefresh={load}
        loading={loading}
      >
        <div className="flex flex-wrap gap-2">
          {types.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`dashboard-button ${type === item.key ? 'primary' : ''}`}
              onClick={() => {
                setType(item.key);
                setEditing(null);
                setForm({ ...empty, type: item.key });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error && <div className="dashboard-error" role="alert">{error}</div>}
        <form
          className="dashboard-panel grid gap-4 border-slate-200/80 bg-white sm:grid-cols-2"
          onSubmit={submit}
        >
          <h3 className="text-lg font-black text-[#0b1f3a] sm:col-span-2">
            {editing ? 'Edit content' : `Create ${types.find((item) => item.key === type)?.label}`}
          </h3>
          <label className="form-field">
            <span>Title</span>
            <input value={form.title} onChange={(event) => update('title', event.target.value)} required maxLength="255" />
          </label>
          <label className="form-field">
            <span>Priority</span>
            <input type="number" min="0" max="9999" value={form.priority} onChange={(event) => update('priority', event.target.value)} />
          </label>
          <label className="form-field sm:col-span-2">
            <span>Summary</span>
            <input value={form.summary || ''} onChange={(event) => update('summary', event.target.value)} />
          </label>
          {type !== 'emergency_contact' && (
            <label className="form-field sm:col-span-2">
              <span>Details</span>
              <textarea rows="4" value={form.body || ''} onChange={(event) => update('body', event.target.value)} />
            </label>
          )}
          {type === 'emergency_contact' && (
            <>
              <label className="form-field">
                <span>Contact name</span>
                <input value={form.contact_name || ''} onChange={(event) => update('contact_name', event.target.value)} />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input value={form.phone || ''} onChange={(event) => update('phone', event.target.value)} />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input type="email" value={form.email || ''} onChange={(event) => update('email', event.target.value)} />
              </label>
            </>
          )}
          {(type === 'safety_resource' || type === 'service') && (
            <label className="form-field">
              <span>Link</span>
              <input type="url" value={form.url || ''} onChange={(event) => update('url', event.target.value)} />
            </label>
          )}
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700 sm:col-span-2">
            <input type="checkbox" checked={form.is_active !== false} onChange={(event) => update('is_active', event.target.checked)} />
            Active on public pages
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="dashboard-button primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create content'}
            </button>
            {editing && (
              <button
                type="button"
                className="dashboard-button"
                onClick={() => {
                  setEditing(null);
                  setForm({ ...empty, type });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </PageShell>
      <State loading={loading} error="" empty={!items.length} onRetry={load}>
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <article className="dashboard-panel border-slate-200/80 bg-white" key={item.content_id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-[#0b1f3a]">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Priority {item.priority} · {item.is_active ? 'Active' : 'Inactive'} · {formatDate(item.updated_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="table-action" onClick={() => edit(item)}>Edit</button>
                  {item.is_active && (
                    <button type="button" className="table-action text-red-700" onClick={() => deactivate(item)}>
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.summary || item.body || item.phone || 'No description provided.'}
              </p>
            </article>
          ))}
        </div>
      </State>
    </div>
  );
}
