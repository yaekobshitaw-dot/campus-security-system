import {
  CheckCircleOutline,
  Close,
  ErrorOutline,
  PeopleAltOutlined,
  Refresh,
  ReportProblemOutlined,
  ShieldOutlined,
  WarningAmberOutlined
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import api from '../services/api';
import { DashboardLayout, formatIncidentStatus, IncidentStatusBadge, IncidentTable, UserAvatar } from './DashboardLayout';
import DashboardBackButton from './DashboardBackButton';
import EvidencePreview from './EvidencePreview';
import SecurityMap from './SecurityMap.jsx';
import MLDashboard from './MLDashboard.jsx';
import IncidentCreateModal from './IncidentCreateModal';
import ZoneManagement from './ZoneManagement';
import { AlertsZonesPage, AnalyticsPage, ResponsesPage } from './OperationsPages';
import StudentAnalyticsPage from './StudentAnalyticsPage';
import AnnouncementsPage from './AnnouncementsPage';
import CampusLocationsPage from './CampusLocationsPage';
import SmsBroadcastPage from './SmsBroadcastPage';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import UserManagementPage from './UserManagementPage';
import ProfilePage from './ProfilePage';
import SettingsPage from './SettingsPage';
import { AuditLogsPage, ContentManagementPage, NotificationsPage } from './AdminPages';
import { readAlert } from '../services/operations';
import webSocket from '../services/socket';
import { getUserPreferences } from '../utils/appearance';
import { useTranslate } from '../utils/language';

const activeStatuses = ['reported', 'assigned', 'accepted', 'in_progress', 'investigating', 'dispatched', 'on_scene', 'declined', 'unassigned'];
const overviewMetricColors = {
  total: '#2563eb',
  active: '#06b6d4',
  critical: '#f97316',
  officers: '#10b981',
};
const officialCampusImage = '/images/campus-4.jpg';
const routes = {
  '/dashboard': 'overview', '/profile': 'profile', '/incidents/active': 'incidents', '/incidents/history': 'history',
  '/map': 'map', '/sos': 'sos', '/emergency': 'emergency', '/evidence': 'evidence',
  '/officers': 'officers', '/users': 'users',
  '/analytics': 'analytics', '/responses': 'responses', '/alerts': 'alerts', '/zones': 'zones', '/ml': 'ml',
  '/announcements': 'announcements', '/locations': 'locations',
  '/sms': 'sms',
  '/notifications': 'notifications', '/audit-logs': 'auditLogs', '/content': 'content', '/settings': 'settings',
};
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusLabel = formatIncidentStatus;
const validOfficerCoordinates = (officer) => officer?.latitude !== null && officer?.latitude !== undefined
  && officer?.longitude !== null && officer?.longitude !== undefined
  && officer?.latitude !== '' && officer?.longitude !== ''
  && Number.isFinite(Number(officer?.latitude))
  && Number(officer.latitude) >= -90 && Number(officer.latitude) <= 90
  && Number.isFinite(Number(officer?.longitude))
  && Number(officer.longitude) >= -180 && Number(officer.longitude) <= 180;
const validIncidentCoordinates = (incident) => incident?.latitude !== null && incident?.latitude !== undefined
  && incident?.longitude !== null && incident?.longitude !== undefined
  && String(incident.latitude).trim() !== '' && String(incident.longitude).trim() !== ''
  && Number.isFinite(Number(incident.latitude))
  && Number(incident.latitude) >= -90 && Number(incident.latitude) <= 90
  && Number.isFinite(Number(incident.longitude))
  && Number(incident.longitude) >= -180 && Number(incident.longitude) <= 180;
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

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = (event) => setPrefersReducedMotion(event.matches);
    setPrefersReducedMotion(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function OverviewMetricTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const metric = payload[0].payload;
  return (
    <div className="dashboard-overview-tooltip">
      <span className="dashboard-overview-tooltip-swatch" style={{ '--metric-color': metric.color }} />
      <span className="dashboard-overview-tooltip-name">{metric.name}</span>
      <strong>{metric.displayValue}</strong>
    </div>
  );
}

function OverviewMetricsChart({ metrics, total }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const t = useTranslate();
  const [activeIndex, setActiveIndex] = useState(-1);
  const chartMetrics = metrics.map((metric) => ({
    ...metric,
    value: Number.isFinite(Number(metric.value)) ? Math.max(0, Number(metric.value)) : 0,
  }));

  return (
    <section className="dashboard-panel dashboard-overview-chart">
      <div className="dashboard-overview-chart-heading">
        <div>
          <p className="dashboard-eyebrow">{t('Live operations')}</p>
          <h3>{t('Campus activity')}</h3>
          <p>{t('Current incident and response metrics at a glance.')}</p>
        </div>
        <span className="dashboard-overview-live"><span />{t('Live data')}</span>
      </div>
      <div className="dashboard-overview-chart-body">
        <div className="dashboard-overview-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartMetrics}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="82%"
                paddingAngle={3}
                cornerRadius={5}
                startAngle={90}
                endAngle={-270}
                activeIndex={activeIndex}
                activeShape={prefersReducedMotion ? false : (shape) => (
                  <Sector
                    {...shape}
                    outerRadius={shape.outerRadius + 6}
                    stroke="var(--dashboard-surface)"
                    strokeWidth={3}
                  />
                )}
                isAnimationActive={!prefersReducedMotion}
                animationDuration={900}
                animationEasing="ease-out"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
              >
                {chartMetrics.map((metric) => (
                  <Cell
                    key={metric.name}
                    fill={metric.color}
                    stroke="var(--dashboard-surface)"
                    strokeWidth={3}
                  />
                ))}
              </Pie>
              <Tooltip
                content={<OverviewMetricTooltip />}
                isAnimationActive={!prefersReducedMotion}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="dashboard-overview-donut-center" aria-hidden="true">
            <span>Total incidents</span>
            <strong>{total}</strong>
            <small>on campus</small>
          </div>
        </div>
        <ul className="dashboard-overview-legend" aria-label="Overview metrics">
          {metrics.map((metric) => (
            <li key={metric.name} className="dashboard-overview-legend-item">
              <span className="dashboard-overview-legend-swatch" style={{ '--metric-color': metric.color }} />
              <span className="dashboard-overview-legend-label">{metric.name}</span>
              <strong>{metric.displayValue}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const Heading = ({ eyebrow, title, description, action }) => (
  <div className="dashboard-heading mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-eyebrow">{eyebrow}</p><h2 className="mt-1.5 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">{title}</h2>{description && <span className="mt-1 block max-w-2xl text-sm leading-6 text-slate-500">{description}</span>}</div>{action && <div className="flex flex-wrap items-center gap-2">{action}</div>}</div>
);

function CampusOverviewImage() {
  const [imageSource, setImageSource] = useState(officialCampusImage);

  return (
    <figure className="relative min-h-[132px] overflow-hidden md:min-h-[168px]">
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={imageSource}
        alt="Mekdela Amba University campus grounds and buildings"
        loading="lazy"
        onError={() => {
          if (imageSource === '/images/campus-5.jpg') return;
          setImageSource('/images/campus-5.jpg');
        }}
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 pb-2 pt-7 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-white">
        Mekdela Amba University campus
      </figcaption>
    </figure>
  );
}

const EmptyState = ({ icon: Icon = CheckCircleOutline, title, message }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><Icon className="mb-3 rounded-2xl bg-emerald-50 p-3 text-[54px] text-emerald-700 ring-1 ring-emerald-100" /><h3 className="text-lg font-black text-[#0b1f3a]">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{message}</p></div>
);

const RequestError = ({ message, onRetry }) => (
  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/80 p-8 text-center shadow-sm">
    <ErrorOutline className="mb-3 text-[42px] text-red-600" />
    <h3 className="text-lg font-black text-red-900">{message}</h3>
    <button type="button" className="mt-4 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-black text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2" onClick={onRetry}>Retry</button>
  </div>
);

const AccessDenied = () => <EmptyState icon={ShieldOutlined} title="Access denied" message="Your account does not have permission to view this section." />;

const resourceNames = ['incidents', 'history', 'alerts', 'zones', 'campusLocations', 'users', 'stats', 'analytics', 'responses', 'officers'];
const initialResourceState = resourceNames.reduce((state, name) => ({ ...state, [name]: { status: ['incidents', 'history', 'alerts', 'zones'].includes(name) ? 'loading' : 'idle', error: '' } }), {});
const resourceStatus = (value) => {
  if (Array.isArray(value)) return value.length ? 'success' : 'empty';
  if (value && typeof value === 'object') return Object.keys(value).length ? 'success' : 'empty';
  return 'empty';
};

const notificationIsRead = (value) => value === true || value === 1
  || (typeof value === 'string' && ['1', 'true'].includes(value.trim().toLowerCase()));
const notificationType = (item) => {
  const type = String(item.type || '').toLowerCase();
  if (item.is_sos || type.includes('sos')) return 'sos';
  if (type.includes('incident')) return 'incident';
  if (type.includes('response') || type.includes('assignment')) return 'response';
  return 'alert';
};
const normalizeNotification = (item) => {
  let data = item.data || {};
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = {};
    }
  }
  const type = notificationType({ ...item, ...data });
  return {
    id: item.notification_id ?? item.id ?? item.incident_id ?? item.alert_id,
    notification_id: item.notification_id ?? item.id,
    incident_id: item.incident_id ?? data.incident_id,
    alert_id: item.alert_id ?? data.alert_id,
    link: item.link ?? item.target_url ?? data.link ?? data.target_url,
    title: item.title || (type === 'sos' ? '🚨 SOS Emergency Alert' : type === 'incident' ? 'New incident reported' : 'New alert'),
    message: item.message || data.message || 'A new security notification has been received.',
    type,
    severity: item.severity || data.severity || (type === 'sos' ? 'critical' : 'high'),
    incident_type: item.incident_type || data.incident_type || data.type,
    latitude: item.latitude ?? data.latitude,
    longitude: item.longitude ?? data.longitude,
    location_name: item.location_name || data.location_name || data.location || data.building,
    created_at: item.created_at,
    read: notificationIsRead(item.is_read ?? item.read),
  };
};
const notificationHistoryStorageKey = (userId) => `campus-security:notifications:${userId}`;
const readNotificationHistory = (userId) => {
  if (!userId) return [];
  try {
    const stored = sessionStorage.getItem(notificationHistoryStorageKey(userId));
    const items = stored ? JSON.parse(stored) : [];
    return Array.isArray(items)
      ? items.map((item) => ({ ...normalizeNotification(item), realtimeOnly: true }))
      : [];
  } catch (storageError) {
    console.error('Unable to read notification history from session storage.', storageError);
    return [];
  }
};
const mergeNotifications = (serverNotifications, currentNotifications) => {
  const realtimeOnly = currentNotifications.filter((current) => current.realtimeOnly && !serverNotifications.some((server) => (
    (server.notification_id && String(server.notification_id) === String(current.notification_id || current.id))
    || (server.alert_id && current.alert_id && String(server.alert_id) === String(current.alert_id))
    || (server.incident_id && current.incident_id
      && String(server.incident_id) === String(current.incident_id)
      && server.type === current.type)
  )));
  return [...serverNotifications, ...realtimeOnly];
};

function Dashboard({ user: authenticatedUser, onUserUpdated = () => {}, onLogout = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [historyIncidents, setHistoryIncidents] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState([]);
  const [zones, setZones] = useState([]);
  const [campusLocations, setCampusLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [userStatusLoading, setUserStatusLoading] = useState('');
  const [userUpdateLoading, setUserUpdateLoading] = useState(false);
  const [clearHistoryLoading, setClearHistoryLoading] = useState(false);
  const [mapNavigationError, setMapNavigationError] = useState('');
  const [assignmentLoading, setAssignmentLoading] = useState('');
  const [assignmentResponseLoading, setAssignmentResponseLoading] = useState('');
  const assignmentInFlight = useRef(false);
  const assignmentResponseInFlight = useRef(false);
  const [assignmentRequests, setAssignmentRequests] = useState([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [historySuccess, setHistorySuccess] = useState('');
  const [notificationHistoryError, setNotificationHistoryError] = useState('');
  const user = authenticatedUser || {};
  const [notifications, setNotifications] = useState(() => readNotificationHistory(user.user_id));
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationCountError, setNotificationCountError] = useState('');
  const notificationRequestVersion = useRef(0);
  const notificationClearInProgress = useRef(false);
  const [incidentToast, setIncidentToast] = useState(null);
  const [sosToast, setSosToast] = useState(null);
  const shownIncidentToasts = useRef(new Set(notifications.map((notification) => String(notification.id))));
  const shownSosToasts = useRef(new Set(
    notifications
      .filter((notification) => notification.type === 'sos')
      .map((notification) => String(notification.id)),
  ));
  const [userPreferences, setUserPreferences] = useState(() => getUserPreferences(user.user_id));
  const [error, setError] = useState('');
  const [, setOperationsError] = useState('');
  const [resourceState, setResourceState] = useState(initialResourceState);
  const [createOpen, setCreateOpen] = useState(false);
  const section = routes[location.pathname] || (location.pathname.startsWith('/incidents/') ? 'detail' : 'overview');
  const canViewOperations = ['security', 'security_officer', 'admin'].includes(String(user.role || '').toLowerCase());
  const canViewMap = ['security', 'security_officer', 'admin'].includes(String(user.role || '').trim().toLowerCase());
  const canReviewAssignments = ['security', 'security_officer', 'admin'].includes(String(user.role || '').toLowerCase());
  const showAssignmentRequests = canReviewAssignments && String(user.role || '').toLowerCase() !== 'admin';
  const canCreateIncidents = ['student', 'faculty', 'staff'].includes(String(user.role || '').trim().toLowerCase());
  const canViewCampusLocations = ['faculty', 'staff', 'security', 'security_officer', 'admin'].includes(String(user.role || '').trim().toLowerCase());
  const canReportIncident = canCreateIncidents;
  const canAssignIncidents = ['security', 'security_officer', 'admin'].includes(String(user.role || '').trim().toLowerCase());
  const canChangeIncidentStatus = String(user.role || '').trim().toLowerCase() === 'admin';
  const canViewUsers = user.role === 'admin';
  const isStudent = String(user.role || '').trim().toLowerCase() === 'student';
  const protectedSection = (['users', 'sms'].includes(section) && !canViewUsers)
    || (['officers', 'responses'].includes(section) && !canViewOperations)
    || (section === 'locations' && !canViewCampusLocations)
    || (section === 'analytics' && !canViewOperations && !isStudent)
    || (section === 'map' && !canViewMap);

  const loadNotifications = useCallback(async () => {
    if (notificationClearInProgress.current) return;
    const requestVersion = ++notificationRequestVersion.current;
    try {
      const response = await api.get('/notifications');
      if (requestVersion !== notificationRequestVersion.current) return;
      const items = Array.isArray(response.data?.data) ? response.data.data : [];
      const serverNotifications = items.map(normalizeNotification);
      setNotifications((current) => mergeNotifications(serverNotifications, current));
      setNotificationsLoaded(true);
      setNotificationCountError('');
    } catch (requestError) {
      if (requestVersion !== notificationRequestVersion.current) return;
      setNotificationCountError(requestError.response?.data?.message || 'Unable to load your notifications.');
    }
  }, []);

  useEffect(() => {
    if (section === 'notifications') return;
    loadNotifications();
  }, [loadNotifications, section, user.user_id]);

  useEffect(() => {
    if (!user.user_id) return;
    try {
      sessionStorage.setItem(notificationHistoryStorageKey(user.user_id), JSON.stringify(notifications));
    } catch (storageError) {
      console.error('Unable to save notification history to session storage.', storageError);
    }
  }, [notifications, user.user_id]);

  useEffect(() => {
    if (!incidentToast) return undefined;
    const timeoutId = window.setTimeout(() => setIncidentToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [incidentToast]);

  useEffect(() => {
    if (!sosToast) return undefined;
    const timeoutId = window.setTimeout(() => setSosToast(null), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [sosToast]);

  useEffect(() => {
    if (!historySuccess) return undefined;
    const timeoutId = window.setTimeout(() => setHistorySuccess(''), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [historySuccess]);

  useEffect(() => {
    setUserPreferences(getUserPreferences(user.user_id));
    const refreshPreferences = (event) => {
      if (event.detail?.userId === user.user_id) setUserPreferences(getUserPreferences(user.user_id));
    };
    window.addEventListener('campussecure:preferences-changed', refreshPreferences);
    return () => window.removeEventListener('campussecure:preferences-changed', refreshPreferences);
  }, [user.user_id]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
      setStatsLoading(true);
    }
    const requests = [api.get('/incidents'), api.get('/incidents/history'), api.get('/alerts'), api.get('/zones'), api.get('/campus-locations')];
      const requestedResources = ['incidents', 'history', 'alerts', 'zones', 'campusLocations'];
      if (canViewUsers) requestedResources.push('users');
      if (canViewOperations) requestedResources.push('stats', 'analytics', 'responses', 'officers');
      if (!silent) {
        setResourceState((current) => ({
          ...current,
          ...requestedResources.reduce((state, name) => ({ ...state, [name]: { status: 'loading', error: '' } }), {}),
        }));
      }
    const userIndex = canViewUsers ? requests.push(api.get('/users/all')) - 1 : -1;
    const statsIndex = canViewOperations ? requests.push(api.get('/incidents/stats')) - 1 : -1;
    const analyticsIndex = canViewOperations ? requests.push(api.get('/analytics')) - 1 : -1;
    const responseIndex = canViewOperations ? requests.push(api.get('/responses')) - 1 : -1;
    const officersIndex = canViewOperations ? requests.push(api.get('/users/security-officers')) - 1 : -1;
    const assignmentIndex = canReviewAssignments ? requests.push(api.get('/incidents/responses/pending')) - 1 : -1;
    const results = await Promise.allSettled(requests);
    const [incidentResult, historyResult, alertResult, zoneResult, campusLocationResult] = results;
    const userResult = userIndex >= 0 ? results[userIndex] : null;
    const statsResult = statsIndex >= 0 ? results[statsIndex] : null;
    const analyticsResult = analyticsIndex >= 0 ? results[analyticsIndex] : null;
    const responseResult = responseIndex >= 0 ? results[responseIndex] : null;
    const officersResult = officersIndex >= 0 ? results[officersIndex] : null;
    const assignmentResult = assignmentIndex >= 0 ? results[assignmentIndex] : null;
      const resourceResults = { incidents: incidentResult, history: historyResult, alerts: alertResult, zones: zoneResult, campusLocations: campusLocationResult, users: userResult, stats: statsResult, analytics: analyticsResult, responses: responseResult, officers: officersResult };
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
    if (historyResult.status === 'fulfilled') setHistoryIncidents(historyResult.value.data?.data || []);
    if (alertResult.status === 'fulfilled') setAlerts(alertResult.value.data?.data || []);
    if (userResult?.status === 'fulfilled') setUsers(userResult.value.data?.data || []);
    if (statsResult?.status === 'fulfilled') setServerStats(statsResult.value.data?.data || null);
    if (zoneResult.status === 'fulfilled') setZones(zoneResult.value.data?.data || []);
    if (campusLocationResult.status === 'fulfilled') setCampusLocations(campusLocationResult.value.data?.data || []);
    if (analyticsResult?.status === 'fulfilled') setAnalytics(analyticsResult.value.data?.data || null);
    if (responseResult?.status === 'fulfilled') setResponses(responseResult.value.data?.data || []);
    if (officersResult?.status === 'fulfilled') setOfficers(officersResult.value.data?.data || []);
    if (assignmentResult?.status === 'fulfilled') {
      setAssignmentRequests(assignmentResult.value.data?.data || []);
      setAssignmentError('');
    } else if (assignmentResult?.status === 'rejected') {
      setAssignmentRequests([]);
      setAssignmentError(assignmentResult.reason?.response?.data?.message || 'Unable to load assignment requests.');
    }
    if (results.every((result) => result.status === 'rejected')) setError('The dashboard API did not return data. Check the backend connection and your session.');
    else if (results.some((result) => result.status === 'rejected')) setError('Some dashboard data could not be loaded. Available data remains visible.');
    const operationsResults = [zoneResult, campusLocationResult, statsResult, analyticsResult, responseResult, officersResult].filter(Boolean);
    setOperationsError(operationsResults.every((result) => result.status === 'rejected') ? 'Operations data is unavailable for this account.' : '');
    if (!silent) {
      setStatsLoading(false);
      setOperationsLoading(false);
      setLoading(false);
    }
  }, [canReviewAssignments, canViewOperations, canViewUsers]);
  useEffect(() => { loadData(); }, [loadData]);
  const autoRefreshInProgress = useRef(false);
  useEffect(() => {
    const intervalSeconds = Number(userPreferences.autoRefreshSeconds);
    const role = String(user.role || '').trim().toLowerCase();
    if (
      !Number.isFinite(intervalSeconds)
      || intervalSeconds <= 0
      || !['admin', 'security', 'security_officer'].includes(role)
    ) return undefined;

    const intervalId = window.setInterval(() => {
      if (autoRefreshInProgress.current) return;
      autoRefreshInProgress.current = true;
      loadData({ silent: true }).finally(() => {
        autoRefreshInProgress.current = false;
      });
    }, intervalSeconds * 1000);
    return () => window.clearInterval(intervalId);
  }, [loadData, user.role, userPreferences.autoRefreshSeconds]);
  useEffect(() => {
    webSocket.connect();
    const refreshOperationalData = () => loadData();
    const addNotification = (payload, type) => {
      const incidentId = payload?.incident_id || payload?.incident?.incident_id || payload?.alert?.incident_id;
      const notificationId = incidentId || payload?.alert_id || Date.now();
      const isSOS = type === 'sos' || payload?.is_sos || payload?.type === 'sos_alert';
      const notificationType = isSOS ? 'sos' : type === 'alert' ? 'alert' : 'incident';
      if (!userPreferences.inAppNotifications
        || (isSOS && !userPreferences.sosNotifications)
        || (!isSOS && type === 'alert' && !userPreferences.alertNotifications)
        || (!isSOS && type !== 'alert' && !userPreferences.incidentNotifications)) return;
      const title = isSOS ? '🚨 SOS Emergency Alert' : notificationType === 'alert' ? payload?.title || 'New alert' : 'New incident reported';
      const message = isSOS
        ? 'An SOS emergency has been reported.'
        : notificationType === 'alert' ? payload?.message || 'A new security alert has been received.' : 'A new security incident has been reported.';
      setNotifications((current) => {
        const existing = current.find((notification) => notification.id === notificationId);
        if (existing) {
          return current.map((notification) => notification.id === notificationId ? {
            ...notification,
            incident_id: incidentId || notification.incident_id,
            alert_id: payload?.alert_id || notification.alert_id,
            link: payload?.link || payload?.target_url || notification.link,
            title,
            message,
            type: notificationType,
            severity: payload?.severity || notification.severity,
            latitude: payload?.latitude ?? payload?.incident?.latitude ?? notification.latitude,
            longitude: payload?.longitude ?? payload?.incident?.longitude ?? notification.longitude,
            location_name: payload?.location_name || notification.location_name,
            created_at: payload?.created_at || notification.created_at,
          } : notification);
        }
        return [{
          id: notificationId,
          notification_id: payload?.notification_id || payload?.id,
          realtimeOnly: true,
          incident_id: incidentId,
          alert_id: payload?.alert_id,
          link: payload?.link || payload?.target_url,
          title,
          type: notificationType,
          message,
          severity: payload?.severity || (payload?.is_sos ? 'critical' : 'high'),
          incident_type: payload?.incident_type || payload?.incident?.type || payload?.type,
          latitude: payload?.latitude ?? payload?.incident?.latitude,
          longitude: payload?.longitude ?? payload?.incident?.longitude,
          location_name: payload?.location_name || payload?.building || payload?.incident?.location_name || payload?.incident?.building,
          created_at: payload?.created_at || new Date().toISOString(),
          read: false,
        }, ...current].slice(0, 20);
      });
      loadNotifications();
      loadData();
    };
    const handleIncident = (incident) => {
      addNotification(incident, incident?.is_sos ? 'sos' : 'incident');
      const incidentId = incident?.incident_id;
      if (
        String(user.role || '').toLowerCase() !== 'admin'
        || !incidentId
        || shownIncidentToasts.current.has(String(incidentId))
        || !userPreferences.inAppNotifications
        || !userPreferences.incidentNotifications
      ) return;
      shownIncidentToasts.current.add(String(incidentId));
      setIncidentToast({
        id: incidentId,
        type: titleCase(incident.type || 'incident'),
        location: incident.location_name || incident.building || '',
      });
    };
    const handleSos = (alert) => {
      addNotification(alert, 'sos');
      const incident = alert?.incident || {};
      const incidentId = alert?.incident_id || incident.incident_id || alert?.alert_id;
      if (
        String(user.role || '').toLowerCase() !== 'admin'
        || !incidentId
        || shownSosToasts.current.has(String(incidentId))
        || !userPreferences.inAppNotifications
        || !userPreferences.sosNotifications
      ) return;
      shownSosToasts.current.add(String(incidentId));
      setSosToast({
        id: incidentId,
        type: titleCase(alert?.incident_type || incident.type || ''),
        location: alert?.location_name || alert?.building || incident.location_name || incident.building || '',
      });
    };
    const handleAlert = (alert) => addNotification(alert, alert?.type === 'sos_alert' ? 'sos' : 'alert');
    const handlePrivateNotification = (notification) => {
      if (!notification?.notification_id || String(notification.user_id) !== String(user.user_id)) return;
      const normalized = normalizeNotification(notification);
      setNotifications((current) => [
        normalized,
        ...current.filter((item) => String(item.id) !== String(normalized.id)),
      ].slice(0, 100));
      setNotificationsLoaded(true);
      setNotificationCountError('');
    };
    webSocket.on('new-incident', handleIncident);
    webSocket.on('sos_alert', handleSos);
    webSocket.on('alert-received', handleAlert);
    webSocket.on('notification-created', handlePrivateNotification);
    webSocket.on('officer-location-updated', refreshOperationalData);
    webSocket.on('campus-location-updated', refreshOperationalData);
    webSocket.on('incident_assigned', refreshOperationalData);
    webSocket.on('incident-updated', refreshOperationalData);
    webSocket.on('officer_assignment', refreshOperationalData);
    return () => {
      webSocket.off('new-incident', handleIncident);
      webSocket.off('sos_alert', handleSos);
      webSocket.off('alert-received', handleAlert);
      webSocket.off('notification-created', handlePrivateNotification);
      webSocket.off('officer-location-updated', refreshOperationalData);
      webSocket.off('campus-location-updated', refreshOperationalData);
      webSocket.off('incident_assigned', refreshOperationalData);
      webSocket.off('incident-updated', refreshOperationalData);
      webSocket.off('officer_assignment', refreshOperationalData);
      webSocket.disconnect();
    };
  }, [loadData, loadNotifications, user.role, user.user_id, userPreferences]);

  const stats = useMemo(() => {
    const calculated = statsFor(incidents);
    if (statsLoading) return { ...calculated, total: '...', active: '...' };
    return serverStats ? { ...calculated, total: serverStats.total, active: serverStats.active, resolved: serverStats.resolved } : calculated;
  }, [incidents, serverStats, statsLoading]);
  const visibleNotifications = notifications.filter((notification) => (
    userPreferences.inAppNotifications
    && (notification.type !== 'sos' || userPreferences.sosNotifications)
    && (notification.type !== 'alert' || userPreferences.alertNotifications)
    && (notification.type !== 'incident' || userPreferences.incidentNotifications)
    && (notification.type !== 'response' || userPreferences.responseNotifications)
  ));
  const active = useMemo(() => incidents.filter((incident) => activeStatuses.includes(incident.status)), [incidents]);
  const critical = useMemo(() => incidents.filter((incident) => incident.is_sos || incident.severity === 'critical'), [incidents]);
  const detail = incidents.find((incident) => String(incident.incident_id) === location.pathname.split('/').pop());
  const detailAssignmentDeclined = ['declined'].includes(
    String(detail?.responses?.[0]?.assignment_status || detail?.responses?.[0]?.status || '').toLowerCase(),
  );
  const detailOfficer = detailAssignmentDeclined ? null : detail?.responses?.[0]?.responder || null;
  const view = (incident) => navigate(`/incidents/${incident.incident_id}`);
  const navigateToIncidentMap = (incidentId) => navigate('/map', {
    state: { selectedIncidentId: incidentId, focusRequestKey: Date.now() },
  });
  const openIncidentOnMap = (incident) => {
    if (!incident?.incident_id || !validIncidentCoordinates(incident)) {
      setMapNavigationError('This incident has no valid GPS coordinates and cannot be opened on the map.');
      return false;
    }
    setMapNavigationError('');
    navigateToIncidentMap(incident.incident_id);
    return true;
  };
  const openNotification = async (notification) => {
    await markNotificationRead(notification);
    const target = notification.link || notification.target_url;
    if (target) {
      navigate(target);
      return;
    }
    const incidentId = notification.incident_id || notification.incident?.incident_id;
    if (incidentId) {
      const incident = incidents.find((item) => String(item.incident_id) === String(incidentId));
      const incidentWithLocation = {
        ...incident,
        ...notification,
        incident_id: incidentId,
        latitude: notification.latitude ?? incident?.latitude,
        longitude: notification.longitude ?? incident?.longitude,
      };
      if (canViewMap && validIncidentCoordinates(incidentWithLocation)) {
        navigateToIncidentMap(incidentId);
      } else {
        navigate(`/incidents/${incidentId}`);
      }
      return;
    }
    navigate('/alerts', { state: { selectedAlertId: notification.alert_id } });
  };
  const normalizeAssignmentState = (assignment, apiAssignment) => {
    const incident = assignment?.incident || {};
    const nextIncident = {
      ...incident,
      incident_id: apiAssignment.incident_id ?? incident.incident_id,
      status: apiAssignment.incident_status ?? incident.status,
      location_name: apiAssignment.location_name ?? incident.location_name,
      latitude: apiAssignment.latitude ?? incident.latitude,
      longitude: apiAssignment.longitude ?? incident.longitude,
    };
    return {
      ...assignment,
      response_id: apiAssignment.response_id ?? assignment.response_id,
      assignment_status: apiAssignment.assignment_status ?? assignment.assignment_status,
      status: apiAssignment.status ?? assignment.status,
      incident: nextIncident,
      responder: apiAssignment.responder || assignment?.responder || null,
    };
  };
  const changeStatus = async (incident, status) => { try { await api.patch(`/incidents/${incident.incident_id}/status`, { status }); await loadData(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update incident status.'); } };
  const assignOfficer = async (incident, officerId) => {
    if (!canAssignIncidents || !officerId || assignmentInFlight.current) return;
    assignmentInFlight.current = true;
    setAssignmentLoading(incident.incident_id);
    setError('');
    try {
      await api.post(`/incidents/${incident.incident_id}/assign`, { officer_id: officerId });
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to assign security officer.');
    } finally {
      assignmentInFlight.current = false;
      setAssignmentLoading('');
    }
  };
  const respondToAssignment = async (assignment, response) => {
    if (!assignment.response_id || assignmentResponseInFlight.current) return;
    assignmentResponseInFlight.current = true;
    setAssignmentResponseLoading(assignment.response_id);
    setAssignmentError('');
    try {
      const result = await api.post(`/incidents/responses/${assignment.response_id}/${response}`);
      const responseData = result.data?.data || {};
      const updatedAssignment = normalizeAssignmentState(assignment, {
        ...responseData,
        assignment_status: response === 'decline' ? 'declined' : responseData.assignment_status,
      });
      const declinedAssignment = response === 'decline'
        ? { ...updatedAssignment, assignment_status: 'declined', responder: null, responder_id: null }
        : updatedAssignment;
      if (response === 'accept') {
        setAssignmentRequests((current) => [
          updatedAssignment,
          ...current.filter((item) => item.response_id !== updatedAssignment.response_id),
        ]);
      }
      if (response === 'decline') {
        setAssignmentRequests((current) => [
          declinedAssignment,
          ...current.filter((item) => item.response_id !== declinedAssignment.response_id),
        ]);
        setIncidents((current) => current.map((incident) => (
          String(incident.incident_id) === String(declinedAssignment.incident?.incident_id)
            ? {
              ...incident,
              responses: [
                declinedAssignment,
                ...(incident.responses || []).filter((item) => item.response_id !== declinedAssignment.response_id),
              ],
            }
            : incident
        )));
      }
      await loadData();
      if (response === 'accept' || response === 'decline') {
        const assignmentToKeep = response === 'decline' ? declinedAssignment : updatedAssignment;
        setAssignmentRequests((current) => [
          assignmentToKeep,
          ...current.filter((item) => item.response_id !== assignment.response_id),
        ]);
      }
      if (response === 'decline') {
        setIncidents((current) => current.map((incident) => (
          String(incident.incident_id) === String(declinedAssignment.incident?.incident_id)
            ? {
              ...incident,
              responses: [
                declinedAssignment,
                ...(incident.responses || []).filter((item) => item.response_id !== declinedAssignment.response_id),
              ],
            }
            : incident
        )));
      }
    } catch (requestError) {
      setAssignmentError(requestError.response?.data?.message || 'Unable to update assignment response.');
    } finally {
      assignmentResponseInFlight.current = false;
      setAssignmentResponseLoading('');
    }
  };
  const completeResponse = async (assignment) => {
    const incidentId = assignment.incident?.incident_id;
    if (!incidentId || assignmentResponseInFlight.current) return;
    assignmentResponseInFlight.current = true;
    setAssignmentResponseLoading(assignment.response_id);
    setAssignmentError('');
    try {
      await api.patch(`/incidents/${incidentId}/response`, { status: 'resolved' });
      await loadData();
    } catch (requestError) {
      setAssignmentError(requestError.response?.data?.message || 'Unable to complete response.');
    } finally {
      assignmentResponseInFlight.current = false;
      setAssignmentResponseLoading('');
    }
  };
  const arriveAtIncident = async (assignment) => {
    const incidentId = assignment.incident?.incident_id;
    if (!incidentId || assignment.assignment_status !== 'accepted' || assignmentResponseInFlight.current) return;
    assignmentResponseInFlight.current = true;
    setAssignmentResponseLoading(assignment.response_id);
    setAssignmentError('');
    try {
      const result = await api.patch(`/incidents/${incidentId}/response`, { status: 'responding' });
      const arrivedAssignment = normalizeAssignmentState(assignment, result.data.data);
      await loadData();
      setAssignmentRequests((current) => [
        arrivedAssignment,
        ...current.filter((item) => item.response_id !== assignment.response_id),
      ]);
      setIncidents((current) => current.map((incident) => (
        String(incident.incident_id) === String(arrivedAssignment.incident?.incident_id)
          ? {
              ...incident,
              status: arrivedAssignment.incident?.status || 'on_scene',
              responses: [
                arrivedAssignment,
                ...(incident.responses || []).filter(
                  (item) => item.response_id !== arrivedAssignment.response_id,
                ),
              ],
            }
          : incident
      )));
    } catch (requestError) {
      setAssignmentError(requestError.response?.data?.message || 'Unable to record arrival.');
    } finally {
      assignmentResponseInFlight.current = false;
      setAssignmentResponseLoading('');
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
  const updateUserPhoto = (updatedUser) => {
    setUsers((currentUsers) => currentUsers.map((account) => account.user_id === updatedUser.user_id ? updatedUser : account));
    setSelectedUser(updatedUser);
    if (updatedUser.user_id === user.user_id) onUserUpdated(updatedUser);
  };
  const updateSelectedUser = async (event) => {
    event.preventDefault();
    if (!selectedUser || userUpdateLoading) return;
    setUserUpdateLoading(true);
    setError('');
    try {
      const response = await api.patch(`/users/${selectedUser.user_id}`, { role: selectedUser.role, name: selectedUser.name, phone: selectedUser.phone || '' });
      const updatedUser = response.data?.data || selectedUser;
      setUsers((currentUsers) => currentUsers.map((account) => account.user_id === updatedUser.user_id ? updatedUser : account));
      setSelectedUser(updatedUser);
      if (updatedUser.user_id === user.user_id) onUserUpdated(updatedUser);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update user.');
    } finally {
      setUserUpdateLoading(false);
    }
  };
  const clearHistory = async () => {
    if (clearHistoryLoading) return;
    const isAdmin = String(user.role || '').trim().toLowerCase() === 'admin';
    const confirmationMessage = isAdmin
      ? 'Clear all incident history permanently? This action cannot be undone.'
      : 'Clear your incident history from this view? Incident records will remain available for operations. This action cannot be undone.';
    if (userPreferences.confirmBeforeClear !== false && !window.confirm(confirmationMessage)) return;

    setClearHistoryLoading(true);
    setError('');
    setHistorySuccess('');
    try {
      await api.delete('/incidents/history');
      await loadData();
      setHistorySuccess(isAdmin
        ? 'Incident history was cleared successfully.'
        : 'Your incident history was cleared successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to clear your history.');
    } finally {
      setClearHistoryLoading(false);
    }
  };
  const clearNotificationHistory = async () => {
    if (clearHistoryLoading) return;
    if (!window.confirm('Clear your history? Your notification history will be removed. This action cannot be undone.')) return;

    setClearHistoryLoading(true);
    setNotificationHistoryError('');
    setHistorySuccess('');
    notificationClearInProgress.current = true;
    notificationRequestVersion.current += 1;
    try {
      await api.delete('/notifications/history');
      notificationRequestVersion.current += 1;
      setNotifications([]);
      window.dispatchEvent(new Event('campussecure:notifications-cleared'));
      setHistorySuccess('Your notification history was cleared successfully.');
    } catch {
      setNotificationHistoryError('Unable to clear notification history');
    } finally {
      notificationClearInProgress.current = false;
      setClearHistoryLoading(false);
    }
  };
  const refreshButton = <button type="button" className="dashboard-button" onClick={loadData}><Refresh className="text-[18px]" /> Refresh</button>;
  const isSOSSection = section === 'sos' || section === 'emergency';
  const createButton = canReportIncident
    ? <button type="button" className="dashboard-button primary" onClick={() => setCreateOpen(true)}>{isSOSSection ? 'Send SOS alert' : 'Report incident'}</button>
    : null;
  const overviewMetrics = [
    { name: 'Total incidents', value: stats.total, displayValue: stats.total, color: overviewMetricColors.total },
    { name: 'Active incidents', value: stats.active, displayValue: stats.active, color: overviewMetricColors.active },
    { name: 'Critical / SOS', value: critical.length, displayValue: critical.length, color: overviewMetricColors.critical },
    {
      name: 'Security officers',
      value: resourceState.officers.status === 'error' ? 0 : officers.length,
      displayValue: resourceState.officers.status === 'error' ? '!' : officers.length,
      color: overviewMetricColors.officers,
    },
  ];
  const markAlertRead = async (alertId) => { try { await readAlert(alertId); await loadData(); } catch (requestError) { setOperationsError(requestError.response?.data?.message || 'Unable to mark alert as read.'); } };
  const markNotificationsRead = async () => {
    if (!notifications.some((notification) => !notification.read)) return;
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      window.dispatchEvent(new Event('campussecure:notifications-read-all'));
      setNotificationCountError('');
    } catch (requestError) {
      setNotificationCountError(requestError.response?.data?.message || 'Unable to update your notifications.');
    }
  };
  const markNotificationRead = async (notification) => {
    if (notification.read) return;
    try {
      if (notification.notification_id) await api.patch(`/notifications/${notification.notification_id}/read`);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
      setNotificationCountError('');
    } catch (requestError) {
      setNotificationCountError(requestError.response?.data?.message || 'Unable to update your notification.');
    }
  };

  const table = (items, title, description, resource = 'incidents') => <><Heading eyebrow="Incident operations" title={title} description={description} action={<div className="flex gap-2">{createButton}{refreshButton}</div>} />{resourceState[resource].status === 'error' ? <RequestError message={resourceState[resource].error} onRetry={loadData} /> : <IncidentTable incidents={items} officers={canAssignIncidents ? officers : []} loading={loading || resourceState[resource].status === 'loading'} onView={view} onStatusChange={changeStatus} onAssign={assignOfficer} assignmentLoading={assignmentLoading} canAssign={canAssignIncidents} privileged={canChangeIncidentStatus} />}</>;
  const assignmentRequestsView = showAssignmentRequests && (assignmentRequests.length > 0 || assignmentError) && (
    <section className="dashboard-panel space-y-4 border-slate-200/80 bg-white">
    <h2 className="text-lg font-black text-[#0b1f3a]">New assignment request</h2>
    {assignmentError && <div className="dashboard-error" role="alert">{assignmentError}</div>}
    {assignmentRequests.map((assignment) => {
      const status = String(assignment.assignment_status || 'pending').toLowerCase();
      const incident = assignment.incident || {};
      const isLoading = assignmentResponseLoading === assignment.response_id;
      return <article key={assignment.response_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-[#0b1f3a]">{titleCase(incident.type || 'Incident')}</h3>
            <p className="mt-1 text-sm text-slate-600"><span>{incident.incident_id}</span> · {incident.location_name || 'Location unavailable'}</p>
            {incident.description && <p className="mt-1 text-sm text-slate-600">{incident.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IncidentStatusBadge status={status} className="assignment-request-status" />
            {status === 'accepted' && <IncidentStatusBadge status="responding">Responding</IncidentStatusBadge>}
          </div>
        </div>
        {status === 'pending' && <div className="mt-3 flex gap-2">
          <button type="button" className="dashboard-button primary" onClick={() => respondToAssignment(assignment, 'accept')} disabled={isLoading}>{isLoading ? 'Updating...' : 'Accept Assignment'}</button>
          <button type="button" className="dashboard-button" onClick={() => respondToAssignment(assignment, 'decline')} disabled={isLoading}>Decline</button>
        </div>}
        {status === 'accepted' && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="dashboard-button" onClick={() => view(incident)} disabled={isLoading}>View incident</button>
            {incident.status !== 'on_scene' && <button type="button" className="dashboard-button primary" onClick={() => arriveAtIncident(assignment)} disabled={isLoading}>{isLoading ? 'Updating...' : 'Arrived'}</button>}
            {incident.status === 'on_scene' && <><span className="status-badge">Handling</span><button type="button" className="dashboard-button primary" onClick={() => completeResponse(assignment)} disabled={isLoading}>{isLoading ? 'Updating...' : 'Resolve Incident'}</button></>}
          </div>
        )}
      </article>;
    })}
    </section>
  );
  const overview = (
    <div className="space-y-8">
      {assignmentRequestsView}
      <section className="dashboard-panel overflow-hidden border-slate-200/80 bg-white p-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(220px,30%)]">
          <div className="p-5 sm:p-6">
            <Heading
              eyebrow="Security operations center"
              title="Campus overview"
              description="Live incident, response, and system activity from the campus security service."
              action={<div className="flex flex-wrap gap-2">{createButton}{refreshButton}</div>}
            />
          </div>
          <CampusOverviewImage />
        </div>
      </section>
      <OverviewMetricsChart metrics={overviewMetrics} total={stats.total} />
      <div className="grid gap-6 xl:grid-cols-5">
        <section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:col-span-3">
          <Heading
            eyebrow="Priority queue"
            title="Recent incidents"
            action={
              <button type="button" className="dashboard-button" onClick={() => navigate('/incidents/active')}>
                View queue
              </button>
            }
          />
          {resourceState.incidents.status === 'loading'
            ? <div className="inline-loading">Loading incidents...</div>
            : resourceState.incidents.status === 'error'
              ? <RequestError message={resourceState.incidents.error} onRetry={loadData} />
              : active.length
                ? <IncidentTable incidents={active.slice(0, 6)} officers={canAssignIncidents ? officers : []} onView={view} onStatusChange={changeStatus} onAssign={assignOfficer} assignmentLoading={assignmentLoading} canAssign={canAssignIncidents} privileged={canChangeIncidentStatus} />
                : <EmptyState title="No active incidents" message="The response queue is clear." />}
        </section>
        <section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:col-span-2">
          <Heading eyebrow="Communications" title="Latest alerts" />
          {resourceState.alerts.status === 'loading'
            ? <div className="inline-loading">Loading alerts...</div>
            : resourceState.alerts.status === 'error'
              ? <RequestError message={resourceState.alerts.error} onRetry={loadData} />
              : alerts.length
                ? (
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.alert_id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/30"
                      >
                        <div className="flex gap-3">
                          <WarningAmberOutlined className="text-amber-600" />
                          <div>
                            <p className="text-sm font-bold text-[#0b1f3a]">{alert.title || titleCase(alert.type)}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{alert.message || 'No additional details.'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
                : <EmptyState title="No alerts" message="There are no alerts to display." />}
        </section>
      </div>
    </div>
  );
  const deleteZoneFromMap = async (zone) => {
    if (String(user.role || '').trim().toLowerCase() !== 'admin') throw new Error('Only administrators can delete zones.');
    try {
      await api.delete(`/zones/${zone.zone_id}`);
      setZones((currentZones) => currentZones.filter((currentZone) => currentZone.zone_id !== zone.zone_id));
    } catch (requestError) {
      throw new Error(requestError.response?.data?.message || 'Unable to delete zone.');
    }
  };
  const map = <div className="space-y-8"><Heading eyebrow="Geospatial response" title="Live campus map" description="Campus places, security zones, current officer locations, and incident coordinates." />{resourceState.incidents.status === 'loading' ? <div className="inline-loading">Loading map data...</div> : resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"><SecurityMap campusLocations={campusLocations} incidents={incidents} officers={canViewOperations ? officers : []} zones={zones} focusedIncidentId={location.state?.selectedIncidentId} focusRequestKey={location.state?.focusRequestKey} defaultMapStyle={userPreferences.mapDefault} defaultOfficerAvailability={userPreferences.officerAvailability} canManageZones={String(user.role || '').trim().toLowerCase() === 'admin'} onDeleteZone={deleteZoneFromMap} /></div>}</div>;
  const detailView = detail ? (
    <div className="space-y-8">
      <Heading
        eyebrow="Incident record"
        title={titleCase(detail.type)}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canViewMap && (
              <button type="button" className="dashboard-button primary" onClick={() => openIncidentOnMap(detail)}>
                Open with Map
              </button>
            )}
            <DashboardBackButton />
          </div>
        }
      />
      {mapNavigationError && <p className="dashboard-error" role="alert">{mapNavigationError}</p>}
      <div className="detail-grid">
        <section className="detail-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap gap-2">
            <span className={`severity-badge ${detail.severity}`}>{detail.severity}</span>
            <IncidentStatusBadge status={detail.status || 'reported'}>{statusLabel(detail.status || 'reported')}</IncidentStatusBadge>
            {detailAssignmentDeclined && <IncidentStatusBadge status="declined">Declined</IncidentStatusBadge>}
            {detail.is_sos && <span className="status-badge border-red-200 bg-red-100 text-red-700">SOS</span>}
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <Detail label="Description" value={detail.description || 'No description provided'} wide />
            <Detail label="Location" value={detail.location_name || detail.building || 'Unavailable'} />
            <Detail label="Reporter" value={detail.is_anonymous ? <span>Anonymous</span> : detail.reporter ? <div className="flex items-center gap-2"><UserAvatar user={detail.reporter} size="h-8 w-8" /><span>{detail.reporter.name || 'Campus member'}</span></div> : <span>Campus member</span>} />
            <Detail label="Assigned officer" value={detailOfficer ? <div className="flex items-center gap-2"><UserAvatar user={detailOfficer} size="h-8 w-8" /><span>{detailOfficer.name || 'Security officer'}</span></div> : 'Unassigned'} />
            <Detail label="Reported" value={new Date(detail.created_at).toLocaleString()} />
          </dl>
        </section>
        <section className="detail-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <Heading eyebrow="Evidence" title="Attached photos" />
          {detail.photos?.length ? <EvidencePreview photos={detail.photos} /> : <EmptyState title="No evidence attached" message="This incident has no uploaded photos." />}
        </section>
      </div>
    </div>
  ) : resourceState.incidents.status === 'error'
    ? <RequestError message={resourceState.incidents.error} onRetry={loadData} />
    : <EmptyState icon={ReportProblemOutlined} title="Incident not found" message="The requested incident is unavailable." />;
  const evidence = <div className="space-y-6"><Heading eyebrow="Evidence review" title="Incident evidence" description="Uploaded photos associated with incident records." />{resourceState.incidents.status === 'error' ? <RequestError message={resourceState.incidents.error} onRetry={loadData} /> : incidents.filter((incident) => incident.photos?.length).length ? <div className="evidence-grid">{incidents.filter((incident) => incident.photos?.length).map((incident) => <article className="evidence-card" key={incident.incident_id}><div className="mb-4 flex items-start justify-between"><div><h3 className="font-black text-slate-900">{titleCase(incident.type)}</h3><p className="mt-1 text-xs text-slate-500">{incident.location_name || 'Campus'}</p></div><button type="button" className="table-action" onClick={() => view(incident)}>View</button></div><EvidencePreview photos={incident.photos} /></article>)}</div> : <EmptyState title="No evidence available" message="Photo evidence will appear here when incidents include uploads." />}</div>;
  const usersView = (
    <div className="space-y-8">
      <Heading eyebrow="Access and people" title="User management" description="Campus accounts returned by the security service." />
      {users.length ? (
        <>
          <div className="dashboard-panel dashboard-table-scroll border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <table className="dashboard-table user-table">
              <thead><tr><th>Profile</th><th>Email</th><th>Role</th><th className="status-cell">Status</th><th>Action</th></tr></thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.user_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <UserAvatar user={account} size="h-10 w-10" />
                        <button type="button" className="text-left font-bold text-[#0b1f3a]" onClick={() => setSelectedUser(account)}>{account.name}</button>
                      </div>
                    </td>
                    <td>{account.email}</td>
                    <td>{titleCase(account.role)}</td>
                    <td className="status-cell"><span className={`status-badge ${account.is_active ? 'resolved' : ''}`}>{account.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="action-cell"><button type="button" className="table-action" onClick={() => changeUserStatus(account)} disabled={userStatusLoading === account.user_id}>{userStatusLoading === account.user_id ? 'Updating...' : account.is_active ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedUser && <section className="dashboard-panel border-slate-200/80 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><div className="flex flex-wrap items-start gap-5"><UserAvatar user={selectedUser} size="h-28 w-28" /><div><p className="dashboard-eyebrow">User profile</p><h3 className="mt-1 text-xl font-black text-[#0b1f3a]">{selectedUser.name}</h3><p className="mt-1 text-sm text-slate-500">{selectedUser.email}</p><p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{titleCase(selectedUser.role)} Â· {selectedUser.is_active ? 'Active' : 'Inactive'}</p></div><button type="button" className="table-action ml-auto" onClick={() => setSelectedUser(null)}>Close</button></div><form className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2" onSubmit={updateSelectedUser}><label className="form-field"><span>Name</span><input value={selectedUser.name || ''} onChange={(event) => setSelectedUser({ ...selectedUser, name: event.target.value })} required /></label><label className="form-field"><span>Phone</span><input value={selectedUser.phone || ''} onChange={(event) => setSelectedUser({ ...selectedUser, phone: event.target.value })} /></label><label className="form-field"><span>Role</span><select value={selectedUser.role} onChange={(event) => setSelectedUser({ ...selectedUser, role: event.target.value })}><option value="student">Student</option><option value="faculty">Faculty</option><option value="staff">Staff</option><option value="security">Security</option><option value="admin">Administrator</option></select></label><button type="submit" className="dashboard-button primary self-end" disabled={userUpdateLoading}>{userUpdateLoading ? 'Saving...' : 'Save user changes'}</button></form><ProfilePhotoEditor user={selectedUser} onUpdated={updateUserPhoto} /></section>}
        </>
      ) : <EmptyState icon={PeopleAltOutlined} title="No users returned" message="User management data is unavailable or empty." />}
    </div>
  );
  const officersView = <div className="space-y-8"><Heading eyebrow="Response team" title="Security officers" description="Officer availability from the security service." />{officers.length ? <div className="officer-grid">{officers.map((officer) => <article className="officer-card border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]" key={officer.user_id}><div className="officer-card-heading"><div className="flex items-center gap-3"><UserAvatar user={officer} size="h-10 w-10" /><strong className="text-[#0b1f3a]">{officer.name}</strong></div><span className={`officer-status ${officer.availability_status || 'offline'}`}>{titleCase(officer.availability_status || 'offline')}</span></div><p className="text-sm text-slate-600">{officer.email}</p><p className="mt-3 text-xs text-slate-500">{officerLocationLabel(officer)}</p></article>)}</div> : <EmptyState icon={PeopleAltOutlined} title="No security officers" message="No officer records are currently available." />}</div>;
  const alertsZonesError = resourceState.alerts.status === 'error' ? resourceState.alerts.error : resourceState.zones.status === 'error' ? resourceState.zones.error : '';
  let content = overview;
  if (section === 'profile') content = <ProfilePage user={user} onUpdated={onUserUpdated} />;
  if (section === 'incidents') content = table(active, 'Active incidents', 'Reports currently in the response queue.');
  if (section === 'history') content = table(
    historyIncidents,
    'Incident history',
    String(user.role || '').trim().toLowerCase() === 'admin'
      ? 'All incident records returned by the backend.'
      : 'Incident records associated with your account.',
    'history',
  );
  if (section === 'sos' || section === 'emergency') content = table(critical, section === 'sos' ? 'SOS and critical incidents' : 'Emergency center', 'Critical reports requiring rapid review.');
  if (section === 'map') content = map;
  if (section === 'detail') content = detailView;
  if (section === 'evidence') content = evidence;
  if (protectedSection) content = <AccessDenied />;
  else if (section === 'zones') content = <ZoneManagement zones={zones} loading={resourceState.zones.status === 'loading'} error={resourceState.zones.status === 'error' ? resourceState.zones.error : ''} canManage={String(user.role || '').trim().toLowerCase() === 'admin'} onRefresh={loadData} />;
  else if (section === 'users') content = resourceState.users.status === 'loading'
    ? <div className="inline-loading">Loading users...</div>
    : resourceState.users.status === 'error'
      ? <RequestError message={resourceState.users.error} onRetry={loadData} />
      : canViewUsers
        ? <UserManagementPage users={users} setUsers={setUsers} onRefresh={loadData} currentUser={user} onUserUpdated={onUserUpdated} />
        : usersView;
  else if (section === 'officers') content = resourceState.officers.status === 'loading' ? <div className="inline-loading">Loading officers...</div> : resourceState.officers.status === 'error' ? <RequestError message={resourceState.officers.error} onRetry={loadData} /> : officersView;
  else if (section === 'analytics') content = isStudent
    ? <StudentAnalyticsPage incidents={incidents} userId={user.user_id} loading={resourceState.incidents.status === 'loading'} error={resourceState.incidents.status === 'error' ? resourceState.incidents.error : ''} onRefresh={loadData} />
    : <AnalyticsPage analytics={analytics} incidents={incidents} responses={responses} loading={operationsLoading} error={resourceState.analytics.status === 'error' ? resourceState.analytics.error : ''} onRefresh={loadData} />;
  else if (section === 'ml') content = <MLDashboard incidents={incidents} campusLocations={campusLocations} />;
  else if (section === 'responses') content = <ResponsesPage responses={responses} loading={operationsLoading} error={resourceState.responses.status === 'error' ? resourceState.responses.error : ''} onRefresh={loadData} />;
  else if (section === 'announcements') content = <AnnouncementsPage user={user} />;
  else if (section === 'locations') content = <CampusLocationsPage user={user} />;
  else if (section === 'sms') content = <SmsBroadcastPage />;
  else if (section === 'notifications') content = <NotificationsPage
    user={user}
    onNotificationsChange={(items) => {
      const serverNotifications = items.map(normalizeNotification);
      setNotifications((current) => mergeNotifications(serverNotifications, current));
      setNotificationsLoaded(true);
    }}
    onHistoryCleared={() => setNotifications([])}
  />;
  else if (section === 'auditLogs') content = <AuditLogsPage />;
  else if (section === 'content') content = <ContentManagementPage user={user} />;
  else if (section === 'profile') content = <ProfilePage user={user} onUpdated={onUserUpdated} />;
  else if (section === 'settings') content = <SettingsPage user={user} onUpdated={onUserUpdated} onLogout={onLogout} />;
  else if (section === 'alerts' || section === 'zones') content = <AlertsZonesPage alerts={alerts} zones={zones} loading={operationsLoading} error={alertsZonesError} onRefresh={loadData} onReadAlert={markAlertRead} canManage={['admin', 'security'].includes(user.role)} showClear={section === 'alerts'} selectedAlertId={section === 'alerts' ? location.state?.selectedAlertId : undefined} />;
  return <DashboardLayout user={user} activeSection={section} featureImageSection={protectedSection ? null : section} incidents={incidents} notifications={visibleNotifications} notificationsReady={notificationsLoaded} notificationsError={notificationCountError} onNotificationsRead={markNotificationsRead} onNotificationOpen={openNotification} onNavigate={navigate} onLogout={onLogout} onClearHistory={section === 'history' || String(user.role || '').trim().toLowerCase() === 'admin' ? clearHistory : clearNotificationHistory} onClearNotificationHistory={clearNotificationHistory} clearHistoryLoading={clearHistoryLoading}>
    {historySuccess && <div className="fixed left-1/2 top-[4.5rem] z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 shadow-xl" role="status" aria-live="polite"><CheckCircleOutline className="shrink-0" /><span>{historySuccess}</span></div>}
    {notificationCountError && <div className="dashboard-error" role="alert">{notificationCountError}</div>}
    {notificationHistoryError && <div className="dashboard-error" role="alert">{notificationHistoryError}</div>}
    {sosToast && <div className="fixed left-1/2 top-[4.5rem] z-[60] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-red-300 bg-red-50 p-4 shadow-2xl ring-2 ring-red-100" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <WarningAmberOutlined className="mt-0.5 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-black text-red-900">🚨 SOS Emergency Alert</span>
          {(sosToast.type || sosToast.location) && <span className="mt-1 block text-xs font-semibold text-red-800">{[sosToast.type, sosToast.location].filter(Boolean).join(' · ')}</span>}
        </div>
        <button type="button" className="shrink-0 rounded-lg p-1 text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600" aria-label="Dismiss SOS emergency alert" onClick={() => setSosToast(null)}><Close className="text-[18px]" /></button>
      </div>
    </div>}
    {incidentToast && <div className={`fixed left-1/2 ${sosToast ? 'top-[10rem]' : 'top-[4.5rem]'} z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-sky-200 bg-white p-4 shadow-xl ring-1 ring-sky-100`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <ReportProblemOutlined className="mt-0.5 shrink-0 text-sky-700" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { navigate('/incidents/active'); setIncidentToast(null); }}>
          <span className="block text-sm font-black text-[#0b1f3a]">New incident reported</span>
          <span className="mt-1 block text-xs text-slate-600">{incidentToast.type}{incidentToast.location ? ` · ${incidentToast.location}` : ''}</span>
        </button>
        <button type="button" className="shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="Dismiss incident notification" onClick={() => setIncidentToast(null)}><Close className="text-[18px]" /></button>
      </div>
    </div>}
    <div className="mx-auto w-full max-w-[1500px] space-y-6">{error && <div className="dashboard-error" role="alert"><ErrorOutline /><div><strong>Dashboard data issue</strong><p>{error}</p></div><button type="button" className="table-action" onClick={loadData}>Retry</button></div>}{notificationCountError && <div className="dashboard-error" role="alert"><span>{notificationCountError}</span><button type="button" className="table-action" onClick={refreshNotificationUnreadCount}>Retry notifications</button></div>}{content}</div>{createOpen && canReportIncident && <IncidentCreateModal userRole={user.role} isSOS={isSOSSection} shareLocation={userPreferences.shareLocation} confirmSOS={userPreferences.confirmSOS} onClose={() => setCreateOpen(false)} onSuccess={async () => { setCreateOpen(false); await loadData(); }} />}
  </DashboardLayout>;
}

const Detail = ({ label, value, wide }) => <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700">{label}</dt><dd className="mt-2 text-sm font-normal leading-6 text-slate-700">{value}</dd></div>;

export default Dashboard;

