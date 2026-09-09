import {
  DashboardOutlined,
  DescriptionOutlined,
  EventNoteOutlined,
  InsightsOutlined,
  Logout,
  Close,
  Menu,
  MapOutlined,
  PeopleAltOutlined,
  ReportProblemOutlined,
  SmsOutlined,
  ShieldOutlined,
  TaskAltOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { useMemo, useState } from 'react';

const statusClasses = {
  reported: 'border-slate-200 bg-slate-100 text-slate-700',
  investigating: 'border-slate-200 bg-slate-100 text-slate-700',
  dispatched: 'border-amber-200 bg-amber-100 text-amber-800',
  on_scene: 'border-amber-200 bg-amber-100 text-amber-800',
  resolved: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  closed: 'border-slate-900 bg-slate-900 text-white',
};

const severityClasses = {
  low: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  medium: 'border-amber-200 bg-amber-100 text-amber-800',
  high: 'border-orange-200 bg-orange-100 text-orange-700',
  critical: 'border-red-200 bg-red-100 text-red-700',
};

const navigationItems = [
  { label: 'Overview', path: '/dashboard', icon: DashboardOutlined },
  { label: 'Active incidents', path: '/incidents/active', icon: ReportProblemOutlined, badge: true },
  { label: 'Incident history', path: '/incidents/history', icon: EventNoteOutlined },
  { label: 'Emergency center', path: '/emergency', icon: WarningAmberOutlined, badge: true },
  { label: 'Live map', path: '/map', icon: MapOutlined },
  { label: 'SOS / Emergency', path: '/sos', icon: WarningAmberOutlined, badge: true },
  { label: 'Evidence', path: '/evidence', icon: DescriptionOutlined },
  { label: 'Security officers', path: '/officers', icon: PeopleAltOutlined },
  { label: 'User management', path: '/users', icon: PeopleAltOutlined },
  { label: 'Analytics', path: '/analytics', icon: InsightsOutlined },
  { label: 'Responses', path: '/responses', icon: SmsOutlined },
  { label: 'Alerts and zones', path: '/alerts', icon: WarningAmberOutlined },
  { label: 'Zones', path: '/zones', icon: MapOutlined },
];

function canAccessNavigation(path, role) {
  if (path === '/users') return role === 'admin';
  if (path === '/officers') return ['security', 'admin'].includes(role);
  if (['/analytics', '/responses'].includes(path)) return ['security', 'admin'].includes(role);
  return true;
}

const toTitleCase = (value) =>
  String(value ?? 'incident')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Unknown');

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function DashboardLayout({
  user,
  activeSection = 'overview',
  incidents = [],
  onNavigate = () => { },
  onLogout = () => { },
  onClearHistory = async () => { },
  clearHistoryLoading = false,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeIncidentCount = incidents.filter((incident) =>
    ['reported', 'investigating', 'dispatched', 'on_scene'].includes(incident.status),
  ).length;

  const initials = (user?.name || 'Campus User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar
          user={user}
          activeSection={activeSection}
          activeIncidentCount={activeIncidentCount}
          onNavigate={onNavigate}
          onLogout={onLogout}
          initials={initials}
        />

        <main className="flex min-w-0 flex-1 flex-col bg-[#f7fafd]">
          <header className="dashboard-header sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                  <ShieldOutlined className="text-[20px]" />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    CAMPUS SECURITY / {activeSection.toUpperCase()}
                  </p>
                  <h1 className="mt-0.5 text-lg font-black tracking-tight text-[#0b1f3a]">
                    {toTitleCase(activeSection)}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 lg:hidden"
                  aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <Close className="text-[18px]" /> : <Menu className="text-[18px]" />}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/incidents/active')}
                  className="dashboard-icon-button relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                  aria-label="Notifications"
                >
                  <WarningAmberOutlined className="text-[18px]" />
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 py-0.5 text-center text-[9px] font-black text-white">9</span>
                </button>

                <button
                  type="button"
                  onClick={onClearHistory}
                  disabled={clearHistoryLoading}
                  className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
                >
                  {clearHistoryLoading ? 'Clearing...' : 'Clear history'}
                </button>

                <button
                  type="button"
                  className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 md:inline-flex"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                  Live feed
                </button>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b1f3a] text-xs font-black text-white ring-4 ring-slate-100">
                    {initials}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-bold text-[#0b1f3a]">{user?.name || 'Campus User'}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {user?.role || 'Security'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="dashboard-icon-button flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                  aria-label="Log out"
                >
                  <Logout className="text-[18px]" />
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <nav className="border-t border-slate-200 bg-[#f7fafd] px-4 py-3 shadow-inner lg:hidden" aria-label="Mobile navigation">
                <div className="grid gap-1 sm:grid-cols-2">
                  {navigationItems.filter(({ path }) => canAccessNavigation(path, user?.role)).map(({ label, path, icon: Icon, badge }) => {
                    const normalized = path.replace('/', '').split('/')[0] || 'overview';
                    const isActive = activeSection === normalized || (activeSection === 'overview' && path === '/dashboard');
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={() => { setMobileMenuOpen(false); onNavigate(path); }}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2',
                          isActive ? 'bg-[#0b1f3a] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-[#0b1f3a] hover:shadow-sm',
                        )}
                      >
                        <Icon className="text-[18px]" />
                        <span className="flex-1 text-sm font-bold">{label}</span>
                        {badge && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-black', isActive ? 'bg-cyan-400 text-[#08213d]' : 'bg-[#0b1f3a] text-white')}>{label.includes('Active') ? 9 : label === 'Emergency center' ? 4 : 5}</span>}
                      </button>
                    );
                  })}
                </div>
              </nav>
            )}
          </header>

          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ user, activeSection, activeIncidentCount, onNavigate, onLogout, initials }) {
  return (
    <aside className="dashboard-sidebar hidden w-[280px] shrink-0 bg-[#081d35] text-white lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-[#08213d] shadow-[0_8px_24px_rgba(34,211,238,0.2)]">
          <ShieldOutlined className="text-[24px]" />
        </div>

        <div>
          <div className="text-xl font-black tracking-tight text-white">
            Campus<span className="text-cyan-300">Secure</span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Security Operations Center
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <p className="px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </p>

        <nav className="mt-2 space-y-1">
          {navigationItems.filter(({ path }) => canAccessNavigation(path, user?.role)).map(({ label, path, icon: Icon, badge }) => {
            const normalized = path.replace('/', '').split('/')[0] || 'overview';
            const isActive = activeSection === normalized || (activeSection === 'overview' && path === '/dashboard');

            return (
              <button
                key={path}
                type="button"
                onClick={() => onNavigate(path)}
                className={cn(
                  'dashboard-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081d35]',
                  isActive ? 'bg-cyan-400 text-[#08213d] shadow-[0_8px_20px_rgba(34,211,238,0.16)]' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    isActive ? 'bg-white/25 text-[#08213d]' : 'bg-white/10 text-slate-300',
                  )}
                >
                  <Icon className="text-[18px]" />
                </span>

                <span className="flex-1 text-sm font-bold">{label}</span>

                {badge && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                      isActive ? 'bg-[#08213d]/15 text-[#08213d]' : 'bg-cyan-400 text-[#08213d]',
                    )}
                  >
                    {label.includes('Active') ? 9 : label === 'Emergency center' ? 4 : 5}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 px-4">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200">
            <TaskAltOutlined className="text-[18px]" />
          </div>

          <p className="text-sm font-black text-white">Response readiness</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Critical incidents and officer assignments are monitored in real time.
          </p>
        </div>
      </div>

      <div className="mt-auto border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-xs font-black text-[#08213d]">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">CampusSecure...</p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {user?.role || 'Security'}
            </p>
          </div>

          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
            <i className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ADMIN
          </span>
        </div>
      </div>
    </aside>
  );
}

export function IncidentTable({
  incidents = [],
  loading = false,
  onView = () => { },
  onStatusChange = () => { },
  privileged = true,
}) {
  const visibleIncidents = useMemo(() => incidents || [], [incidents]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-center gap-3 text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          Loading incidents...
        </div>
      </div>
    );
  }

  if (!visibleIncidents.length) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <ReportProblemOutlined className="text-[24px]" />
        </div>
        <h3 className="text-xl font-black text-[#0b1f3a]">No incidents found</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
          There are no records matching the current filters or the queue is clear.
        </p>
      </div>
    );
  }

  return (
    <div className="incident-table-shell overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
      <div className="incident-table-scroll overflow-x-auto">
        <table className="incident-table w-full min-w-[1080px] border-separate border-spacing-0 xl:min-w-0">
          <thead className="bg-[#f4f8fc]">
            <tr>
              <th className="incident-column incident-column-main px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Incident
              </th>
              <th className="incident-column incident-column-compact px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Severity
              </th>
              <th className="incident-column incident-column-compact px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Status
              </th>
              <th className="incident-column px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Location
              </th>
              <th className="incident-column px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Reporter
              </th>
              <th className="incident-column px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Officer
              </th>
              <th className="incident-column incident-column-updated px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Updated
              </th>
              <th className="incident-column incident-column-action px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {visibleIncidents.map((incident) => {
              const responder = incident?.responses?.[0]?.responder ?? 'Unassigned';

              return (
                <tr
                  key={incident.incident_id ?? incident.id ?? `${incident.type}-${incident.created_at}`}
                  className="transition hover:bg-cyan-50/30"
                >
                  <td className="incident-cell px-4 py-3.5 align-top">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                        <WarningAmberOutlined className="text-[18px]" />
                      </div>

                      <div>
                        <p className="text-base font-black text-[#0b1f3a]">{toTitleCase(incident.type)}</p>
                        <p className="mt-1 max-w-[220px] text-sm leading-5 text-slate-600">
                          {incident.description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                        severityClasses[incident.severity] || 'border-slate-200 bg-slate-100 text-slate-700',
                      )}
                    >
                      {incident.severity || 'medium'}
                    </span>
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                        statusClasses[incident.status] || 'border-slate-200 bg-slate-100 text-slate-700',
                      )}
                    >
                      {toTitleCase(incident.status)}
                    </span>
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top">
                    <div className="text-sm font-bold text-slate-800">
                      {incident.location_name || incident.building || 'Location unavailable'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {incident.room ? `${incident.room}` : 'Campus'}
                    </div>
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top text-sm font-semibold text-slate-700">
                    {incident.reporter?.name || (incident.is_anonymous ? 'Anonymous' : 'Campus member')}
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top text-sm font-semibold text-slate-700">
                    {typeof responder === 'string' ? responder : responder?.name || 'Unassigned'}
                  </td>

                  <td className="incident-cell px-4 py-3.5 align-top text-sm text-slate-600">
                    {formatDate(incident.updated_at || incident.created_at)}
                  </td>

                  <td className="incident-cell incident-action-cell whitespace-nowrap px-4 py-3.5 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onView(incident)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                      >
                        View
                      </button>

                      {privileged && (
                        <select
                          value={incident.status || 'reported'}
                          onChange={(event) => onStatusChange(incident, event.target.value)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                          aria-label={`Change status for ${incident.type}`}
                        >
                          {Object.keys(statusClasses).map((status) => (
                            <option key={status} value={status}>
                              {toTitleCase(status)}
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
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">
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
