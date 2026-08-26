// src/components/Dashboard.jsx - Complete with Register and Report
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Close from '@mui/icons-material/Close';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import Logout from '@mui/icons-material/Logout';
import Menu from '@mui/icons-material/Menu';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import SpeedOutlined from '@mui/icons-material/SpeedOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { useEffect, useState } from 'react';
import api from '../services/api';
import incidentService from '../services/incidentService';
import { webSocket } from '../services/socket';
import AnalyticsCharts from './Analytics/AnalyticsCharts';
import ExportReports from './Analytics/ExportReports';
import SafetyChatbot from './Chatbot/SafetyChatbot';
import './Dashboard.css';
import Footer from './Footer';
import PushNotifications from './Notifications/PushNotifications';
import Register from './Register';
import ReportIncident from './ReportIncident';
import SecurityMap from './SecurityMap';

const ALLOWED_STATUS_VALUES = ['reported', 'investigating', 'resolved'];
const ADMIN_MANAGED_ROLE_OPTIONS = ['student', 'faculty', 'staff', 'security', 'admin'];

function Dashboard({ user, onLogout }) {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: '—', resolved: '—' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sosAlert, setSosAlert] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [userManagementLoading, setUserManagementLoading] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student'
  });

  const role = (user?.role || '').toLowerCase();
  const isPrivileged = ['security', 'admin'].includes(role);
  const isAdmin = role === 'admin';
  const pendingCount = incidents.filter((incident) => incident.status === 'investigating').length;
  const displayName = user?.name || 'Campus member';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    loadData();
    webSocket.connect();

    const handleUnauthorized = () => onLogout();
    const handleIncident = () => loadData();
    const handleSOSAlert = (alert) => {
      setSosAlert(alert);
      loadData();
    };
    window.addEventListener('campus-security:unauthorized', handleUnauthorized);
    webSocket.on('new-incident', handleIncident);
    webSocket.on('incident-updated', handleIncident);
    webSocket.on('incident_assigned', handleIncident);
    webSocket.on('sos_alert', handleSOSAlert);

    return () => {
      window.removeEventListener('campus-security:unauthorized', handleUnauthorized);
      webSocket.off('new-incident', handleIncident);
      webSocket.off('incident-updated', handleIncident);
      webSocket.off('incident_assigned', handleIncident);
      webSocket.off('sos_alert', handleSOSAlert);
      webSocket.disconnect();
    };
  }, []);

  const buildLocalStats = (incidentList) => ({
    total: incidentList.length,
    active: incidentList.filter((incident) => incident.status !== 'resolved').length,
    resolved: incidentList.filter((incident) => incident.status === 'resolved').length,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to view incidents');
        setLoading(false);
        return;
      }

      const currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');
      const isPrivileged = ['security', 'admin'].includes((currentUser?.role || '').toLowerCase());

      const incidentsData = await incidentService.getAll();
      const incidentList = incidentsData?.data || [];
      setIncidents(incidentList);

      if (isPrivileged) {
        try {
          const statsData = await incidentService.getStats();
          setStats(statsData?.data || buildLocalStats(incidentList));
        } catch (err) {
          if (err?.response?.status === 403) {
            setStats(buildLocalStats(incidentList));
          } else {
            throw err;
          }
        }
      } else {
        setStats(buildLocalStats(incidentList));
      }

      if (isPrivileged) {
        const officersData = await api.get('/users/security-officers');
        setOfficers(officersData?.data?.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (officerId) => {
    if (!selectedIncidentId || !officerId) return;
    try {
      await api.post(`/incidents/${selectedIncidentId}/assign`, { officer_id: officerId });
      setSelectedIncidentId('');
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to assign incident.');
    }
  };

  const handleStatusChange = async (incidentId, nextStatus) => {
    if (!nextStatus || !incidentId) return;

    try {
      setUpdatingStatusId(incidentId);
      await api.patch(`/incidents/${incidentId}/status`, { status: nextStatus });
      await loadData();
    } catch (error) {
      console.error('Error updating incident status:', error);
      setError('Failed to update incident status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const loadAdminUsers = async () => {
    try {
      setUserManagementLoading(true);
      const response = await api.get('/users/all');
      setAdminUsers(response?.data?.data || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load users.');
    } finally {
      setUserManagementLoading(false);
    }
  };

  const handleCreateAdminUser = async (event) => {
    event.preventDefault();

    if (!userForm.name || !userForm.email || !userForm.password) {
      setError('Name, email, and password are required.');
      return;
    }

    try {
      await api.post('/auth/admin/create-user', userForm);
      setUserForm({ name: '', email: '', password: '', role: 'student' });
      await loadAdminUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      setError(error.response?.data?.message || 'Failed to create user.');
    }
  };

  const handleUserStatusToggle = async (targetUserId, nextIsActive) => {
    try {
      await api.patch(`/users/${targetUserId}/status`, { is_active: nextIsActive });
      await loadAdminUsers();
    } catch (error) {
      console.error('Failed to update user status:', error);
      setError(error.response?.data?.message || 'Failed to update user status.');
    }
  };

  useEffect(() => {
    if ((user?.role || '').toLowerCase() === 'admin') {
      loadAdminUsers();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-mark"><ShieldOutlined /></div>
        <div><strong>Preparing your safety view</strong><span>Connecting to campus incident services...</span></div>
        <div className="dashboard-loading-bar" />
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand"><span className="dashboard-brand-mark"><ShieldOutlined /></span><span>Campus<span>Secure</span><small>Operations center</small></span></div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <a className="dashboard-nav-link active" href="#overview"><DashboardOutlined /> Overview</a>
          <a className="dashboard-nav-link" href="#incidents"><ReportProblemOutlined /> Incidents <span>{incidents.length}</span></a>
          <a className="dashboard-nav-link" href="#analytics"><AssessmentOutlined /> Analytics</a>
          {isAdmin && <a className="dashboard-nav-link" href="#users"><PeopleAltOutlined /> User management</a>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-safety-card"><span><SpeedOutlined /></span><strong>Response readiness</strong><p>Keep your campus response team informed and connected.</p></div>
        <div className="sidebar-user"><div className="dashboard-avatar">{initials}</div><div><strong>{displayName}</strong><span>{role || 'member'}</span></div><button onClick={onLogout} aria-label="Log out" title="Log out"><Logout /></button></div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-mobile-brand"><span className="dashboard-brand-mark"><ShieldOutlined /></span><strong>CampusSecure</strong></div>
          <div className="dashboard-breadcrumb"><span>Workspace</span><ChevronRight /><strong>Overview</strong></div>
          <div className="dashboard-top-actions"><span className="live-indicator"><i /> Services operational</span><button className="dashboard-mobile-menu" aria-label="Open navigation"><Menu /></button></div>
        </header>

        <div className="dashboard-content" id="overview">
          <section className="dashboard-welcome">
            <div><p className="dashboard-eyebrow">Campus security overview</p><h1>Good to see you, {displayName.split(' ')[0]}.</h1><p>Here&apos;s what&apos;s happening across your incident response workspace.</p></div>
            <div className="dashboard-actions"><button className="dashboard-button secondary" onClick={() => setShowRegister(true)}><PeopleAltOutlined /> Register user</button><button className="dashboard-button primary" onClick={() => setShowReport(true)}><ReportProblemOutlined /> Report incident</button></div>
          </section>

          {error && (
            <div className="dashboard-error" role="alert">
              <WarningAmberOutlined /><div><strong>We couldn&apos;t refresh the workspace</strong><p>{error}</p></div><button onClick={loadData}>Retry</button>
            </div>
          )}

          {sosAlert && (
            <div className="dashboard-error sos-live-alert" role="alert">
              <WarningAmberOutlined />
              <div>
                <strong>SOS Alert Sent</strong>
                <p>{sosAlert.type} · {sosAlert.reporter?.name || 'Campus member'} · {sosAlert.location_name || 'Location unavailable'}</p>
                <small>{sosAlert.created_at ? new Date(sosAlert.created_at).toLocaleString() : 'Just now'}</small>
              </div>
              <button onClick={() => document.getElementById('incidents')?.scrollIntoView({ behavior: 'smooth' })}>Open incident</button>
              <button onClick={() => setSosAlert(null)} aria-label="Dismiss SOS alert">Dismiss</button>
            </div>
          )}

          <div className="dashboard-stats">
            <div className="dashboard-stat-card total"><span className="stat-icon"><DescriptionOutlined /></span><div><span className="stat-label">Total incidents</span><strong>{typeof stats.total === 'number' ? stats.total : incidents.length}</strong><small>All reported incidents</small></div></div>
            <div className="dashboard-stat-card active"><span className="stat-icon"><WarningAmberOutlined /></span><div><span className="stat-label">Active incidents</span><strong>{typeof stats.active === 'number' ? stats.active : incidents.filter((incident) => incident.status !== 'resolved').length}</strong><small>Requiring attention</small></div></div>
            <div className="dashboard-stat-card resolved"><span className="stat-icon"><TaskAltOutlined /></span><div><span className="stat-label">Resolved incidents</span><strong>{typeof stats.resolved === 'number' ? stats.resolved : incidents.filter((incident) => incident.status === 'resolved').length}</strong><small>Successfully closed</small></div></div>
            <div className="dashboard-stat-card pending"><span className="stat-icon"><SpeedOutlined /></span><div><span className="stat-label">Investigating</span><strong>{pendingCount}</strong><small>Currently in progress</small></div></div>
          </div>

          {isPrivileged && (
            <section className="dashboard-panel security-map-panel" id="security-map">
              <div className="panel-heading">
                <div><p className="dashboard-eyebrow">Live response map</p><h2>Officers and SOS locations</h2><span>Only active security officers with valid locations are shown.</span></div>
              </div>
              <div className="map-assignment-controls">
                <label htmlFor="assignment-incident">Incident to assign</label>
                <select id="assignment-incident" value={selectedIncidentId} onChange={(event) => setSelectedIncidentId(event.target.value)}>
                  <option value="">Select an unassigned incident</option>
                  {incidents.filter((incident) => !incident.responses?.length && incident.status !== 'resolved').map((incident) => (
                    <option key={incident.incident_id} value={incident.incident_id}>{incident.is_sos ? 'SOS' : incident.type} · {incident.location_name || 'Location unavailable'}</option>
                  ))}
                </select>
              </div>
              <SecurityMap incidents={incidents} officers={officers} onAssign={selectedIncidentId ? handleAssign : undefined} />
            </section>
          )}

          {isAdmin && (
            <div className="dashboard-panel admin-panel" id="users">
              <div className="panel-heading"><div><p className="dashboard-eyebrow">Administration</p><h2>User management</h2><span>Manage campus access without leaving the security workspace.</span></div><PeopleAltOutlined /></div>

              <form onSubmit={handleCreateAdminUser} className="admin-form">
                <div className="admin-form-grid">
                  <div>
                    <label>Name</label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label>Email</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label>Password</label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label>Role</label>
                    <select
                      value={userForm.role}
                      onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
                    >
                      {ADMIN_MANAGED_ROLE_OPTIONS.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>{roleOption}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="dashboard-button primary">Create user <ChevronRight /></button>
              </form>

              <div className="user-table-wrap">
                <div className="table-heading"><h3>Existing users</h3><span>{adminUsers.length} accounts</span></div>
                {userManagementLoading ? (
                  <div className="inline-loading"><span /> Loading users...</div>
                ) : (
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((adminUser) => (
                        <tr key={adminUser.user_id}>
                          <td data-label="Name"><strong>{adminUser.name}</strong></td>
                          <td data-label="Email">{adminUser.email}</td>
                          <td data-label="Role"><span className={`role-badge ${adminUser.role}`}>{adminUser.role}</span></td>
                          <td data-label="Status"><span className={`account-status ${adminUser.is_active ? 'active' : 'inactive'}`}><i />{adminUser.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td data-label="Action">
                            <button
                              onClick={() => handleUserStatusToggle(adminUser.user_id, !adminUser.is_active)}
                              className={`table-action ${adminUser.is_active ? 'deactivate' : 'activate'}`}
                            >
                              {adminUser.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <section className="dashboard-tools" id="analytics"><div className="dashboard-panel analytics-panel"><AnalyticsCharts incidents={incidents} /></div><div className="dashboard-side-tools"><ExportReports incidents={incidents} /><PushNotifications /></div></section>

          <div className="dashboard-panel incident-list-panel" id="incidents">
            <div className="panel-heading incident-heading"><div><p className="dashboard-eyebrow">Response queue</p><h2>Incident activity</h2><span>Review reports and keep status information current.</span></div><span className="incident-count">{incidents.length} total</span></div>
            {incidents.length === 0 ? (
              <div className="dashboard-empty">
                <div className="empty-icon"><ShieldOutlined /></div><strong>No incidents found</strong><p>Your response queue is clear. New reports will appear here.</p><button className="dashboard-button primary" onClick={() => setShowReport(true)}><ReportProblemOutlined /> Report an incident</button>
              </div>
            ) : (
              <div className="incident-table-wrap"><div className="incident-table-head"><span>Incident</span><span>Severity</span><span>Status</span><span>Location</span><span>Reported</span><span>Action</span></div>{incidents.map((incident) => (
                <div key={incident.incident_id} className="incident-row">
                  <div className="incident-main"><span className="incident-type-icon"><ReportProblemOutlined /></span><div><strong>{(incident.type || 'incident').replace('_', ' ')}</strong><p>{incident.description || 'No description provided'}</p></div></div>
                  <span className={`severity-badge ${incident.severity || 'medium'}`}>{incident.severity || 'medium'}</span>
                  <span className={`status-badge ${incident.status || 'reported'}`}>{incident.status || 'reported'}</span>
                  <span className="incident-meta"><span>Location</span>{incident.location_name || incident.building || 'Unknown'}</span>
                  <span className="incident-meta"><span>Date / time</span>{new Date(incident.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <div className="incident-action">
                    {isPrivileged ? <select id={`status-${incident.incident_id}`} value={incident.status} onChange={(event) => handleStatusChange(incident.incident_id, event.target.value)} disabled={updatingStatusId === incident.incident_id} aria-label={`Update status for ${incident.type}`}><option value="reported">Reported</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select> : <ChevronRight />}
                    {isPrivileged ? <select id={`status-${incident.incident_id}`} value={incident.status} onChange={(event) => handleStatusChange(incident.incident_id, event.target.value)} disabled={updatingStatusId === incident.incident_id} aria-label={`Update status for ${incident.type}`}><option value="reported">Reported</option><option value="investigating">Investigating</option><option value="dispatched">Assigned</option><option value="on_scene">Responding</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select> : <ChevronRight />}
                  </div>
                </div>
              ))}</div>
            )}
          </div>
        </div>

        {showRegister && (
          <div className="dashboard-modal-overlay" onClick={() => setShowRegister(false)}>
            <div className="dashboard-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowRegister(false)} aria-label="Close registration"><Close /></button>
              <Register onSwitchToLogin={() => setShowRegister(false)} />
            </div>
          </div>
        )}

        {showReport && (
          <div className="dashboard-modal-overlay" onClick={() => setShowReport(false)}>
            <div className="dashboard-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowReport(false)} aria-label="Close report form"><Close /></button>
              <ReportIncident
                onClose={() => setShowReport(false)}
                onSuccess={loadData}
              />
            </div>
          </div>
        )}

        <Footer />
        <SafetyChatbot />
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Arial, sans-serif' },
  header: { background: '#2196F3', color: 'white', padding: '15px 30px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  headerContent: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '15px' },
  title: { margin: 0, fontSize: '24px' },
  emergencyBadge: { backgroundColor: '#FF1744', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '15px' },
  userAvatar: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: '18px', fontWeight: 'bold' },
  userDetails: { display: 'flex', flexDirection: 'column' },
  userName: { color: 'white', fontSize: '14px', fontWeight: 'bold' },
  userRole: { color: 'rgba(255,255,255,0.7)', fontSize: '12px', textTransform: 'capitalize' },
  registerBtn: { backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '20px', cursor: 'pointer' },
  reportBtn: { backgroundColor: '#FF9800', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '20px', cursor: 'pointer' },
  logoutBtn: { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '20px', cursor: 'pointer' },
  content: { padding: '30px', maxWidth: '1200px', margin: '0 auto' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' },
  statCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' },
  incidentList: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  incidentCard: { border: '1px solid #eee', padding: '15px', borderRadius: '8px', marginBottom: '10px' },
  incidentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  statusBadge: { backgroundColor: '#FF9800', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' },
  severityBadge: { backgroundColor: '#F44336', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', marginRight: '10px' },
  incidentFooter: { display: 'flex', gap: '15px', alignItems: 'center', fontSize: '13px', color: '#666', marginTop: '8px', flexWrap: 'wrap' },
  emptyState: { textAlign: 'center', padding: '40px', color: '#999' },
  emptyIcon: { fontSize: '48px', display: 'block', marginBottom: '10px' },
  emptySubText: { fontSize: '14px', marginTop: '5px' },
  error: { background: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' },
  retryBtn: { background: '#c62828', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer' },
  statusControl: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' },
  statusLabel: { fontSize: '13px', fontWeight: 'bold', color: '#333' },
  statusSelect: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', minWidth: '150px' },
  adminPanel: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '24px', marginBottom: '24px' },
  adminTitle: { marginTop: 0, marginBottom: '16px', fontSize: '24px' },
  adminForm: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' },
  adminFormGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' },
  adminLabel: { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' },
  adminInput: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box' },
  adminButton: { alignSelf: 'flex-start', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 16px', cursor: 'pointer' },
  userTableWrap: { overflowX: 'auto' },
  userTableTitle: { margin: '0 0 12px' },
  userTable: { width: '100%', borderCollapse: 'collapse' },
  userTableCell: { border: '1px solid #eee', padding: '10px', textAlign: 'left' },
  toggleUserButton: { border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' },
  loading: { textAlign: 'center', padding: '50px', fontSize: '18px', color: '#666' },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto'
  }
};

export default Dashboard;
