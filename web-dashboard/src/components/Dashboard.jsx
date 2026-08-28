import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import Logout from '@mui/icons-material/Logout';
import MapOutlined from '@mui/icons-material/MapOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import incidentService from '../services/incidentService';
import { webSocket } from '../services/socket';
import AnalyticsCharts from './Analytics/AnalyticsCharts';
import SafetyChatbot from './Chatbot/SafetyChatbot';
import './Dashboard.css';
import EvidencePreview from './EvidencePreview';
import Footer from './Footer';
import ReportIncident from './ReportIncident';
import SecurityMap from './SecurityMap';

const STATUSES = ['reported', 'investigating', 'dispatched', 'on_scene', 'resolved', 'closed'];
const ROLES = ['student', 'faculty', 'staff', 'security', 'admin'];
const text = (value) => (value || 'incident').replaceAll('_', ' ');
const when = (value) => value ? new Date(value).toLocaleString() : 'Unknown';
const isActive = (incident) => ['reported', 'investigating', 'dispatched', 'on_scene'].includes(incident.status);
const hasValidCoordinates = (entity) => Number.isFinite(Number(entity?.latitude)) && Number.isFinite(Number(entity?.longitude));
const responder = (incident) => incident.responses?.[0]?.responder;

function makeStats(list) {
  return { total: list.length, active: list.filter(isActive).length, resolved: list.filter((item) => item.status === 'resolved').length };
}

