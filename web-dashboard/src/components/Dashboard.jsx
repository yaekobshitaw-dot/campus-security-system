import {
  CheckCircleOutline,
  ErrorOutline,
  PeopleAltOutlined,
  Refresh,
  ReportProblemOutlined,
  ShieldOutlined,
  WarningAmberOutlined
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DashboardLayout, IncidentTable } from './DashboardLayout';
import EvidencePreview from './EvidencePreview';
import IncidentMap from './dashboard/IncidentMap.jsx';

const activeStatuses = ['reported', 'investigating', 'dispatched', 'on_scene'];
const metricToneClasses = {
  slate: 'bg-slate-100 text-slate-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  teal: 'bg-teal-100 text-teal-700',
};
const routes = {
  '/dashboard': 'overview', '/incidents/active': 'incidents', '/incidents/history': 'history',
  '/map': 'map', '/sos': 'sos', '/emergency': 'emergency', '/evidence': 'evidence',
  '/officers': 'officers', '/users': 'users',
};
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function statsFor(incidents) {
  return incidents.reduce((stats, incident) => {
    const severity = incident.severity || 'medium';
    stats.total += 1;
    if (activeStatuses.includes(incident.status)) stats.active += 1;
    if (['resolved', 'closed'].includes(incident.status)) stats.resolved += 1;
    if (['critical', 'high', 'medium', 'low'].includes(severity)) stats[severity] += 1;
    if (incident.is_sos) stats.sos += 1;
    return stats;
  }, { total: 0, active: 0, resolved: 0, critical: 0, high: 0, medium: 0, low: 0, sos: 0 });
}

const Metric = ({ icon: Icon, label, value, tone = 'slate' }) => (
  <article className="dashboard-panel flex min-h-[142px] flex-col justify-between">
    <div className="flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${metricToneClasses[tone] || metricToneClasses.slate}`}><Icon className="text-[21px]" /></span><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Live</span></div>
    <div><p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-slate-950">{value}</p></div>
  </article>
);

const Heading = ({ eyebrow, title, description, action }) => (
  <div className="panel-heading"><div><p className="dashboard-eyebrow">{eyebrow}</p><h2 className="mt-2">{title}</h2>{description && <span className="mt-1 block">{description}</span>}</div>{action}</div>
);

const EmptyState = ({ icon: Icon = CheckCircleOutline, title, message }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><Icon className="mb-3 rounded-2xl bg-slate-100 p-3 text-[54px] text-slate-500" /><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-2 max-w-md text-sm text-slate-500">{message}</p></div>
);

