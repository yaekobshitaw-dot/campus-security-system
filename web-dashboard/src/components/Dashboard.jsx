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
import SecurityMap from './SecurityMap.jsx';
import IncidentCreateModal from './IncidentCreateModal';
import ZoneManagement from './ZoneManagement';
import { AlertsZonesPage, AnalyticsPage, ResponsesPage } from './OperationsPages';
import AnnouncementsPage from './AnnouncementsPage';
import { readAlert } from '../services/operations';
import webSocket from '../services/socket';

const activeStatuses = ['reported', 'investigating', 'dispatched', 'on_scene'];
const metricToneClasses = {
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  teal: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
};
const routes = {
  '/dashboard': 'overview', '/incidents/active': 'incidents', '/incidents/history': 'history',
  '/map': 'map', '/sos': 'sos', '/emergency': 'emergency', '/evidence': 'evidence',
  '/officers': 'officers', '/users': 'users',
  '/analytics': 'analytics', '/responses': 'responses', '/alerts': 'alerts', '/zones': 'zones',
  '/announcements': 'announcements',
};
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusLabel = (value) => value === 'investigating' ? 'In Progress' : titleCase(value);
const validOfficerCoordinates = (officer) => officer?.latitude !== null && officer?.latitude !== undefined
  && officer?.longitude !== null && officer?.longitude !== undefined
  && officer?.latitude !== '' && officer?.longitude !== ''
  && Number.isFinite(Number(officer?.latitude))
  && Number(officer.latitude) >= -90 && Number(officer.latitude) <= 90
  && Number.isFinite(Number(officer?.longitude))
  && Number(officer.longitude) >= -180 && Number(officer.longitude) <= 180;
const officerLocationLabel = (officer) => {
  if (!validOfficerCoordinates(officer) || officer.location_status === 'unavailable') return 'Location unavailable';
  const label = officer.location_status === 'last_known' ? 'Last known location' : 'Location';
  return `${label}: ${Number(officer.latitude).toFixed(5)}, ${Number(officer.longitude).toFixed(5)}`;
};

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
  <article className={`dashboard-metric dashboard-panel flex min-h-[132px] flex-col justify-between border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${tone === 'red' ? 'dashboard-metric-critical' : ''}`}>
    <div className="flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${metricToneClasses[tone] || metricToneClasses.slate}`}><Icon className="text-[20px]" /></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Live</span></div>
    <div><p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-0.5 text-[2rem] font-black leading-none tracking-tight text-[#0b1f3a]">{value}</p></div>
  </article>
);

const Heading = ({ eyebrow, title, description, action }) => (
  <div className="dashboard-heading mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-eyebrow">{eyebrow}</p><h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">{title}</h2>{description && <span className="mt-1 block max-w-2xl text-sm leading-6 text-slate-500">{description}</span>}</div>{action && <div className="flex flex-wrap items-center gap-2">{action}</div>}</div>
);

const EmptyState = ({ icon: Icon = CheckCircleOutline, title, message }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><Icon className="mb-3 rounded-2xl bg-cyan-50 p-3 text-[54px] text-cyan-700 ring-1 ring-cyan-100" /><h3 className="text-lg font-black text-[#0b1f3a]">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{message}</p></div>
);

const RequestError = ({ message, onRetry }) => (
  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/80 p-8 text-center shadow-sm">
    <ErrorOutline className="mb-3 text-[42px] text-red-600" />
    <h3 className="text-lg font-black text-red-900">{message}</h3>
    <button type="button" className="mt-4 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-black text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2" onClick={onRetry}>Retry</button>
  </div>
);

const AccessDenied = () => <EmptyState icon={ShieldOutlined} title="Access denied" message="Your account does not have permission to view this section." />;

const resourceNames = ['incidents', 'alerts', 'zones', 'users', 'stats', 'analytics', 'responses', 'officers'];
const initialResourceState = resourceNames.reduce((state, name) => ({ ...state, [name]: { status: ['incidents', 'alerts', 'zones'].includes(name) ? 'loading' : 'idle', error: '' } }), {});
const resourceStatus = (value) => {
  if (Array.isArray(value)) return value.length ? 'success' : 'empty';
  if (value && typeof value === 'object') return Object.keys(value).length ? 'success' : 'empty';
  return 'empty';
};