export default function Dashboard({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const section = getSection(location.pathname);
  const role = (user?.role || '').toLowerCase();
  const privileged = ['admin', 'security'].includes(role);
  const admin = role === 'admin';
  const [incidents, setIncidents] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sosAlert, setSosAlert] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [assignmentIncident, setAssignmentIncident] = useState('');
  const [updating, setUpdating] = useState(null);
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'student' });

  async function loadData() {
    try {
      setLoading(true);
      const result = await incidentService.getAll();
      const list = result?.data || [];
      setIncidents(list);
      if (privileged) {
        const [statsResult, officersResult] = await Promise.allSettled([incidentService.getStats(), api.get('/users/security-officers')]);
        setStats(statsResult.status === 'fulfilled' ? statsResult.value?.data || makeStats(list) : makeStats(list));
        setOfficers(officersResult.status === 'fulfilled' ? officersResult.value?.data?.data || [] : []);
      } else setStats(makeStats(list));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    webSocket.connect();
    const refresh = () => loadData();
    const onSOS = (alert) => { setSosAlert(alert); refresh(); };
    const onOfficer = (next) => setOfficers((current) => current.some((item) => item.user_id === next.user_id) ? current.map((item) => item.user_id === next.user_id ? { ...item, ...next } : item) : [...current, next]);
    const onUnauthorized = () => onLogout();
    window.addEventListener('campus-security:unauthorized', onUnauthorized);
    ['new-incident', 'incident-updated', 'incident_assigned'].forEach((event) => webSocket.on(event, refresh));
    webSocket.on('sos_alert', onSOS);
    webSocket.on('officer-location-updated', onOfficer);
    return () => {
      window.removeEventListener('campus-security:unauthorized', onUnauthorized);
      ['new-incident', 'incident-updated', 'incident_assigned'].forEach((event) => webSocket.off(event, refresh));
      webSocket.off('sos_alert', onSOS);
      webSocket.off('officer-location-updated', onOfficer);
      webSocket.disconnect();
    };
  }, [privileged, onLogout]);

  useEffect(() => { if (admin) loadUsers(); }, [admin]);

  async function loadUsers() {
    try { setUserLoading(true); const result = await api.get('/users/all'); setUsers(result?.data?.data || []); }
    catch { setError('Failed to load users.'); } finally { setUserLoading(false); }
  }

  async function changeStatus(incidentId, status) {
    try { setUpdating(incidentId); await api.patch(`/incidents/${incidentId}/status`, { status }); await loadData(); }
    catch { setError('Failed to update incident status.'); } finally { setUpdating(null); }
  }

  async function assign(officerId) {
    if (!assignmentIncident) return;
    try { await api.post(`/incidents/${assignmentIncident}/assign`, { officer_id: officerId }); setAssignmentIncident(''); await loadData(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Failed to assign incident.'); }
  }

  async function assignIncident(incidentId, officerId) {
    try { await api.post(`/incidents/${incidentId}/assign`, { officer_id: officerId }); await loadData(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Failed to assign incident.'); }
  }

  async function updateResponseStatus(incidentId, status) {
    try { await api.patch(`/incidents/${incidentId}/response`, { status }); await loadData(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Failed to update response status.'); }
  }

  async function createUser(event) {
    event.preventDefault();
    try { await api.post('/auth/admin/create-user', userForm); setUserForm({ name: '', email: '', password: '', role: 'student' }); loadUsers(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Failed to create user.'); }
  }

  async function changeUserStatus(userId, isActiveUser) {
    try { await api.patch(`/users/${userId}/status`, { is_active: isActiveUser }); loadUsers(); }
    catch { setError('Failed to update user status.'); }
  }

  if (loading) return <Loading />;
  const page = <Page section={section} incidents={incidents} stats={stats} officers={officers} privileged={privileged} admin={admin} location={location} navigate={navigate} changeStatus={changeStatus} updateResponseStatus={updateResponseStatus} assignIncident={assignIncident} updating={updating} assignmentIncident={assignmentIncident} setAssignmentIncident={setAssignmentIncident} assign={assign} users={users} userLoading={userLoading} userForm={userForm} setUserForm={setUserForm} createUser={createUser} changeUserStatus={changeUserStatus} setReportOpen={setReportOpen} />;
  const initials = (user?.name || 'Campus member').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <div className="dashboard-shell"><aside className="dashboard-sidebar"><Link to="/dashboard" className="dashboard-brand"><span className="dashboard-brand-mark"><ShieldOutlined /></span><span>Campus<span>Secure</span><small>Operations center</small></span></Link><div className="sidebar-section-label">Workspace</div><nav className="dashboard-nav"><Nav to="/dashboard" icon={<DashboardOutlined />} text="Overview" active={section === 'overview'} /><Nav to="/incidents/active" icon={<ReportProblemOutlined />} text="Active incidents" count={incidents.filter(isActive).length} active={section === 'active'} /><Nav to="/incidents/history" icon={<EventNoteOutlined />} text="Incident history" active={section === 'history'} />{privileged && <Nav to="/emergency" icon={<WarningAmberOutlined />} text="Emergency center" count={incidents.filter((item) => (item.is_sos || item.severity === 'critical') && isActive(item)).length} active={section === 'emergency'} />}{privileged && <Nav to="/map" icon={<MapOutlined />} text="Live map" active={section === 'map'} />}<Nav to="/sos" icon={<WarningAmberOutlined />} text="SOS / Emergency" count={incidents.filter((item) => item.is_sos).length} active={section === 'sos'} /><Nav to="/evidence" icon={<DescriptionOutlined />} text="Evidence" active={section === 'evidence'} />{privileged && <Nav to="/officers" icon={<PeopleAltOutlined />} text="Security officers" active={section === 'officers'} />}{admin && <Nav to="/users" icon={<PeopleAltOutlined />} text="User management" active={section === 'users'} />}</nav><div className="sidebar-spacer" /><div className="sidebar-safety-card"><span><TaskAltOutlined /></span><strong>Response readiness</strong><p>Keep your campus response team informed and connected.</p></div><div className="sidebar-user"><div className="dashboard-avatar">{initials}</div><div><strong>{user?.name || 'Campus member'}</strong><span>{role || 'member'}</span></div><button onClick={onLogout} aria-label="Log out"><Logout /></button></div></aside><main className="dashboard-main"><header className="dashboard-topbar"><div className="dashboard-mobile-brand"><span className="dashboard-brand-mark"><ShieldOutlined /></span><strong>CampusSecure</strong></div><div className="dashboard-breadcrumb">Workspace <strong>/ {sectionTitle(section)}</strong></div><span className="live-indicator"><i /> Services operational</span></header><div className="dashboard-content">{error && <div className="dashboard-error" role="alert"><WarningAmberOutlined /><div><strong>Could not refresh workspace</strong><p>{error}</p></div><button onClick={loadData}>Retry</button></div>}{sosAlert && <div className="dashboard-error sos-live-alert"><WarningAmberOutlined /><div><strong>SOS Alert Sent</strong><p>{sosAlert.location_name || 'Location unavailable'}</p></div><button onClick={() => navigate(`/incidents/${sosAlert.incident_id}`)}>Open details</button><button onClick={() => setSosAlert(null)}>Dismiss</button></div>}{page}</div><Footer /><SafetyChatbot /></main>{reportOpen && <Modal onClose={() => setReportOpen(false)}><ReportIncident onClose={() => setReportOpen(false)} onSuccess={loadData} /></Modal>}</div>;
}

function Page({ section, incidents, stats, officers, privileged, admin, location, navigate, changeStatus, updateResponseStatus, assignIncident, updating, assignmentIncident, setAssignmentIncident, assign, users, userLoading, userForm, setUserForm, createUser, changeUserStatus, setReportOpen }) {
  if (section === 'emergency') return privileged ? <EmergencyCenter incidents={incidents} officers={officers} navigate={navigate} assignIncident={assignIncident} updateResponseStatus={updateResponseStatus} /> : <Restricted />;
  if (section === 'active' || section === 'history' || section === 'sos') return <IncidentView incidents={incidents} mode={section} privileged={privileged} changeStatus={changeStatus} updating={updating} navigate={navigate} />;
  if (section === 'details') return <Details incidents={incidents} privileged={privileged} changeStatus={changeStatus} updating={updating} navigate={navigate} />;
  if (section === 'map') return privileged ? <MapPage incidents={incidents} officers={officers} location={location} assignmentIncident={assignmentIncident} setAssignmentIncident={setAssignmentIncident} assign={assign} /> : <Restricted />;
  if (section === 'evidence') return <EvidencePage incidents={incidents} />;
  if (section === 'officers') return privileged ? <OfficersPage officers={officers} incidents={incidents} /> : <Restricted />;
  if (section === 'users') return admin ? <UsersPage users={users} loading={userLoading} form={userForm} setForm={setUserForm} createUser={createUser} changeUserStatus={changeUserStatus} /> : <Restricted />;
  return <Overview incidents={incidents} stats={stats} officers={officers} navigate={navigate} setReportOpen={setReportOpen} />;
}

function EmergencyCenter({ incidents, officers, navigate, assignIncident, updateResponseStatus }) {
  const emergencies = incidents.filter((incident) => isActive(incident) && (incident.is_sos || incident.severity === 'critical'));
  const [selectedId, setSelectedId] = useState(emergencies[0]?.incident_id || '');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const incident = emergencies.find((item) => item.incident_id === selectedId) || emergencies[0];
  const assigned = incident && responder(incident);
  const available = officers.filter((officer) => officer.role === 'security' && officer.availability_status === 'available');

  useEffect(() => {
    if (!selectedId && emergencies[0]) setSelectedId(emergencies[0].incident_id);
    if (incident?.responses?.length) setSelectedOfficerId('');
  }, [emergencies, incident, selectedId]);

  if (!incident) return <><Header eyebrow="Emergency response" title="Emergency Response Center" description="No active SOS or critical incidents require response right now." action={<button className="dashboard-button secondary" onClick={() => navigate('/sos')}>View SOS history</button>} /><Restricted message="The emergency queue is clear." /></>;

  const positionAvailable = incident.latitude != null && incident.longitude != null;
  const responseStatus = incident.responses?.[0]?.status || 'assigned';
  const timeline = [
    { name: 'Reported', complete: true, detail: when(incident.created_at) },
    { name: 'Dispatched', complete: Boolean(assigned) || incident.status === 'dispatched' || incident.status === 'on_scene', detail: assigned ? 'Officer assigned' : 'Awaiting assignment' },
    { name: 'En route', complete: responseStatus === 'responding' || incident.status === 'on_scene', detail: responseStatus === 'responding' ? 'Response in progress' : 'Awaiting response' },
    { name: 'On scene', complete: incident.status === 'on_scene', detail: incident.status === 'on_scene' ? 'Officer arrived' : 'Pending arrival' },
    { name: 'Resolved', complete: ['resolved', 'closed'].includes(incident.status), detail: ['resolved', 'closed'].includes(incident.status) ? 'Incident closed' : 'Pending resolution' }
  ];

  const assignSelected = async () => {
    if (!selectedOfficerId) return;
    await assignIncident(incident.incident_id, selectedOfficerId);
  };

  return <>
    <Header eyebrow="Emergency response" title="Emergency Response Center" description="Prioritize SOS and critical incidents, coordinate officers, and monitor response progress." />
    <div className="emergency-layout">
      <aside className="dashboard-panel emergency-queue"><div className="emergency-queue-heading"><div><p className="dashboard-eyebrow">Priority queue</p><h2>Active emergencies</h2></div><span>{emergencies.length}</span></div>{emergencies.map((item) => <button className={`emergency-queue-item ${item.incident_id === incident.incident_id ? 'selected' : ''}`} key={item.incident_id} onClick={() => setSelectedId(item.incident_id)}><span className="emergency-queue-icon"><WarningAmberOutlined /></span><span><strong>{item.is_sos ? 'SOS alert' : text(item.type)}</strong><small>{item.location_name || 'Location unavailable'}</small></span><em>{text(item.status)}</em></button>)}</aside>
      <div className="emergency-main">
        <section className="dashboard-panel emergency-incident-card"><div className="emergency-card-top"><div><p className="dashboard-eyebrow">Active emergency</p><h2>{incident.is_sos ? 'SOS emergency alert' : text(incident.type)}</h2><span>{when(incident.created_at)}</span></div><div className="emergency-badges"><span className="emergency-tag">{incident.is_sos ? 'SOS' : 'CRITICAL'}</span><span className={`status-badge ${incident.status}`}>{text(incident.status)}</span></div></div><div className="emergency-facts"><Field name="Incident type">{text(incident.type)}</Field><Field name="Severity"><span className="severity-badge critical">{incident.severity}</span></Field><Field name="Reporter">{incident.reporter?.name || 'Campus member'}</Field><Field name="Location">{incident.location_name || 'Location unavailable'}</Field><Field name="Coordinates">{positionAvailable ? `${incident.latitude}, ${incident.longitude}` : 'Unavailable'}</Field><Field name="Evidence"><EvidencePreview photos={incident.photos} /></Field></div></section>
        <section className="dashboard-panel emergency-assignment"><div className="panel-heading"><div><p className="dashboard-eyebrow">Assignment</p><h2>{assigned ? 'Assigned officer' : 'Find available officer'}</h2><span>{assigned ? 'Monitor the assigned response below.' : 'Available officers are restricted to authorized responders.'}</span></div></div>{assigned ? <div className="assigned-officer"><div className="officer-status responding"><i /> Responding</div><strong>{assigned.name}</strong><span>Assignment active · {responseStatus}</span></div> : available.length ? <div className="available-officers">{available.map((officer) => <button className={`available-officer ${selectedOfficerId === officer.user_id ? 'selected' : ''}`} key={officer.user_id} onClick={() => setSelectedOfficerId(officer.user_id)}><span className="officer-avatar">{officer.name?.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{officer.name}</strong><small>Available · {hasValidCoordinates(officer) ? `Location available · ${distanceLabel(officer, incident)}` : 'Location unavailable · —'}</small></span></button>)}<button className="dashboard-button primary emergency-assign-button" disabled={!selectedOfficerId} onClick={assignSelected}>Assign officer</button></div> : <div className="emergency-empty">No available officers to assign.</div>}</section>
        <section className="dashboard-panel emergency-timeline"><div className="panel-heading"><div><p className="dashboard-eyebrow">Response timeline</p><h2>Response progress</h2></div>{assigned && <select value={responseStatus === 'assigned' ? 'assigned' : responseStatus} onChange={(event) => updateResponseStatus(incident.incident_id, event.target.value)} aria-label="Update response status"><option value="assigned" disabled>Assigned</option><option value="responding">En route</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>}</div><div className="timeline-track">{timeline.map((item, index) => <div className={`timeline-step ${item.complete ? 'complete' : ''} ${index === timeline.findIndex((step) => !step.complete) ? 'current' : ''}`} key={item.name}><span className="timeline-node">{item.complete ? '✓' : index + 1}</span><div><strong>{item.name}</strong><small>{item.detail}</small></div></div>)}</div></section>
        <section className="dashboard-panel emergency-map"><div className="panel-heading"><div><p className="dashboard-eyebrow">Live location</p><h2>Incident and officer map</h2><span>{positionAvailable ? 'Live incident location and authorized officer markers.' : 'Incident coordinates are unavailable.'}</span></div><button className="dashboard-button secondary" onClick={() => navigate(`/map?incident=${incident.incident_id}`)}>Open full map</button></div><SecurityMap incidents={[incident]} officers={officers} focusIncidentId={incident.incident_id} /></section>
      </div>
    </div>
  </>;
}

function distanceLabel(officer, incident) {
  const from = [Number(officer.latitude), Number(officer.longitude)];
  const to = [Number(incident.latitude), Number(incident.longitude)];
  if (from.some((value) => !Number.isFinite(value)) || to.some((value) => !Number.isFinite(value))) return '—';
  const radians = (value) => value * Math.PI / 180;
  const deltaLatitude = radians(to[0] - from[0]);
  const deltaLongitude = radians(to[1] - from[1]);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(deltaLongitude / 2) ** 2;
  const meters = 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km away` : `${Math.round(meters)} m away`;
}

function Overview({ incidents, stats, officers, navigate, setReportOpen }) {
  const critical = incidents.filter((item) => item.severity === 'critical' && isActive(item)).length;
  return <>
    <Header eyebrow="Campus security overview" title="Operations at a glance" description="Monitor response health without digging through the full incident history." action={<button className="dashboard-button primary" onClick={() => setReportOpen(true)}><ReportProblemOutlined /> Report incident</button>} />
    <div className="dashboard-stats overview-stats"><Stat icon={<DescriptionOutlined />} name="Total incidents" value={stats.total ?? incidents.length} tone="total" /><Stat icon={<WarningAmberOutlined />} name="Active incidents" value={stats.active ?? incidents.filter(isActive).length} tone="active" /><Stat icon={<WarningAmberOutlined />} name="Critical active" value={critical} tone="critical" /><Stat icon={<TaskAltOutlined />} name="Resolved incidents" value={stats.resolved ?? incidents.filter((item) => item.status === 'resolved').length} tone="resolved" /><Stat icon={<PeopleAltOutlined />} name="Active officers" value={officers.filter((item) => item.availability_status !== 'offline').length} tone="officers" /><Stat icon={<WarningAmberOutlined />} name="Recent SOS" value={incidents.filter((item) => item.is_sos).length} tone="sos" /></div>
    <section className="dashboard-tools"><div className="dashboard-panel analytics-panel"><AnalyticsCharts incidents={incidents} /></div><div className="dashboard-panel overview-brief"><div className="panel-heading"><div><p className="dashboard-eyebrow">Attention queue</p><h2>Response snapshot</h2><span>{incidents.filter(isActive).length} incident(s) still require attention.</span></div></div><div className="overview-links"><button onClick={() => navigate('/incidents/active')}>Open active incidents <span>→</span></button><button onClick={() => navigate('/sos')}>Review SOS alerts <span>→</span></button><button onClick={() => navigate('/map')}>Open live map <span>→</span></button></div></div></section>
  </>;
}

function IncidentView({ incidents, mode, privileged, changeStatus, updating, navigate }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ type: 'all', severity: 'all', status: 'all' });
  const source = incidents.filter((item) => mode === 'sos' ? item.is_sos : mode === 'history' ? !isActive(item) : isActive(item));
  const types = [...new Set(source.map((item) => item.type).filter(Boolean))];
  const filtered = source.filter((item) => (!query || `${item.type} ${item.description} ${item.location_name}`.toLowerCase().includes(query.toLowerCase())) && (filters.type === 'all' || item.type === filters.type) && (filters.severity === 'all' || item.severity === filters.severity) && (filters.status === 'all' || item.status === filters.status));
  return <section className="dashboard-panel incident-list-panel"><Header eyebrow={mode === 'sos' ? 'Emergency response' : mode === 'history' ? 'Archived response records' : 'Response queue'} title={mode === 'sos' ? 'SOS / Emergency' : mode === 'history' ? 'Incident history' : 'Active incidents'} description={mode === 'sos' ? 'Only emergency alerts are shown here.' : mode === 'history' ? 'Search and filter previous or resolved incidents.' : 'Only incidents that still require attention are shown.'} /><div className="incident-filters"><input aria-label="Search incidents" placeholder="Search incidents" value={query} onChange={(event) => setQuery(event.target.value)} />{[['type', types], ['severity', ['low', 'medium', 'high', 'critical']], ['status', STATUSES]].map(([key, options]) => <label key={key}>{text(key)}<select value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}><option value="all">All</option>{options.map((option) => <option key={option}>{text(option)}</option>)}</select></label>)}</div><IncidentTable incidents={filtered} privileged={privileged} updating={updating} changeStatus={changeStatus} navigate={navigate} /></section>;
}

function IncidentTable({ incidents, privileged, updating, changeStatus, navigate }) {
  if (!incidents.length) return <div className="dashboard-empty"><div className="empty-icon"><ShieldOutlined /></div><strong>No incidents found</strong><p>There are no records matching this view.</p></div>;
  return <div className="incident-table-wrap"><div className="incident-table-head"><span>Incident</span><span>Severity</span><span>Status</span><span>Location / time</span><span>Reporter</span><span>Assigned officer</span><span>Evidence</span><span>Action</span></div>{incidents.map((incident) => { const officer = responder(incident); return <div className="incident-row" key={incident.incident_id}><div className="incident-main"><span className="incident-type-icon"><ReportProblemOutlined /></span><div><strong>{text(incident.type)}</strong><p>{incident.description || 'No description provided'}</p></div></div><span className={`severity-badge ${incident.severity}`}>{incident.severity}</span><span className={`status-badge ${incident.status}`}>{text(incident.status)}</span><span className="incident-meta">{incident.location_name || incident.building || 'Unknown'}<small>{when(incident.created_at)}</small></span><span className="incident-meta">{incident.reporter?.name || (incident.is_anonymous ? 'Anonymous' : 'Campus member')}</span><span className="incident-meta">{officer?.name || 'Unassigned'}</span><span className="incident-meta"><EvidencePreview photos={incident.photos} /></span><div className="incident-action"><button className="text-action" onClick={() => navigate(`/incidents/${incident.incident_id}`)}>View details</button>{privileged && <select value={incident.status} onChange={(event) => changeStatus(incident.incident_id, event.target.value)} disabled={updating === incident.incident_id} aria-label={`Update status for ${text(incident.type)}`}>{STATUSES.map((status) => <option key={status}>{text(status)}</option>)}</select>}</div></div>; })}</div>;
}

function Details({ incidents, privileged, changeStatus, updating, navigate }) {
  const id = useLocation().pathname.split('/').pop();
  const incident = incidents.find((item) => String(item.incident_id) === String(id));
  if (!incident) return <Restricted message="Incident not found or no longer available." />;
  const officer = responder(incident);
  return <><Header eyebrow="Incident details" title={text(incident.type)} description={`${when(incident.created_at)} · ${incident.location_name || 'Location unavailable'}`} action={<button className="dashboard-button secondary" onClick={() => navigate('/incidents/active')}>Back to incidents</button>} /><div className="detail-grid"><section className="dashboard-panel detail-panel"><div className="panel-heading"><div><p className="dashboard-eyebrow">Report information</p><h2>Incident information</h2></div><span className={`severity-badge ${incident.severity}`}>{incident.severity}</span></div><dl className="detail-fields"><Field name="Status"><span className={`status-badge ${incident.status}`}>{text(incident.status)}</span></Field><Field name="Reporter">{incident.reporter?.name || (incident.is_anonymous ? 'Anonymous' : 'Campus member')}</Field><Field name="Date / time">{when(incident.created_at)}</Field><Field name="Building / room">{[incident.building, incident.room].filter(Boolean).join(' / ') || 'Not provided'}</Field><Field name="Description">{incident.description || 'No description provided'}</Field><Field name="Assigned officer">{officer?.name || 'Unassigned'}</Field><Field name="Assignment status">{incident.responses?.[0]?.status || 'Not assigned'}</Field><Field name="GPS coordinates">{incident.latitude != null && incident.longitude != null ? `${incident.latitude}, ${incident.longitude}` : 'Location unavailable'}</Field></dl>{privileged && <select className="detail-status-select" value={incident.status} onChange={(event) => changeStatus(incident.incident_id, event.target.value)} disabled={updating === incident.incident_id}>{STATUSES.map((status) => <option key={status}>{text(status)}</option>)}</select>}</section><section className="dashboard-panel detail-panel"><div className="panel-heading"><div><p className="dashboard-eyebrow">Attached media</p><h2>Evidence</h2></div></div><div className="detail-evidence"><EvidencePreview photos={incident.photos} /></div><div className="detail-timeline"><h3>Timeline</h3><p><strong>Reported</strong><span>{when(incident.created_at)}</span></p>{incident.responses?.map((response) => <p key={response.response_id}><strong>{text(response.status || 'assigned')}</strong><span>{response.responder?.name || 'Security officer'}</span></p>)}</div></section></div><section className="dashboard-panel detail-map-panel"><div className="panel-heading"><div><p className="dashboard-eyebrow">Location</p><h2>Incident map</h2></div>{incident.latitude != null && incident.longitude != null && <button className="dashboard-button secondary" onClick={() => navigate(`/map?incident=${incident.incident_id}`)}>View on Map</button>}</div><SecurityMap incidents={[incident]} officers={[]} focusIncidentId={incident.incident_id} /></section></>;
}

function MapPage({ incidents, officers, location, assignmentIncident, setAssignmentIncident, assign }) {
  const list = incidents.filter(isActive);
  const focus = new URLSearchParams(location.search).get('incident');
  return <><Header eyebrow="Live operations" title="Live map" description="Active incidents, SOS alerts, and authorized officer locations." /><section className="dashboard-panel security-map-panel"><div className="map-assignment-controls"><label htmlFor="assignment-incident">Incident to assign</label><select id="assignment-incident" value={assignmentIncident} onChange={(event) => setAssignmentIncident(event.target.value)}><option value="">Select an unassigned incident</option>{list.filter((item) => !item.responses?.length).map((item) => <option key={item.incident_id} value={item.incident_id}>{text(item.type)} · {item.location_name || 'Location unavailable'}</option>)}</select></div><SecurityMap incidents={list} officers={officers} focusIncidentId={focus} onAssign={assignmentIncident ? assign : undefined} /></section></>;
}

function EvidencePage({ incidents }) {
  return <><Header eyebrow="Incident records" title="Evidence" description="Photos attached to incident reports, resolved or active." /><section className="evidence-grid">{incidents.map((incident) => <article className="dashboard-panel evidence-card" key={incident.incident_id}><div><p className="dashboard-eyebrow">Incident #{incident.incident_id}</p><h2>{text(incident.type)}</h2><span>{when(incident.created_at)}</span></div><EvidencePreview photos={incident.photos} /></article>)}</section></>;
}

function OfficersPage({ officers, incidents }) {
  return <><Header eyebrow="Authorized response team" title="Security officers" description="Availability, assignments, and last known location status." /><section className="dashboard-panel"><div className="officer-grid">{officers.map((officer) => { const assignment = incidents.find((incident) => incident.responses?.some((response) => response.responder_id === officer.user_id)); return <article className="officer-card" key={officer.user_id}><div className="officer-card-heading"><strong>{officer.name}</strong><span className={`officer-status ${officer.availability_status || 'offline'}`}><i />{text(officer.availability_status || 'offline')}</span></div><Field name="Current assignment">{assignment ? text(assignment.type) : 'None'}</Field><Field name="Last location update">{when(officer.location_updated_at)}</Field><Field name="Current location">{officer.latitude != null && officer.longitude != null ? 'Available on live map' : 'Unavailable'}</Field></article>; })}</div></section></>;
}

function UsersPage({ users, loading, form, setForm, createUser, changeUserStatus }) {
  return <><Header eyebrow="Administration" title="User management" description="Manage campus access without leaving the security workspace." /><section className="dashboard-panel"><form onSubmit={createUser} className="admin-form"><div className="admin-form-grid">{[['name', 'Name', 'text'], ['email', 'Email', 'email'], ['password', 'Password', 'password']].map(([key, name, type]) => <label key={key}>{name}<input type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required /></label>)}<label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label></div><button className="dashboard-button primary" type="submit">Create user</button></form>{loading ? <div className="inline-loading">Loading users...</div> : <div className="user-table-wrap"><table className="dashboard-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map((item) => <tr key={item.user_id}><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.is_active ? 'Active' : 'Inactive'}</td><td><button className="table-action" onClick={() => changeUserStatus(item.user_id, !item.is_active)}>{item.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}</section></>;
}

function Header({ eyebrow, title: heading, description, action }) { return <section className="dashboard-welcome"><div><p className="dashboard-eyebrow">{eyebrow}</p><h1>{heading}</h1><p>{description}</p></div>{action}</section>; }
function Stat({ icon, name, value, tone }) { return <div className={`dashboard-stat-card ${tone}`}><span className="stat-icon">{icon}</span><div><span className="stat-label">{name}</span><strong>{value}</strong></div></div>; }
function Field({ name, children }) { return <div className="detail-field"><dt>{name}</dt><dd>{children}</dd></div>; }
function Nav({ to, icon, text: navText, count, active: selected }) { return <Link className={`dashboard-nav-link ${selected ? 'active' : ''}`} to={to}>{icon}<span className="nav-label">{navText}</span>{count !== undefined && <span>{count}</span>}</Link>; }
function Modal({ onClose, children }) { return <div className="dashboard-modal-overlay" onClick={onClose}><div className="dashboard-modal-content" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button>{children}</div></div>; }
function Loading() { return <div className="dashboard-loading"><div className="dashboard-loading-mark"><ShieldOutlined /></div><strong>Preparing your safety view</strong><span>Connecting to campus incident services...</span><div className="dashboard-loading-bar" /></div>; }
function Restricted({ message = 'This view is restricted to authorized security and admin users.' }) { return <div className="dashboard-empty"><div className="empty-icon"><ShieldOutlined /></div><strong>Access restricted</strong><p>{message}</p></div>; }
function sectionTitle(section) { return ({ overview: 'Overview', active: 'Active incidents', history: 'Incident history', details: 'Incident details', emergency: 'Emergency Response Center', map: 'Live map', sos: 'SOS / Emergency', evidence: 'Evidence', officers: 'Security officers', users: 'User management' })[section] || 'Overview'; }
function getSection(path) { if (path.startsWith('/incidents/active')) return 'active'; if (path.startsWith('/incidents/history')) return 'history'; if (path.startsWith('/incidents/')) return 'details'; return path.split('/')[1] || 'overview'; }