function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const section = routes[location.pathname] || (location.pathname.startsWith('/incidents/') ? 'detail' : 'overview');

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([api.get('/incidents'), api.get('/alerts'), api.get('/users/all')]);
    const [incidentResult, alertResult, userResult] = results;
    if (incidentResult.status === 'fulfilled') setIncidents(incidentResult.value.data?.data || []);
    if (alertResult.status === 'fulfilled') setAlerts(alertResult.value.data?.data || []);
    if (userResult.status === 'fulfilled') setUsers(userResult.value.data?.data || []);
    if (results.every((result) => result.status === 'rejected')) setError('The dashboard API did not return data. Check the backend connection and your session.');
    else if (results.some((result) => result.status === 'rejected')) setError('Some dashboard data could not be loaded. Available data remains visible.');
    setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => statsFor(incidents), [incidents]);
  const active = useMemo(() => incidents.filter((incident) => activeStatuses.includes(incident.status)), [incidents]);
  const critical = useMemo(() => incidents.filter((incident) => incident.is_sos || incident.severity === 'critical'), [incidents]);
  const officers = useMemo(() => users.filter((user) => user.role === 'security'), [users]);
  const detail = selected || incidents.find((incident) => incident.incident_id === location.pathname.split('/').pop());
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const view = (incident) => { setSelected(incident); navigate(`/incidents/${incident.incident_id}`); };
  const changeStatus = async (incident, status) => { try { await api.patch(`/incidents/${incident.incident_id}/status`, { status }); await loadData(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update incident status.'); } };
  const refreshButton = <button type="button" className="dashboard-button" onClick={loadData}><Refresh className="text-[18px]" /> Refresh</button>;

  const table = (items, title, description) => <><Heading eyebrow="Incident operations" title={title} description={description} action={refreshButton} /><IncidentTable incidents={items} loading={loading} onView={view} onStatusChange={changeStatus} /></>;
  const overview = <div className="space-y-6"><Heading eyebrow="Security operations center" title="Campus overview" description="Live incident, response, and system activity from the campus security service." action={refreshButton} /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ReportProblemOutlined} label="Total incidents" value={stats.total} /><Metric icon={WarningAmberOutlined} label="Active incidents" value={stats.active} tone="amber" /><Metric icon={ShieldOutlined} label="Critical / SOS" value={critical.length} tone="red" /><Metric icon={PeopleAltOutlined} label="Security officers" value={officers.length} tone="teal" /></div><div className="grid gap-6 xl:grid-cols-5"><section className="dashboard-panel xl:col-span-3"><Heading eyebrow="Priority queue" title="Recent incidents" action={<button type="button" className="dashboard-button" onClick={() => navigate('/incidents/active')}>View queue</button>} />{active.length ? <IncidentTable incidents={active.slice(0, 6)} onView={view} onStatusChange={changeStatus} /> : <EmptyState title="No active incidents" message="The response queue is clear." />}</section><section className="dashboard-panel xl:col-span-2"><Heading eyebrow="Communications" title="Latest alerts" />{alerts.length ? <div className="space-y-3">{alerts.slice(0, 5).map((alert) => <div key={alert.alert_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex gap-3"><WarningAmberOutlined className="text-amber-600" /><div><p className="text-sm font-bold text-slate-900">{alert.title || titleCase(alert.type)}</p><p className="mt-1 text-xs leading-5 text-slate-600">{alert.message || 'No additional details.'}</p></div></div></div>)}</div> : <EmptyState title="No alerts" message="There are no alerts to display." />}</section></div></div>;
  const map = <div className="space-y-6"><Heading eyebrow="Geospatial response" title="Live incident map" description="Locations returned by the incident service." />{loading ? <div className="inline-loading">Loading map data...</div> : <IncidentMap incidents={incidents} height={520} />}</div>;
  const detailView = detail ? <div className="space-y-6"><Heading eyebrow="Incident record" title={titleCase(detail.type)} action={<button type="button" className="dashboard-button" onClick={() => navigate('/incidents/history')}>Back to incidents</button>} /><div className="detail-grid"><section className="detail-panel"><div className="flex flex-wrap gap-2"><span className={`severity-badge ${detail.severity}`}>{detail.severity}</span><span className={`status-badge ${detail.status}`}>{titleCase(detail.status)}</span>{detail.is_sos && <span className="status-badge border-red-200 bg-red-100 text-red-700">SOS</span>}</div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><Detail label="Description" value={detail.description || 'No description provided'} wide /><Detail label="Location" value={detail.location_name || detail.building || 'Unavailable'} /><Detail label="Reporter" value={detail.reporter?.name || (detail.is_anonymous ? 'Anonymous' : 'Campus member')} /><Detail label="Reported" value={new Date(detail.created_at).toLocaleString()} /></dl></section><section className="detail-panel"><Heading eyebrow="Evidence" title="Attached photos" />{detail.photos?.length ? <EvidencePreview photos={detail.photos} /> : <EmptyState title="No evidence attached" message="This incident has no uploaded photos." />}</section></div></div> : <EmptyState icon={ReportProblemOutlined} title="Incident not found" message="The requested incident is unavailable." />;
  const evidence = <div className="space-y-6"><Heading eyebrow="Evidence review" title="Incident evidence" description="Uploaded photos associated with incident records." />{incidents.filter((incident) => incident.photos?.length).length ? <div className="evidence-grid">{incidents.filter((incident) => incident.photos?.length).map((incident) => <article className="evidence-card" key={incident.incident_id}><div className="mb-4 flex items-start justify-between"><div><h3 className="font-black text-slate-900">{titleCase(incident.type)}</h3><p className="mt-1 text-xs text-slate-500">{incident.location_name || 'Campus'}</p></div><button type="button" className="table-action" onClick={() => view(incident)}>View</button></div><EvidencePreview photos={incident.photos} /></article>)}</div> : <EmptyState title="No evidence available" message="Photo evidence will appear here when incidents include uploads." />}</div>;
  const usersView = <div className="space-y-6"><Heading eyebrow="Access and people" title="User management" description="Campus accounts returned by the security service." />{users.length ? <div className="dashboard-panel overflow-x-auto"><table className="dashboard-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{users.map((account) => <tr key={account.user_id}><td className="font-bold">{account.name}</td><td>{account.email}</td><td>{titleCase(account.role)}</td><td><span className="status-badge resolved">{account.is_active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={PeopleAltOutlined} title="No users returned" message="User management data is unavailable or empty." />}</div>;
  const officersView = <div className="space-y-6"><Heading eyebrow="Response team" title="Security officers" description="Officer availability from the security service." />{officers.length ? <div className="officer-grid">{officers.map((officer) => <article className="officer-card" key={officer.user_id}><div className="officer-card-heading"><strong>{officer.name}</strong><span className={`officer-status ${officer.availability_status || 'offline'}`}>{titleCase(officer.availability_status || 'offline')}</span></div><p className="text-sm text-slate-600">{officer.email}</p><p className="mt-3 text-xs text-slate-500">{officer.latitude != null ? `Location: ${officer.latitude}, ${officer.longitude}` : 'Location unavailable'}</p></article>)}</div> : <EmptyState icon={PeopleAltOutlined} title="No security officers" message="No officer records are currently available." />}</div>;
  let content = overview;
  if (section === 'incidents') content = table(active, 'Active incidents', 'Reports currently in the response queue.');
  if (section === 'history') content = table(incidents, 'Incident history', 'All incident records returned by the backend.');
  if (section === 'sos' || section === 'emergency') content = table(critical, section === 'sos' ? 'SOS and critical incidents' : 'Emergency center', 'Critical reports requiring rapid review.');
  if (section === 'map') content = map;
  if (section === 'detail') content = detailView;
  if (section === 'evidence') content = evidence;
  if (section === 'users') content = usersView;
  if (section === 'officers') content = officersView;
  return <DashboardLayout user={user} activeSection={section} incidents={incidents} onNavigate={navigate} onLogout={() => { localStorage.clear(); navigate('/login'); }}><div className="mx-auto max-w-[1500px]">{error && <div className="dashboard-error" role="alert"><ErrorOutline /><div><strong>Dashboard data issue</strong><p>{error}</p></div><button type="button" className="table-action" onClick={loadData}>Retry</button></div>}{content}</div></DashboardLayout>;
}

const Detail = ({ label, value, wide }) => <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</dt><dd className="mt-2 text-sm leading-6 text-slate-800">{value}</dd></div>;

export default Dashboard;