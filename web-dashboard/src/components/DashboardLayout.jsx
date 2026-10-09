import {
  DashboardOutlined,
  DescriptionOutlined,
  EventNoteOutlined,
  InsightsOutlined,
  Logout,
  Close,
  CampaignOutlined,
  Menu,
  MapOutlined,
  PeopleAltOutlined,
  ReportProblemOutlined,
  NotificationsOutlined,
  SettingsOutlined,
  AccountCircleOutlined,
  SmsOutlined,
  ShieldOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SafetyChatbot from './Chatbot/SafetyChatbot';
import DashboardBackButton from './DashboardBackButton';
import ProfilePhotoPreview from './ProfilePhotoPreview';
import { PublicFooter } from './PublicSite';
import { translateDashboardText, useLanguage } from '../utils/language';
import { getUserPreferences, useAppearanceTheme } from '../utils/appearance';
import '../dashboard.css';
import '../styles/dashboard-refinements.css';

const editableIncidentStatuses = ['reported', 'investigating', 'dispatched', 'on_scene', 'resolved', 'closed'];

const severityClasses = {
  low: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  medium: 'border-amber-200 bg-amber-100 text-amber-800',
  high: 'border-orange-200 bg-orange-100 text-orange-700',
  critical: 'border-red-200 bg-red-100 text-red-700',
};

const featureIllustrations = {
  overview: { file: 'overview.svg', alt: 'Overview' },
  incidents: { file: 'active-incidents.svg', alt: 'Active incidents' },
  history: { file: 'incident-history.svg', alt: 'Incident history' },
  emergency: { file: 'sos-emergency.svg', alt: 'SOS emergency' },
  sos: { file: 'sos-emergency.svg', alt: 'SOS emergency' },
  map: { file: 'live-map.svg', alt: 'Live map' },
  officers: { file: 'security-officers.svg', alt: 'Security officers', path: '/officers' },
  users: { file: 'user-management.svg', alt: 'User management', path: '/users' },
  analytics: { file: 'reports-analytics.svg', alt: 'Reports & Analytics', path: '/analytics' },
  notifications: { file: 'notifications.svg', alt: 'Notifications', adminOnly: true },
  auditLogs: { file: 'audit-logs.svg', alt: 'Audit logs', adminOnly: true },
  content: { file: 'content-management.svg', alt: 'Content management', adminOnly: true },
  locations: { file: 'campus-locations.svg', alt: 'Campus locations', path: '/locations' },
  zones: { file: 'zone-management.svg', alt: 'Zone management' },
  profile: { file: 'profile.svg', alt: 'Profile' },
  settings: { file: 'settings.svg', alt: 'Settings' },
};

const navigationItems = [
  { label: 'Overview', path: '/dashboard', icon: DashboardOutlined },
  { label: 'Profile', path: '/profile', icon: AccountCircleOutlined },
  { label: 'Settings', path: '/settings', icon: SettingsOutlined },
  { label: 'Features', path: '/features', icon: DescriptionOutlined },
  { label: 'Active incidents', path: '/incidents/active', icon: ReportProblemOutlined },
  { label: 'Incident History', path: '/incidents/history', icon: EventNoteOutlined },
  { label: 'Emergency center', path: '/emergency', icon: WarningAmberOutlined },
  { label: 'Live Map', path: '/map', icon: MapOutlined },
  { label: 'SOS / Emergency', path: '/sos', icon: WarningAmberOutlined },
  { label: 'Evidence', path: '/evidence', icon: DescriptionOutlined },
  { label: 'Security Officers', path: '/officers', icon: PeopleAltOutlined },
  { label: 'User management', path: '/users', icon: PeopleAltOutlined },
  { label: 'Notifications', path: '/notifications', icon: NotificationsOutlined },
  { label: 'SMS Broadcast', path: '/sms', icon: SmsOutlined },
  { label: 'Reports & Analytics', path: '/analytics', icon: InsightsOutlined },
  { label: 'ML Insights', path: '/ml', icon: InsightsOutlined },
  { label: 'Audit Logs', path: '/audit-logs', icon: EventNoteOutlined },
  { label: 'Content Management', path: '/content', icon: CampaignOutlined },
  { label: 'Responses', path: '/responses', icon: SmsOutlined },
  { label: 'Alerts', path: '/alerts', icon: WarningAmberOutlined },
  { label: 'Announcements', path: '/announcements', icon: CampaignOutlined },
  { label: 'Zones', path: '/zones', icon: MapOutlined },
  { label: 'Campus locations', path: '/locations', icon: MapOutlined },
];

const navigationGroups = [
  { id: 'overview', label: 'Overview / Dashboard', icon: DashboardOutlined, paths: ['/dashboard', '/features'] },
  { id: 'incidents', label: 'Incidents & Emergency', icon: ReportProblemOutlined, paths: ['/incidents/active', '/incidents/history', '/emergency', '/sos', '/evidence'] },
  { id: 'locations', label: 'Live Map & Location', icon: MapOutlined, paths: ['/map', '/alerts', '/zones', '/locations'] },
  { id: 'response', label: 'Security Officers / Response', icon: PeopleAltOutlined, paths: ['/officers', '/responses'] },
  { id: 'communication', label: 'Users & Communication', icon: SmsOutlined, paths: ['/profile', '/users', '/notifications', '/announcements', '/sms'] },
  { id: 'reports', label: 'Reports & Analytics', icon: InsightsOutlined, paths: ['/analytics', '/ml'] },
  { id: 'administration', label: 'Administration / System', icon: SettingsOutlined, paths: ['/settings', '/audit-logs', '/content'] },
];

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
function canAccessNavigation(path, role) {
  const normalizedRole = normalizeRole(role);
  if (path === '/map') return ['security', 'security_officer', 'admin'].includes(normalizedRole);
  if (path === '/users') return normalizedRole === 'admin';
  if (path === '/locations') return ['faculty', 'staff', 'security', 'security_officer', 'admin'].includes(normalizedRole);
  if (['/audit-logs', '/content', '/sms'].includes(path)) return normalizedRole === 'admin';
  if (path === '/officers') return ['security', 'security_officer', 'admin'].includes(normalizedRole);
  if (path === '/analytics') return ['student', 'security', 'security_officer', 'admin'].includes(normalizedRole);
  if (path === '/responses') return ['security', 'security_officer', 'admin'].includes(normalizedRole);
  return true;
}

function navigationItemLabel(label, role) {
  return label === 'Reports & Analytics' && normalizeRole(role) === 'student' ? 'Analytics' : label;
}

function navigationGroupLabel(group, role) {
  if (group.id === 'locations' && !canAccessNavigation('/map', role)) return 'Alerts & Zones';
  if (group.id === 'administration' && normalizeRole(role) !== 'admin') return 'Account & Settings';
  return group.label;
}

const toTitleCase = (value) =>
  String(value ?? 'incident')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
export const formatIncidentStatus = (value) => toTitleCase(value || 'Unknown');

export function IncidentStatusBadge({ status, children, className = '' }) {
  const normalizedStatus = String(status || 'unknown').trim().toLowerCase();
  return (
    <span className={`status-badge incident-status-badge ${normalizedStatus} whitespace-nowrap break-normal font-bold normal-case tracking-normal ${className}`} data-status={normalizedStatus}>
      {children || formatIncidentStatus(normalizedStatus)}
    </span>
  );
}

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Unknown');

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function DashboardLayout({
  user,
  activeSection = 'overview',
  incidents = [],
  notifications = [],
  notificationsReady = true,
  notificationsError = '',
  onNotificationsRead = () => { },
  onNotificationOpen,
  onNavigate = () => { },
  onLogout = () => { },
  onClearHistory = async () => { },
  onClearNotificationHistory = async () => { },
  clearHistoryLoading = false,
  featureImageSection = activeSection,
  children,
}) {
  const [language, setLanguage] = useLanguage();
  const theme = useAppearanceTheme(user?.user_id);
  const [userPreferences, setUserPreferences] = useState(() => getUserPreferences(user?.user_id));
  const t = (text) => translateDashboardText(text, language);
  const [selectedNavigationGroup, setSelectedNavigationGroup] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const knownNotificationIds = useRef(new Set(notifications.map((notification) => String(notification.id))));
  const notificationsInitialized = useRef(false);
  const notificationToastTimeout = useRef(null);
  const [realtimeNotification, setRealtimeNotification] = useState(null);

  useEffect(() => {
    setUserPreferences(getUserPreferences(user?.user_id));
    const refreshPreferences = (event) => {
      if (event.detail?.userId === user?.user_id) setUserPreferences(getUserPreferences(user?.user_id));
    };
    window.addEventListener('campussecure:preferences-changed', refreshPreferences);
    return () => window.removeEventListener('campussecure:preferences-changed', refreshPreferences);
  }, [user?.user_id]);
  const dashboardAppRef = useRef(null);
  const headerRef = useRef(null);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!notificationsReady) return undefined;
    const newestNotification = notifications.find((notification) => (
      !knownNotificationIds.current.has(String(notification.id))
    ));
    notifications.forEach((notification) => {
      knownNotificationIds.current.add(String(notification.id));
    });
    if (!notificationsInitialized.current) {
      notificationsInitialized.current = true;
      if (!newestNotification?.realtimeOnly) return undefined;
    }
    if (!newestNotification || newestNotification.type === 'sos' || notificationsOpen) return undefined;

    setRealtimeNotification(newestNotification);
    window.clearTimeout(notificationToastTimeout.current);
    notificationToastTimeout.current = window.setTimeout(() => setRealtimeNotification(null), 5000);
  }, [notifications, notificationsReady, notificationsOpen]);

  useEffect(() => () => window.clearTimeout(notificationToastTimeout.current), []);

  useLayoutEffect(() => {
    const dashboardApp = dashboardAppRef.current;
    const header = headerRef.current;
    if (!dashboardApp || !header) return undefined;

    const updateHeaderHeight = () => {
      const height = header.getBoundingClientRect().height;
      if (height > 0) dashboardApp.style.setProperty('--dashboard-header-height', `${height}px`);
    };

    updateHeaderHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(header);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  useEffect(() => {
    setSelectedNavigationGroup(null);
  }, [activeSection]);

  const navigateFromLayout = (path) => {
    setSelectedNavigationGroup(null);
    onNavigate(path);
  };

  const sectionNames = {
    overview: 'Overview', incidents: 'Active incidents', history: 'Incident history',
    emergency: 'Emergency center', map: 'Live map', sos: 'SOS / Emergency',
    evidence: 'Evidence', officers: 'Security officers', users: 'User management',
    analytics: 'Analytics', responses: 'Responses', alerts: 'Alerts and zones',
    announcements: 'Announcements', zones: 'Zones',
    locations: 'Campus locations', notifications: 'Notifications', auditLogs: 'Audit logs',
    content: 'Content management', settings: 'Settings', profile: 'Profile', detail: 'Incident',
    ml: 'ML Insights'
  };
  const sectionLabel = t(sectionNames[activeSection] || activeSection);
  const featureIllustration = featureIllustrations[featureImageSection];
  const canShowFeatureIllustration = featureIllustration
    && (!featureIllustration.path || canAccessNavigation(featureIllustration.path, user?.role))
    && (!featureIllustration.adminOnly || normalizeRole(user?.role) === 'admin');

  return (
    <div ref={dashboardAppRef} className="dashboard-app flex min-h-screen flex-col text-slate-900" lang={language} data-theme={theme} data-table-density={userPreferences.tableDensity} data-text-size={userPreferences.textSize} style={{ '--dashboard-header-height': '76px' }}>
      <main className="dashboard-main flex min-w-0 flex-1 flex-col bg-[#f7fafd]">
          <header ref={headerRef} className="dashboard-header relative sticky top-0 z-20 shrink-0 border-b backdrop-blur-sm">
            <div className="dashboard-header-inner flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="dashboard-header-leading flex min-w-0 items-center gap-3">
                <div className="dashboard-header-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <img
                    className="h-10 w-10 rounded-lg bg-white p-0.5 object-contain"
                    src="/images/logo.png"
                    alt="CampusSecure logo"
                    width="40"
                    height="40"
                  />
                </div>

                <div className="dashboard-header-brand min-w-0">
                  <p className="dashboard-header-name truncate text-lg font-black tracking-tight">
                    Campus<span>Secure</span>
                  </p>
                  <p className="dashboard-header-subtitle truncate text-[10px] font-black uppercase tracking-[0.16em]">
                    {t('Security Operations Center')}
                  </p>
                </div>

                <span className="dashboard-header-divider hidden h-8 w-px sm:block" />

                <div className="dashboard-header-context min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.16em]">
                    {t('Campus security')} / {sectionLabel}
                  </p>
                  <div className="flex min-w-0 items-center gap-2">
                    {canShowFeatureIllustration && (
                      <img
                        className="h-10 w-10 shrink-0 rounded-xl border border-sky-100 bg-sky-50 p-1 object-contain sm:h-12 sm:w-12"
                        src={`/images/dashboard-features/${featureIllustration.file}`}
                        alt={featureIllustration.alt}
                        width="48"
                        height="48"
                      />
                    )}
                    <h1 className="dashboard-title mt-0.5 min-w-0 break-words text-base font-black tracking-tight sm:text-lg">
                      {sectionLabel}
                    </h1>
                  </div>
                </div>
              </div>

              <div className="dashboard-header-actions flex shrink-0 items-center gap-2 sm:gap-3">
                <select
                  aria-label={t('Language')}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="dashboard-language-select h-10 max-w-[96px] rounded-xl border px-2 text-xs font-black shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <option value="en">English</option>
                  <option value="am">áŠ áˆ›áˆ­áŠ›</option>
                </select>
                {!notificationsOpen && <button
                  type="button"
                  onClick={onClearHistory}
                  disabled={clearHistoryLoading}
                  aria-label={t('Clear history')}
                  className="dashboard-header-control dashboard-header-clear-history-action inline-flex h-10 items-center rounded-xl border px-3 text-xs font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <EventNoteOutlined className="text-[18px] sm:hidden" />
                  <span className="hidden sm:inline">{t(clearHistoryLoading ? 'Clearing...' : 'Clear history')}</span>
                </button>}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="dashboard-header-control flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1d35] lg:hidden"
                  aria-label={t(mobileMenuOpen ? 'Close navigation' : 'Open navigation')}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <Close className="text-[18px]" /> : <Menu className="text-[18px]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const opening = !notificationsOpen;
                    setNotificationsOpen(opening);
                    if (opening) onNotificationsRead();
                  }}
                  className="dashboard-header-control relative flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1d35]"
                  aria-label={t('Notifications')}
                  aria-expanded={notificationsOpen}
                >
                  <NotificationsOutlined className="text-[18px]" />
                  {unreadCount > 0 && <span className="dashboard-notification-badge absolute -right-1.5 -top-1.5 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black">{unreadCount}</span>}
                </button>

                {notificationsOpen && <div className="dashboard-notification-popover absolute right-4 top-[4.5rem] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2"><strong className="text-sm text-[#0b1f3a]">{t('Live notifications')}</strong><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400">{unreadCount} {t('unread')}</span><button type="button" onClick={onClearNotificationHistory} disabled={clearHistoryLoading} aria-label={t('Clear history')} className="text-xs font-bold text-slate-600 hover:text-red-700 disabled:opacity-60">{t(clearHistoryLoading ? 'Clearing...' : 'Clear history')}</button></div></div>
                  {notifications.length ? <div className="max-h-72 overflow-y-auto">{notifications.map((notification) => <button key={notification.id} type="button" onClick={() => {
                    setNotificationsOpen(false);
                    if (onNotificationOpen) onNotificationOpen(notification);
                    else navigateFromLayout(notification.link || (notification.incident_id ? `/incidents/${notification.incident_id}` : '/alerts'));
                  }} className={cn('dashboard-notification-action block w-full border-b border-slate-100 px-2 py-3 text-left last:border-0 hover:bg-slate-50', !notification.read && 'bg-emerald-50/50')}><span className="block text-xs font-black text-[#0b1f3a]">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{notification.message}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{notification.incident_type ? `${notification.incident_type.replace(/_/g, ' ')} Â· ` : ''}{notification.severity || 'unknown'}{notification.location_name ? ` Â· ${notification.location_name}` : ''} Â· {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></button>)}                  </div> : <p className="px-2 py-5 text-center text-xs text-slate-500">{notificationsError || (!notificationsReady ? t('Loading notifications...') : t('No new notifications'))}</p>}
                </div>}
                {realtimeNotification && <div className="fixed left-1/2 top-[4.5rem] z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-sky-200 bg-white p-4 shadow-xl ring-1 ring-sky-100" role="region" aria-label={t('Realtime notification')} aria-live="polite">
                  <button type="button" className="block w-full text-left" onClick={() => {
                    setRealtimeNotification(null);
                    setNotificationsOpen(false);
                    if (onNotificationOpen) onNotificationOpen(realtimeNotification);
                    else navigateFromLayout(realtimeNotification.link || (realtimeNotification.incident_id ? `/incidents/${realtimeNotification.incident_id}` : '/alerts'));
                  }}>
                    <span className="block text-sm font-black text-[#0b1f3a]">{realtimeNotification.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{realtimeNotification.message}</span>
                  </button>
                  <button type="button" aria-label={t('Dismiss notification')} className="absolute right-2 top-2 rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setRealtimeNotification(null)}><Close className="text-[16px]" /></button>
                </div>}

                {activeSection === 'history' && <button
                  type="button"
                  onClick={onClearHistory}
                  disabled={clearHistoryLoading}
                  aria-label={t('Clear incident history')}
                  className="dashboard-header-clear-history inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:h-auto md:w-auto md:px-3 md:py-2"
                >
                  <EventNoteOutlined className="text-[18px] md:hidden" />
                  <span className="hidden md:inline">{t(clearHistoryLoading ? 'Clearing...' : 'Clear')}</span>
                </button>}

                <button
                  type="button"
                  aria-label={t('Live Feed')}
                  title={t('Live Feed')}
                  className="dashboard-live-feed-control inline-flex h-10 w-auto items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs font-black text-[#155a91] shadow-sm transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:h-auto sm:px-3"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#155a91] ring-4 ring-sky-100" />
                  <span className="sm:hidden">Live</span>
                  <span className="hidden sm:inline">{t('Live Feed')}</span>
                </button>

                <div className="dashboard-header-user flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <UserAvatar user={user} size="h-9 w-9" />
                  <div className="hidden sm:block">
                    <p className="text-sm font-bold text-[#0b1f3a]">{user?.name || 'Campus User'}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {t(user?.role || 'Security')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="dashboard-header-control dashboard-header-logout flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1d35]"
                  aria-label={t('Log out')}
                >
                  <Logout className="text-[18px]" />
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <nav className="border-t border-slate-200 bg-[#f7fafd] px-4 py-3 shadow-inner lg:hidden" aria-label={t('Mobile navigation')}>
                <div className="grid gap-1 sm:grid-cols-2">
                  {navigationItems.filter(({ path }) => canAccessNavigation(path, user?.role)).map(({ label, path, icon: Icon }) => {
                    const normalized = path.replace('/', '').split('/')[0] || 'overview';
                    const isActive = activeSection === normalized || (activeSection === 'overview' && path === '/dashboard');
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={() => { setMobileMenuOpen(false); navigateFromLayout(path); }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                          isActive ? 'bg-[#0b1f3a] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-[#0b1f3a] hover:shadow-sm',
                        )}
                      >
                        <Icon className="text-[18px]" />
                        <span className="flex-1 text-sm font-bold">{t(navigationItemLabel(label, user?.role))}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>
            )}
          </header>

          <div className="dashboard-workspace flex">
            <Sidebar
              user={user}
              language={language}
              selectedGroupId={selectedNavigationGroup}
              onSelectGroup={setSelectedNavigationGroup}
            />
          <div className={cn('dashboard-content min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8', activeSection === 'overview' && !selectedNavigationGroup && 'dashboard-overview-content')}>
            {(activeSection !== 'overview' && activeSection !== 'detail' || selectedNavigationGroup) && (
              <div className="dashboard-back-row">
                <DashboardBackButton onBack={selectedNavigationGroup ? () => setSelectedNavigationGroup(null) : undefined} />
              </div>
            )}
            {selectedNavigationGroup
              ? <NavigationGroupContent group={navigationGroups.find(({ id }) => id === selectedNavigationGroup)} user={user} language={language} onNavigate={navigateFromLayout} />
              : children}
          </div>
          </div>
          </main>
          <PublicFooter dashboard />
          <SafetyChatbot user={user} />
    </div>
  );
}

function Sidebar({ user, activeSection, language, selectedGroupId, onSelectGroup }) {
  const t = (text) => translateDashboardText(text, language);
  const visibleGroups = navigationGroups.filter(({ paths }) =>
    paths.some((path) => canAccessNavigation(path, user?.role)),
  );
  return (
    <aside className="dashboard-sidebar hidden min-h-0 w-[280px] shrink-0 overflow-hidden text-white lg:flex lg:flex-col">
      <div className="dashboard-sidebar-navigation flex min-h-0 flex-1 flex-col gap-1 px-3 py-4">
        {visibleGroups.map((group) => {
          const { id, icon: Icon } = group;
          const isSelected = selectedGroupId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectGroup(id)}
              aria-pressed={isSelected}
              className={cn(
                'dashboard-nav-item flex w-full shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-blue-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--primary-blue)]',
                isSelected ? 'bg-[var(--primary-blue-hover)] text-white shadow-[0_8px_20px_rgba(15,71,120,0.18)]' : 'text-blue-100 hover:bg-[var(--primary-blue-hover)] hover:text-white',
              )}
            >
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-blue-100')}>
                <Icon className="text-[18px]" />
              </span>
              <span>{t(navigationGroupLabel(group, user?.role))}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function NavigationGroupContent({ group, user, language, onNavigate }) {
  const t = (text) => translateDashboardText(text, language);
  if (!group) return null;

  const groupItems = navigationItems.filter(({ path }) =>
    group.paths.includes(path) && canAccessNavigation(path, user?.role),
  );
  const groupLabel = navigationGroupLabel(group, user?.role);

  return (
    <section className="mx-auto w-full max-w-[1920px] space-y-6">
      <div className="min-w-0 flex-1">
        <p className="dashboard-eyebrow">{t('Workspace Lists')}</p>
        <h2 className="mt-1 text-2xl font-black text-[#0b1f3a]">{t(groupLabel)}</h2>
        <p className="mt-2 text-sm text-slate-600">Choose a feature to open its existing workspace.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groupItems.map(({ label, path, icon: Icon }) => (
          <button
            key={path}
            type="button"
            onClick={() => onNavigate(path)}
            className={cn(
              'dashboard-panel dashboard-navigation-action flex gap-4 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700',
              group.id === 'incidents'
                ? 'min-h-32 flex-col items-center justify-center px-5 py-6 text-center'
                : 'min-h-24 items-center text-left',
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Icon className="text-[22px]" />
            </span>
            <span className={cn(
              'font-black text-[#0b1f3a]',
              group.id === 'incidents' ? 'w-full break-words text-center' : 'flex-1',
            )}>{t(navigationItemLabel(label, user?.role))}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function IncidentTable({
  incidents = [],
  officers = [],
  loading = false,
  onView = () => { },
  onStatusChange = () => { },
  onAssign = () => { },
  assignmentLoading = '',
  privileged = true,
  canAssign = privileged,
}) {
  const [language] = useLanguage();
  const t = (text) => translateDashboardText(text, language);
  const visibleIncidents = useMemo(() => incidents || [], [incidents]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-center gap-3 text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          {t('Loading incidents...')}
        </div>
      </div>
    );
  }

  if (!visibleIncidents.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <ReportProblemOutlined className="text-[24px]" />
        </div>
        <h3 className="text-xl font-black text-[#0b1f3a]">{t('No incidents found')}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
          {t('There are no records matching the current filters or the queue is clear.')}
        </p>
      </div>
    );
  }

  return (
    <div className="incident-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
      <div className="incident-table-scroll dashboard-table-scroll overflow-x-auto">
        <table className="incident-table w-full min-w-[1080px] border-separate border-spacing-0 xl:min-w-0">
          <thead className="bg-[#f4f8fc]">
            <tr>
              <th className="incident-column incident-column-main px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Incident')}
              </th>
              <th className="incident-column incident-column-compact status-cell px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Severity')}
              </th>
              <th className="incident-column incident-column-compact px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Status')}
              </th>
              <th className="incident-column px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Location')}
              </th>
              <th className="incident-column px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Reporter')}
              </th>
              <th className="incident-column px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Officer')}
              </th>
              <th className="incident-column incident-column-updated px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Updated')}
              </th>
              <th className="incident-column incident-column-action px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                {t('Action')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {visibleIncidents.map((incident) => {
              const incidentStatus = incident.status || 'reported';
              const assignedResponse = incident?.responses?.[0];
              const assignmentWasDeclined = ['declined'].includes(
                String(assignedResponse?.assignment_status || assignedResponse?.status || '').toLowerCase(),
              );
              const responder = assignmentWasDeclined ? 'Unassigned' : assignedResponse?.responder ?? 'Unassigned';
              const assignedOfficerId = assignmentWasDeclined ? '' : assignedResponse?.responder_id || responder?.user_id || '';
              const isAssignmentLoading = assignmentLoading === incident.incident_id;

              return (
                <tr
                  key={incident.incident_id ?? incident.id ?? `${incident.type}-${incident.created_at}`}
                  className="transition hover:bg-emerald-50/30"
                >
                  <td className="incident-cell incident-description-cell px-4 py-3.5 align-top">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <WarningAmberOutlined className="text-[18px]" />
                      </div>

                      <div>
                        <p className="text-base font-black text-[#0b1f3a]">{toTitleCase(incident.type)}</p>
                        <p className="mt-1 max-w-[220px] text-sm leading-5 text-slate-600">
                          {t(incident.description || 'No description provided')}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="incident-cell incident-location-cell px-4 py-3.5 align-top">
                    <span
                      className={cn(
                        'severity-badge inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                        incident.severity || 'medium',
                        severityClasses[incident.severity] || 'border-slate-200 bg-slate-100 text-slate-700',
                      )}
                    >
                      {t(toTitleCase(incident.severity || 'medium'))}
                    </span>
                  </td>

                  <td className="incident-cell status-cell px-4 py-3.5 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <IncidentStatusBadge status={incidentStatus}>
                        {t(formatIncidentStatus(incidentStatus))}
                      </IncidentStatusBadge>
                      {assignmentWasDeclined && <IncidentStatusBadge status="declined">{t('Declined')}</IncidentStatusBadge>}
                    </div>
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top">
                    <div className="text-sm font-bold text-slate-800">
                      {t(incident.location_name || incident.building || 'Location unavailable')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {incident.room ? `${incident.room}` : t('Campus')}
                    </div>
                  </td>

                  <td className="incident-cell incident-reporter-cell px-4 py-3.5 align-top text-sm font-semibold text-slate-700">
                    {incident.reporter?.name || t(incident.is_anonymous ? 'Anonymous' : 'Campus member')}
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top text-sm font-semibold text-slate-700">
                    {typeof responder === 'string' ? t(responder) : responder?.name || t('Unassigned')}
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top text-sm text-slate-600">
                    {formatDate(incident.updated_at || incident.created_at)}
                  </td>

                  <td className="incident-cell incident-action-cell whitespace-nowrap px-4 py-3.5 align-top">
                    <div className="action-buttons flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onView(incident)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                      >
                        {t('View')}
                      </button>

                      {privileged && (
                        <select
                          value={incidentStatus}
                          onChange={(event) => onStatusChange(incident, event.target.value)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          aria-label={`${t('Change status for')} ${incident.type}`}
                        >
                          {!editableIncidentStatuses.includes(incidentStatus) && (
                            <option value={incidentStatus}>
                              {t(formatIncidentStatus(incidentStatus))}
                            </option>
                          )}
                          {editableIncidentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {t(formatIncidentStatus(status))}
                            </option>
                          ))}
                        </select>
                      )}

                      {canAssign && officers.length > 0 && (
                        <select
                          value={assignedOfficerId}
                          onChange={(event) => onAssign(incident, event.target.value)}
                          disabled={Boolean(assignedOfficerId) || isAssignmentLoading}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`${t('Assign officer for')} ${incident.type}`}
                        >
                          <option value="">{t(isAssignmentLoading ? 'Assigning...' : 'Assign officer')}</option>
                          {officers
                            .filter((officer) => officer.assignable !== false && (!officer.availability_status || officer.availability_status === 'available'))
                            .map((officer) => (
                            <option key={officer.user_id} value={officer.user_id}>
                              {officer.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardLayoutDemo() {
  const sampleIncidents = [
    {
      incident_id: 101,
      type: 'assault',
      severity: 'critical',
      status: 'investigating',
      description: 'Suspicious altercation reported near the student center.',
      location_name: 'Student Center',
      building: 'North Hall',
      room: 'Lobby',
      reporter: { name: 'Alicia Moore' },
      responses: [{ responder: { name: 'Officer Diaz' } }],
      created_at: '2026-09-01T14:15:00Z',
      updated_at: '2026-09-01T14:32:00Z',
    },
    {
      incident_id: 102,
      type: 'suspicious_activity',
      severity: 'high',
      status: 'dispatched',
      description: 'Unverified subject observed near the science building.',
      location_name: 'Science Building',
      building: 'Science Hall',
      room: 'West Entrance',
      reporter: { name: 'Nora Kim' },
      responses: [{ responder: { name: 'Officer Lewis' } }],
      created_at: '2026-09-01T12:40:00Z',
      updated_at: '2026-09-01T12:58:00Z',
    },
    {
      incident_id: 103,
      type: 'fire_alarm',
      severity: 'medium',
      status: 'resolved',
      description: 'Alarm triggered; no fire detected after inspection.',
      location_name: 'Library',
      building: 'Central Library',
      room: 'Second Floor',
      reporter: { name: 'John Carter' },
      responses: [{ responder: { name: 'Officer Shah' } }],
      created_at: '2026-09-01T09:05:00Z',
      updated_at: '2026-09-01T09:26:00Z',
    },
  ];

  return (
    <DashboardLayout
      user={{ name: 'Alex Morgan', role: 'security' }}
      activeSection="active"
      incidents={sampleIncidents}
      onNavigate={(path) => console.log('Navigate to:', path)}
      onLogout={() => console.log('Logout')}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Security queue
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                Active incidents
              </h2>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              Create incident report
            </button>
          </div>
        </section>

        <IncidentTable
          incidents={sampleIncidents}
          privileged
          onView={(incident) => console.log('Open incident', incident)}
          onStatusChange={(incident, nextStatus) => console.log('Update status', incident.incident_id, nextStatus)}
        />
      </div>
    </DashboardLayout>
  );
}

export function UserAvatar({ user, size = 'h-10 w-10' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeName = String(user?.name || 'User').trim() || 'User';
  const normalizedRole = String(user?.role || 'user').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const roleLabel = normalizedRole === 'security' || normalizedRole === 'security officer'
    ? 'security officer'
    : normalizedRole === 'admin' || normalizedRole === 'administrator'
      ? 'administrator'
      : ['student', 'faculty', 'staff'].includes(normalizedRole)
        ? normalizedRole
        : 'user';
  const profileLabel = `${safeName} ${roleLabel} profile`;
  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  if (user?.profile_photo_url && !imageFailed) {
    return (
      <ProfilePhotoPreview
        src={user.profile_photo_url}
        alt={profileLabel}
        className={`${size} rounded-lg object-cover ring-4 ring-slate-100`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${size} items-center justify-center rounded-lg bg-[#0b1f3a] text-xs font-black text-white ring-4 ring-slate-100`}
      role="img"
      aria-label={profileLabel}
      title={profileLabel}
    >
      {initials}
    </div>
  );
}