const notificationsStorageKey = (userId) => `campus-security:notifications:${userId || 'anonymous'}`;
const readStoredNotifications = (userId) => {
  try {
    const stored = sessionStorage.getItem(notificationsStorageKey(userId));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

function Dashboard({ user: authenticatedUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [userStatusLoading, setUserStatusLoading] = useState('');
  const [clearHistoryLoading, setClearHistoryLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState('');
  const user = authenticatedUser || {};
  const [notifications, setNotifications] = useState(() => readStoredNotifications(user.user_id));
  const [error, setError] = useState('');
  const [, setOperationsError] = useState('');
  const [resourceState, setResourceState] = useState(initialResourceState);
  const [createOpen, setCreateOpen] = useState(false);
  const section = routes[location.pathname] || (location.pathname.startsWith('/incidents/') ? 'detail' : 'overview');
  const canViewOperations = ['security', 'admin'].includes(user.role);
  const canViewUsers = user.role === 'admin';
  const protectedSection = (section === 'users' && !canViewUsers) || (['officers', 'analytics', 'responses'].includes(section) && !canViewOperations);

  useEffect(() => {
    try {
      sessionStorage.setItem(notificationsStorageKey(user.user_id), JSON.stringify(notifications));
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
  }, [notifications, user.user_id]);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    setStatsLoading(true);
    const requests = [api.get('/incidents'), api.get('/alerts'), api.get('/zones')];
      const requestedResources = ['incidents', 'alerts', 'zones'];
      if (canViewUsers) requestedResources.push('users');
      if (canViewOperations) requestedResources.push('stats', 'analytics', 'responses', 'officers');
      setResourceState((current) => ({
        ...current,
        ...requestedResources.reduce((state, name) => ({ ...state, [name]: { status: 'loading', error: '' } }), {}),
      }));
    const userIndex = canViewUsers ? requests.push(api.get('/users/all')) - 1 : -1;
    const statsIndex = canViewOperations ? requests.push(api.get('/incidents/stats')) - 1 : -1;
    const analyticsIndex = canViewOperations ? requests.push(api.get('/analytics')) - 1 : -1;
    const responseIndex = canViewOperations ? requests.push(api.get('/responses')) - 1 : -1;
    const officersIndex = canViewOperations ? requests.push(api.get('/users/security-officers')) - 1 : -1;
    const results = await Promise.allSettled(requests);
    const [incidentResult, alertResult, zoneResult] = results;
    const userResult = userIndex >= 0 ? results[userIndex] : null;
    const statsResult = statsIndex >= 0 ? results[statsIndex] : null;
    const analyticsResult = analyticsIndex >= 0 ? results[analyticsIndex] : null;
    const responseResult = responseIndex >= 0 ? results[responseIndex] : null;
    const officersResult = officersIndex >= 0 ? results[officersIndex] : null;
      const resourceResults = { incidents: incidentResult, alerts: alertResult, zones: zoneResult, users: userResult, stats: statsResult, analytics: analyticsResult, responses: responseResult, officers: officersResult };
      setResourceState((current) => Object.entries(resourceResults).reduce((state, [name, result]) => {
        if (!result) return state;
        return {
          ...state,
          [name]: result.status === 'fulfilled'
            ? { status: resourceStatus(result.value.data?.data), error: '' }
            : { status: 'error', error: result.reason?.response?.data?.message || `Failed to load ${name}.` },
        };
      }, current));
    if (incidentResult.status === 'fulfilled') setIncidents(incidentResult.value.data?.data || []);
    if (alertResult.status === 'fulfilled') setAlerts(alertResult.value.data?.data || []);
    if (userResult?.status === 'fulfilled') setUsers(userResult.value.data?.data || []);
    if (statsResult?.status === 'fulfilled') setServerStats(statsResult.value.data?.data || null);
    if (zoneResult.status === 'fulfilled') setZones(zoneResult.value.data?.data || []);
    if (analyticsResult?.status === 'fulfilled') setAnalytics(analyticsResult.value.data?.data || null);
    if (responseResult?.status === 'fulfilled') setResponses(responseResult.value.data?.data || []);
    if (officersResult?.status === 'fulfilled') setOfficers(officersResult.value.data?.data || []);
    if (results.every((result) => result.status === 'rejected')) setError('The dashboard API did not return data. Check the backend connection and your session.');
    else if (results.some((result) => result.status === 'rejected')) setError('Some dashboard data could not be loaded. Available data remains visible.');
    const operationsResults = [zoneResult, statsResult, analyticsResult, responseResult, officersResult].filter(Boolean);
    setOperationsError(operationsResults.every((result) => result.status === 'rejected') ? 'Operations data is unavailable for this account.' : '');
    setStatsLoading(false);
    setOperationsLoading(false);
    setLoading(false);
  }, [canViewOperations, canViewUsers]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    webSocket.connect();
    const refreshOperationalData = () => loadData();
    const addNotification = (payload, type) => {
      const incidentId = payload?.incident_id || payload?.incident?.incident_id || payload?.alert?.incident_id;
      const notificationId = incidentId || payload?.alert_id || Date.now();
      const isSOS = type === 'sos' || payload?.is_sos || payload?.type === 'sos_alert';
      const title = isSOS ? '🚨 SOS Emergency' : '🚨 New Incident Report';
      const message = isSOS
        ? 'An SOS emergency has been reported.'
        : 'A new security incident has been reported.';
      setNotifications((current) => {
        const existing = current.find((notification) => notification.id === notificationId);
        if (existing) {
          return current.map((notification) => notification.id === notificationId ? {
            ...notification,
            incident_id: incidentId || notification.incident_id,
            title,
            message,
            type: isSOS ? 'sos' : 'incident',
            severity: payload?.severity || notification.severity,
            location_name: payload?.location_name || notification.location_name,
            created_at: payload?.created_at || notification.created_at,
          } : notification);
        }
        return [{
          id: notificationId,
          incident_id: incidentId,
          title,
          type: isSOS ? 'sos' : 'incident',
          message,
          severity: payload?.severity || (payload?.is_sos ? 'critical' : 'high'),
          incident_type: payload?.type,
          location_name: payload?.location_name || payload?.building,
          created_at: payload?.created_at || new Date().toISOString(),
          read: false,
        }, ...current].slice(0, 20);
      });
      loadData();
    };
    const handleIncident = (incident) => addNotification(incident, incident?.is_sos ? 'sos' : 'incident');
    const handleSos = (alert) => addNotification(alert, 'sos');
    const handleAlert = (alert) => addNotification(alert, alert?.type === 'sos_alert' ? 'sos' : 'incident');
    webSocket.on('new-incident', handleIncident);
    webSocket.on('sos_alert', handleSos);
    webSocket.on('alert-received', handleAlert);
    webSocket.on('officer-location-updated', refreshOperationalData);
    webSocket.on('incident_assigned', refreshOperationalData);
    webSocket.on('officer_assignment', refreshOperationalData);
    return () => {
      webSocket.off('new-incident', handleIncident);
      webSocket.off('sos_alert', handleSos);
      webSocket.off('alert-received', handleAlert);
      webSocket.off('officer-location-updated', refreshOperationalData);
      webSocket.off('incident_assigned', refreshOperationalData);
      webSocket.off('officer_assignment', refreshOperationalData);
      webSocket.disconnect();
    };
  }, [loadData]);

  const stats = useMemo(() => {
    const calculated = statsFor(incidents);
    if (statsLoading) return { ...calculated, total: '...', active: '...' };
    return serverStats ? { ...calculated, total: serverStats.total, active: serverStats.active, resolved: serverStats.resolved } : calculated;
  }, [incidents, serverStats, statsLoading]);
  const active = useMemo(() => incidents.filter((incident) => activeStatuses.includes(incident.status)), [incidents]);
  const critical = useMemo(() => incidents.filter((incident) => incident.is_sos || incident.severity === 'critical'), [incidents]);
  const detail = incidents.find((incident) => String(incident.incident_id) === location.pathname.split('/').pop());
  const detailOfficer = detail?.responses?.[0]?.responder?.name || 'Unassigned';
  const view = (incident) => navigate(`/incidents/${incident.incident_id}`);
  const changeStatus = async (incident, status) => { try { await api.patch(`/incidents/${incident.incident_id}/status`, { status }); await loadData(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update incident status.'); } };
  const assignOfficer = async (incident, officerId) => {
    if (!officerId || assignmentLoading) return;
    setAssignmentLoading(incident.incident_id);
    setError('');
    try {
      await api.post(`/incidents/${incident.incident_id}/assign`, { officer_id: officerId });
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to assign security officer.');
    } finally {
      setAssignmentLoading('');
    }
  };
  const changeUserStatus = async (account) => {
    setUserStatusLoading(account.user_id);
    setError('');
    try {
      const response = await api.patch(`/users/${account.user_id}/status`, { is_active: !account.is_active });
      const updatedUser = response.data?.data;
      setUsers((currentUsers) => currentUsers.map((userAccount) => (
        userAccount.user_id === account.user_id
          ? { ...userAccount, ...(updatedUser || { is_active: !account.is_active }) }
          : userAccount
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update user status.');
    } finally {
      setUserStatusLoading('');
    }
  };
  const clearHistory = async () => {
    if (clearHistoryLoading || !window.confirm('Clear all incident history permanently? This action cannot be undone.')) return;
    setClearHistoryLoading(true);
    setError('');
    try {
      await api.delete('/incidents/history');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to clear incident history.');
    } finally {
      setClearHistoryLoading(false);
    }
  };
  const refreshButton = <button type="button" className="dashboard-button" onClick={loadData}><Refresh className="text-[18px]" /> Refresh</button>;
  const isSOSSection = section === 'sos' || section === 'emergency';
  const createButton = <button type="button" className="dashboard-button primary" onClick={() => setCreateOpen(true)}>{isSOSSection ? 'Send SOS alert' : 'Report incident'}</button>;
  const markAlertRead = async (alertId) => { try { await readAlert(alertId); await loadData(); } catch (requestError) { setOperationsError(requestError.response?.data?.message || 'Unable to mark alert as read.'); } };
  const markNotificationsRead = () => setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));

  const table = (items, title, description) => <><Heading eyebrow="Incident operations" title={title} description={description} action={<div className="flex gap-2">{createButton}{refreshButton}</div>} />{resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : <IncidentTable incidents={items} officers={officers} loading={loading} onView={view} onStatusChange={changeStatus} onAssign={assignOfficer} assignmentLoading={assignmentLoading} privileged={canViewOperations} />}</>;
  const overview = <div className="space-y-8"><Heading eyebrow="Security operations center" title="Campus overview" description="Live incident, response, and system activity from the campus security service." action={<div className="flex flex-wrap gap-2">{createButton}{refreshButton}</div>} /><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={ReportProblemOutlined} label="Total incidents" value={stats.total} /><Metric icon={WarningAmberOutlined} label="Active incidents" value={stats.active} tone="amber" /><Metric icon={ShieldOutlined} label="Critical / SOS" value={critical.length} tone="red" /><Metric icon={PeopleAltOutlined} label="Security officers" value={resourceState.officers.status === 'error' ? '!' : officers.length} tone="teal" /></div><div className="grid gap-6 xl:grid-cols-5"><section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:col-span-3"><Heading eyebrow="Priority queue" title="Recent incidents" action={<button type="button" className="dashboard-button" onClick={() => navigate('/incidents/active')}>View queue</button>} />{resourceState.incidents.status === 'loading' ? <div className="inline-loading">Loading incidents...</div> : resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : active.length ? <IncidentTable incidents={active.slice(0, 6)} onView={view} onStatusChange={changeStatus} /> : <EmptyState title="No active incidents" message="The response queue is clear." />}</section><section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:col-span-2"><Heading eyebrow="Communications" title="Latest alerts" />{resourceState.alerts.status === 'loading' ? <div className="inline-loading">Loading alerts...</div> : resourceState.alerts.status === 'error' ? <RequestError message={resourceState.alerts.error} onRetry={loadData} /> : alerts.length ? <div className="space-y-3">{alerts.slice(0, 5).map((alert) => <div key={alert.alert_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-200 hover:bg-cyan-50/30"><div className="flex gap-3"><WarningAmberOutlined className="text-amber-600" /><div><p className="text-sm font-bold text-[#0b1f3a]">{alert.title || titleCase(alert.type)}</p><p className="mt-1 text-xs leading-5 text-slate-600">{alert.message || 'No additional details.'}</p></div></div></div>)}</div> : <EmptyState title="No alerts" message="There are no alerts to display." />}</section></div></div>;
  const map = <div className="space-y-8"><Heading eyebrow="Geospatial response" title="Live incident map" description="Locations returned by the incident service." />{resourceState.incidents.status === 'loading' ? <div className="inline-loading">Loading map data...</div> : resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"><SecurityMap incidents={incidents} officers={canViewOperations ? officers : []} zones={zones} /></div>}</div>;
  const detailView = detail ? <div className="space-y-8"><Heading eyebrow="Incident record" title={titleCase(detail.type)} action={<button type="button" className="dashboard-button" onClick={() => navigate('/incidents/history')}>Back to incidents</button>} /><div className="detail-grid"><section className="detail-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><div className="flex flex-wrap gap-2"><span className={`severity-badge ${detail.severity}`}>{detail.severity}</span><span className={`status-badge ${detail.status}`}>{statusLabel(detail.status)}</span>{detail.is_sos && <span className="status-badge border-red-200 bg-red-100 text-red-700">SOS</span>}</div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><Detail label="Description" value={detail.description || 'No description provided'} wide /><Detail label="Location" value={detail.location_name || detail.building || 'Unavailable'} /><Detail label="Reporter" value={detail.reporter?.name || (detail.is_anonymous ? 'Anonymous' : 'Campus member')} /><Detail label="Assigned officer" value={detailOfficer} /><Detail label="Reported" value={new Date(detail.created_at).toLocaleString()} /></dl></section><section className="detail-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><Heading eyebrow="Evidence" title="Attached photos" />{detail.photos?.length ? <EvidencePreview photos={detail.photos} /> : <EmptyState title="No evidence attached" message="This incident has no uploaded photos." />}</section></div></div> : resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : <EmptyState icon={ReportProblemOutlined} title="Incident not found" message="The requested incident is unavailable." />;
  const evidence = <div className="space-y-6"><Heading eyebrow="Evidence review" title="Incident evidence" description="Uploaded photos associated with incident records." />{resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : incidents.filter((incident) => incident.photos?.length).length ? <div className="evidence-grid">{incidents.filter((incident) => incident.photos?.length).map((incident) => <article className="evidence-card" key={incident.incident_id}><div className="mb-4 flex items-start justify-between"><div><h3 className="font-black text-slate-900">{titleCase(incident.type)}</h3><p className="mt-1 text-xs text-slate-500">{incident.location_name || 'Campus'}</p></div><button type="button" className="table-action" onClick={() => view(incident)}>View</button></div><EvidencePreview photos={incident.photos} /></article>)}</div> : <EmptyState title="No evidence available" message="Photo evidence will appear here when incidents include uploads." />}</div>;
  const usersView = <div className="space-y-8"><Heading eyebrow="Access and people" title="User management" description="Campus accounts returned by the security service." />{users.length ? <div className="dashboard-panel overflow-x-auto border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><table className="dashboard-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map((account) => <tr key={account.user_id}><td className="font-bold text-[#0b1f3a]">{account.name}</td><td>{account.email}</td><td>{titleCase(account.role)}</td><td><span className={`status-badge ${account.is_active ? 'resolved' : ''}`}>{account.is_active ? 'Active' : 'Inactive'}</span></td><td><button type="button" className="table-action" onClick={() => changeUserStatus(account)} disabled={userStatusLoading === account.user_id}>{userStatusLoading === account.user_id ? 'Updating...' : account.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div> : <EmptyState icon={PeopleAltOutlined} title="No users returned" message="User management data is unavailable or empty." />}</div>;
  const officersView = <div className="space-y-8"><Heading eyebrow="Response team" title="Security officers" description="Officer availability from the security service." />{officers.length ? <div className="officer-grid">{officers.map((officer) => <article className="officer-card border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]" key={officer.user_id}><div className="officer-card-heading"><strong className="text-[#0b1f3a]">{officer.name}</strong><span className={`officer-status ${officer.availability_status || 'offline'}`}>{titleCase(officer.availability_status || 'offline')}</span></div><p className="text-sm text-slate-600">{officer.email}</p><p className="mt-3 text-xs text-slate-500">{officerLocationLabel(officer)}</p></article>)}</div> : <EmptyState icon={PeopleAltOutlined} title="No security officers" message="No officer records are currently available." />}</div>;
  const alertsZonesError = resourceState.alerts.status === 'error' ? resourceState.alerts.error : resourceState.zones.status === 'error' ? resourceState.zones.error : '';
  let content = overview;
  if (section === 'incidents') content = table(active, 'Active incidents', 'Reports currently in the response queue.');
  if (section === 'history') content = table(incidents, 'Incident history', 'All incident records returned by the backend.');
  if (section === 'sos' || section === 'emergency') content = table(critical, section === 'sos' ? 'SOS and critical incidents' : 'Emergency center', 'Critical reports requiring rapid review.');
  if (section === 'map') content = map;
  if (section === 'detail') content = detailView;
  if (section === 'evidence') content = evidence;
  if (protectedSection) content = <AccessDenied />;
  else if (section === 'zones') content = <ZoneManagement zones={zones} loading={resourceState.zones.status === 'loading'} error={resourceState.zones.status === 'error' ? resourceState.zones.error : ''} canManage={['admin', 'security'].includes(user.role)} onRefresh={loadData} />;
  else if (section === 'users') content = resourceState.users.status === 'loading' ? <div className="inline-loading">Loading users...</div> : resourceState.users.status === 'error' ? <RequestError message={resourceState.users.error} onRetry={loadData} /> : usersView;
  else if (section === 'officers') content = resourceState.officers.status === 'loading' ? <div className="inline-loading">Loading officers...</div> : resourceState.officers.status === 'error' ? <RequestError message={resourceState.officers.error} onRetry={loadData} /> : officersView;
  else if (section === 'analytics') content = <AnalyticsPage analytics={analytics} loading={operationsLoading} error={resourceState.analytics.status === 'error' ? resourceState.analytics.error : ''} onRefresh={loadData} />;
  else if (section === 'responses') content = <ResponsesPage responses={responses} loading={operationsLoading} error={resourceState.responses.status === 'error' ? resourceState.responses.error : ''} onRefresh={loadData} />;
  else if (section === 'announcements') content = <AnnouncementsPage user={user} />;
  else if (section === 'alerts' || section === 'zones') content = <AlertsZonesPage alerts={alerts} zones={zones} loading={operationsLoading} error={alertsZonesError} onRefresh={loadData} onReadAlert={markAlertRead} canManage={['admin', 'security'].includes(user.role)} />;
  return <DashboardLayout user={user} activeSection={section} incidents={incidents} notifications={notifications} onNotificationsRead={markNotificationsRead} onNavigate={navigate} onLogout={() => { localStorage.clear(); navigate('/login'); }} onClearHistory={clearHistory} clearHistoryLoading={clearHistoryLoading}><div className="mx-auto w-full max-w-[1500px] space-y-6">{error && <div className="dashboard-error" role="alert"><ErrorOutline /><div><strong>Dashboard data issue</strong><p>{error}</p></div><button type="button" className="table-action" onClick={loadData}>Retry</button></div>}{content}</div>{createOpen && <IncidentCreateModal isSOS={isSOSSection} onClose={() => setCreateOpen(false)} onSuccess={async () => { setCreateOpen(false); await loadData(); }} />}</DashboardLayout>;
}

const Detail = ({ label, value, wide }) => <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</dt><dd className="mt-2 text-sm leading-6 text-slate-800">{value}</dd></div>;

export default Dashboard;