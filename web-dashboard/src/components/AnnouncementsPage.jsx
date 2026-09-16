import { CampaignOutlined, CheckCircleOutline, Close, DeleteOutline, EditOutlined, PublishOutlined, Refresh, VisibilityOffOutlined } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  getAnnouncementUnreadCount,
  listAnnouncements,
  markAnnouncementRead,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
} from '../services/announcements';

const roles = ['student', 'faculty', 'staff', 'security', 'admin'];
const priorities = ['low', 'medium', 'high', 'critical'];
const statusFilters = ['all', 'draft', 'published', 'unpublished', 'expired'];
const priorityClasses = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
};
const priorityDotClasses = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};
const roleChipClasses = {
  active: 'border-emerald-500 bg-emerald-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.28)]',
  inactive: 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
};

const emptyForm = { title: '', content: '', priority: 'medium', target_roles: [], expires_at: '' };
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Not set');
const isExpired = (announcement) => Boolean(announcement.expires_at && new Date(announcement.expires_at) <= new Date());
const requestMessage = (error, fallback) => error.response?.data?.message || fallback;

const Heading = ({ title, description, action }) => (
  <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="dashboard-eyebrow">Campus communications</p>
      <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </div>
);

const PriorityBadge = ({ priority }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${priorityClasses[priority] || priorityClasses.medium}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${priorityDotClasses[priority] || priorityDotClasses.medium}`} />
    {priority}
  </span>
);

function AnnouncementForm({ initialValue, onCancel, onSubmit, saving, error }) {
  const [form, setForm] = useState(initialValue || emptyForm);
  const isEditing = Boolean(initialValue?.announcement_id);
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleRole = (role) => setForm((current) => ({
    ...current,
    target_roles: current.target_roles.includes(role)
      ? current.target_roles.filter((item) => item !== role)
      : [...current.target_roles, role],
  }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.09)]"
      aria-label={isEditing ? 'Edit announcement form' : 'Create announcement form'}
    >
      <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50/80 to-white px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
            <CampaignOutlined className="text-[20px]" />
          </div>
          <div>
            <p className="dashboard-eyebrow">Admin editor</p>
            <h3 className="mt-1 text-lg font-black text-[#0b1f3a]">{isEditing ? 'Edit announcement' : 'Create announcement'}</h3>
          </div>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          onClick={onCancel}
          aria-label="Close announcement form"
        >
          <Close className="text-[18px]" />
        </button>
      </div>

      {error && <div className="dashboard-error mx-6 mt-5" role="alert">{error}</div>}

      <div className="grid gap-6 px-6 pb-2 pt-6 lg:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">
          Title
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            placeholder="e.g. Campus safety drill on Friday"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            maxLength={255}
            required
          />
        </label>

        <label className="block text-sm font-bold text-slate-700">
          Priority
          <div className="relative mt-2">
            <span className={`pointer-events-none absolute left-3.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${priorityDotClasses[form.priority]}`} />
            <select
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-7 pr-9 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              value={form.priority}
              onChange={(event) => setField('priority', event.target.value)}
            >
              {priorities.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
          </div>
        </label>

        <label className="block text-sm font-bold text-slate-700 lg:col-span-2">
          Content
          <textarea
            className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            placeholder="Write the announcement details here..."
            value={form.content}
            onChange={(event) => setField('content', event.target.value)}
            maxLength={10000}
            required
          />
        </label>

        <fieldset className="lg:col-span-2">
          <legend className="text-sm font-bold text-slate-700">Target roles</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {roles.map((role) => {
              const active = form.target_roles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? roleChipClasses.active : roleChipClasses.inactive}`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? 'border-white/70 bg-white/20' : 'border-slate-300'}`}>
                    {active && <CheckCircleOutline className="text-[13px] text-white" />}
                  </span>
                  {titleCase(role)}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs font-medium text-slate-400">Choose at least one role before publishing.</p>
        </fieldset>

        <label className="block text-sm font-bold text-slate-700">
          Optional expiry
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            type="datetime-local"
            value={form.expires_at}
            onChange={(event) => setField('expires_at', event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_20px_rgba(16,185,129,0.28)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
        >
          {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Save draft'}
        </button>
      </div>
    </form>
  );
}

const AnnouncementCard = ({ announcement, admin, onOpen, onEdit, onPublish, onUnpublish, onDelete }) => (
  <article className={`dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${!announcement.is_read ? 'ring-2 ring-emerald-100' : ''}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-[#0b1f3a]">{announcement.title}</h3>{!announcement.is_read && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">Unread</span>}</div><div className="mt-2 flex flex-wrap items-center gap-2"><PriorityBadge priority={announcement.priority} /><span className="text-xs text-slate-500">{announcement.status === 'published' ? `Published ${formatDate(announcement.published_at)}` : titleCase(announcement.status)}</span></div></div>
      <button type="button" className="table-action" onClick={() => onOpen(announcement)}>{announcement.is_read ? 'Open' : 'Open and mark read'}</button>
    </div>
    <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">{announcement.content}</p>
    {admin && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex flex-wrap gap-1.5">{announcement.target_roles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{role}</span>)}</div><div className="flex flex-wrap gap-2"><button type="button" className="table-action" onClick={() => onEdit(announcement)}><EditOutlined className="mr-1 text-[15px]" />Edit</button>{announcement.status === 'published' ? <button type="button" className="table-action" onClick={() => onUnpublish(announcement.announcement_id)}><VisibilityOffOutlined className="mr-1 text-[15px]" />Unpublish</button> : <button type="button" className="table-action" onClick={() => onPublish(announcement.announcement_id)}><PublishOutlined className="mr-1 text-[15px]" />Publish</button>}<button type="button" className="table-action text-red-700" onClick={() => onDelete(announcement.announcement_id)}><DeleteOutline className="mr-1 text-[15px]" />Delete</button></div></div>}
  </article>
);

function AnnouncementDetail({ announcement, onClose, onMarkRead }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#081d35]/45 p-4" role="dialog" aria-modal="true" aria-label="Announcement details"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="dashboard-eyebrow">Announcement</p><h3 className="mt-1 text-xl font-black text-[#0b1f3a]">{announcement.title}</h3></div><button type="button" className="dashboard-icon-button" onClick={onClose} aria-label="Close announcement"><Close className="text-[18px]" /></button></div><div className="mt-4 flex flex-wrap items-center gap-2"><PriorityBadge priority={announcement.priority} /><span className="text-xs text-slate-500">Published {formatDate(announcement.published_at)}</span></div><p className="mt-6 whitespace-pre-line text-sm leading-7 text-slate-700">{announcement.content}</p><div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">{announcement.expires_at ? `Expires ${formatDate(announcement.expires_at)}` : 'No expiry set'}</div>{!announcement.is_read && <button type="button" className="dashboard-button primary mt-5" onClick={onMarkRead}>Mark as read</button>}</div></div>;
}

export default function AnnouncementsPage({ user }) {
  const admin = user?.role === 'admin';
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [selected, setSelected] = useState(null);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const [listResponse, countResponse] = await Promise.all([listAnnouncements(), getAnnouncementUnreadCount()]);
      setAnnouncements(listResponse.data?.data || []);
      setUnreadCount(Number(countResponse.data?.data?.count || 0));
    } catch (requestError) {
      setError(requestMessage(requestError, 'Unable to load announcements.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnnouncements(); }, []);

  const visibleAnnouncements = useMemo(() => announcements.filter((announcement) => {
    if (filter === 'expired') return isExpired(announcement);
    return filter === 'all' || announcement.status === filter;
  }), [announcements, filter]);

  const openAnnouncement = async (announcement) => {
    setError('');
    try {
      const response = await getAnnouncement(announcement.announcement_id);
      const detail = response.data?.data || announcement;
      setSelected(detail);
      if (!detail.is_read) {
        await markAnnouncementRead(detail.announcement_id);
        setSelected((current) => current ? { ...current, is_read: true } : current);
        setAnnouncements((current) => current.map((item) => item.announcement_id === detail.announcement_id ? { ...item, is_read: true } : item));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch (requestError) {
      setError(requestMessage(requestError, 'Unable to open announcement.'));
    }
  };

  const markSelectedRead = async () => {
    if (!selected || selected.is_read) return;
    try {
      await markAnnouncementRead(selected.announcement_id);
      setSelected((current) => ({ ...current, is_read: true }));
      setAnnouncements((current) => current.map((item) => item.announcement_id === selected.announcement_id ? { ...item, is_read: true } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (requestError) {
      setError(requestMessage(requestError, 'Unable to mark announcement as read.'));
    }
  };

  const saveAnnouncement = async (payload) => {
    setSaving(true);
    setEditorError('');
    try {
      if (editor?.announcement_id) await updateAnnouncement(editor.announcement_id, payload);
      else await createAnnouncement(payload);
      setEditor(null);
      await loadAnnouncements();
    } catch (requestError) {
      setEditorError(requestMessage(requestError, 'Unable to save announcement.'));
    } finally {
      setSaving(false);
    }
  };

  const runAdminAction = async (action, fallback) => {
    try {
      setError('');
      await action();
      await loadAnnouncements();
    } catch (requestError) {
      setError(requestMessage(requestError, fallback));
    }
  };

  const editAnnouncement = (announcement) => setEditor({ ...announcement, expires_at: announcement.expires_at ? new Date(announcement.expires_at).toISOString().slice(0, 16) : '' });
  const action = admin ? <button type="button" className="dashboard-button primary" onClick={() => { setEditorError(''); setEditor(emptyForm); }}><CampaignOutlined className="text-[18px]" />Create announcement</button> : <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{unreadCount} unread</span>;

  return <div className="space-y-8"><Heading title="Announcements" description={admin ? 'Create and manage campus communications.' : 'Published campus communications for your account.'} action={<><button type="button" className="dashboard-button" onClick={loadAnnouncements}><Refresh className="text-[18px]" />Refresh</button>{action}</>} />{error && <div className="dashboard-error" role="alert">{error}</div>}{admin && editor && <AnnouncementForm initialValue={editor} onCancel={() => setEditor(null)} onSubmit={saveAnnouncement} saving={saving} error={editorError} />}{admin && <div className="flex flex-wrap items-center gap-2" aria-label="Announcement filters">{statusFilters.map((status) => <button key={status} type="button" className={`rounded-full border px-3 py-1.5 text-xs font-black ${filter === status ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`} onClick={() => setFilter(status)}>{titleCase(status)}</button>)}</div>}{loading ? <div className="inline-loading">Loading announcements...</div> : visibleAnnouncements.length ? <div className="grid gap-5 lg:grid-cols-2">{visibleAnnouncements.map((announcement) => <AnnouncementCard key={announcement.announcement_id} announcement={announcement} admin={admin} onOpen={openAnnouncement} onEdit={editAnnouncement} onPublish={(id) => runAdminAction(() => publishAnnouncement(id), 'Unable to publish announcement.')} onUnpublish={(id) => runAdminAction(() => unpublishAnnouncement(id), 'Unable to unpublish announcement.')} onDelete={(id) => { if (window.confirm('Delete this announcement?')) runAdminAction(() => deleteAnnouncement(id), 'Unable to delete announcement.'); }} />)}</div> : <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><CheckCircleOutline className="mb-3 rounded-2xl bg-emerald-50 p-3 text-[54px] text-emerald-700 ring-1 ring-emerald-100" /><h3 className="text-lg font-black text-[#0b1f3a]">No announcements</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">There are no announcements matching this view.</p></div>}{selected && <AnnouncementDetail announcement={selected} onClose={() => setSelected(null)} onMarkRead={markSelectedRead} />}</div>;
}