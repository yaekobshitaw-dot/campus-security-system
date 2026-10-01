import { useEffect, useState } from 'react';
import { CheckCircleOutline, Refresh, WarningAmberOutlined } from '@mui/icons-material';
import {
  Bar as RechartsBar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatIncidentStatus, UserAvatar } from './DashboardLayout';
import { translateDashboardText, useLanguage, useTranslate } from '../utils/language';

const titleCase = formatIncidentStatus;
const Heading = ({ eyebrow, title, description, action }) => {
  const [language] = useLanguage();
  const t = (text) => translateDashboardText(text, language);
  return <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-eyebrow">{t(eyebrow)}</p><h2 className="mt-2 text-xl font-black tracking-tight text-[#0b1f3a] sm:text-2xl">{t(title)}</h2>{description && <span className="mt-1 block max-w-2xl text-sm leading-6 text-slate-500">{t(description)}</span>}</div>{action && <div className="flex flex-wrap items-center gap-2">{action}</div>}</div>;
};
const EmptyState = ({ title, message }) => {
  const [language] = useLanguage();
  const t = (text) => translateDashboardText(text, language);
  return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><CheckCircleOutline className="mb-3 rounded-2xl bg-cyan-50 p-3 text-[54px] text-cyan-700 ring-1 ring-cyan-100" /><h3 className="text-lg font-black text-[#0b1f3a]">{t(title)}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{t(message)}</p></div>;
};

const chartColors = ['#155a91', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0f766e', '#64748b'];
const severityColors = { low: '#16a34a', medium: '#d97706', high: '#ea580c', critical: '#dc2626' };
const statusColors = { reported: '#155a91', investigating: '#0891b2', dispatched: '#d97706', on_scene: '#7c3aed', resolved: '#16a34a', closed: '#64748b', cancelled: '#94a3b8' };
const numericRecord = (record) => Object.entries(record || {}).map(([name, count]) => ({ name: titleCase(name), key: name, value: Number(count) || 0 }));
const countBy = (records, getKey) => records.reduce((counts, record) => {
  const key = getKey(record);
  if (key) counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const trendByDate = (records, getDate = (record) => record.created_at) => {
  const counts = {};
  records.forEach((record) => {
    const date = getDate(record);
    if (!date || Number.isNaN(new Date(date).getTime())) return;
    const key = new Date(date).toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count }));
};

function AnalyticsChartPanel({ title, children, empty }) {
  const t = useTranslate();
  return <section className="analytics-chart-panel dashboard-panel min-w-0 border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><h3 className="text-base font-black text-[#0b1f3a] sm:text-lg">{t(title)}</h3>{empty ? <div className="flex h-[260px] items-center justify-center text-center text-sm text-slate-500">{t('No data available for this chart.')}</div> : <div className="mt-4 h-[260px] min-w-0 w-full"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}</section>;
}

function AnalyticsSummaryCard({ label, value, color, index }) {
  const t = useTranslate();
  return <article className="analytics-summary-card dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]" style={{ '--analytics-accent': color, animationDelay: `${index * 55}ms` }}><span className="analytics-summary-accent" /><p className="analytics-summary-label text-xs font-black uppercase tracking-wider text-slate-500">{t(label)}</p><p className="analytics-summary-value mt-2 text-3xl font-black tracking-tight text-[#0b1f3a]">{value}</p></article>;
}

export function AnalyticsPage({ analytics, incidents = [], responses = [], loading, error, onRefresh }) {
  const t = useTranslate();
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return undefined;
    const updateMotionPreference = (event) => setReduceMotion(event.matches);
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', updateMotionPreference);
    else mediaQuery.addListener?.(updateMotionPreference);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', updateMotionPreference);
      else mediaQuery.removeListener?.(updateMotionPreference);
    };
  }, []);
  const data = analytics || {};
  const sourceIncidents = Array.isArray(incidents) ? incidents : [];
  const sourceResponses = Array.isArray(responses) ? responses : [];
  const severityCounts = Object.keys(data.by_severity || {}).length ? data.by_severity : countBy(sourceIncidents, (incident) => incident.severity);
  const statusCounts = Object.keys(data.by_status || {}).length ? data.by_status : countBy(sourceIncidents, (incident) => incident.status);
  const severity = numericRecord(severityCounts);
  const status = numericRecord(statusCounts);
  const total = data.total_incidents !== undefined && data.total_incidents !== null && Number.isFinite(Number(data.total_incidents))
    ? Number(data.total_incidents)
    : sourceIncidents.length;
  const activeStatuses = ['reported', 'assigned', 'accepted', 'in_progress', 'investigating', 'dispatched', 'on_scene', 'declined', 'unassigned'];
  const active = activeStatuses.reduce((sum, key) => sum + (Number(statusCounts[key]) || 0), 0);
  const resolved = (Number(statusCounts.resolved) || 0) + (Number(statusCounts.closed) || 0);
  const sos = sourceIncidents.filter((incident) => incident.is_sos || ['sos', 'sos_alert', 'emergency'].includes(String(incident.type || '').toLowerCase())).length;
  const closed = Number(statusCounts.closed) || 0;
  const open = active;
  const responseTimes = sourceResponses.map((response) => Number(response.response_time_seconds)).filter((seconds) => Number.isFinite(seconds) && seconds >= 0);
  const averageResponseTime = responseTimes.length ? `${Math.round(responseTimes.reduce((sum, seconds) => sum + seconds, 0) / responseTimes.length)}s` : '—';
  const types = numericRecord(countBy(sourceIncidents, (incident) => incident.type || 'other')).sort((left, right) => right.value - left.value).slice(0, 8);
  const locations = numericRecord(countBy(sourceIncidents, (incident) => incident.location_name)).sort((left, right) => right.value - left.value).slice(0, 8);
  const incidentTrend = trendByDate(sourceIncidents);
  const responseTrend = trendByDate(sourceResponses);
  const hasData = total > 0 || severity.length > 0 || status.length > 0 || sourceIncidents.length > 0 || sourceResponses.length > 0;
  const summary = [
    ['Total incidents', total, '#155a91'],
    ['Active incidents', active, '#d97706'],
    ['Resolved incidents', resolved, '#16a34a'],
    ['SOS / emergency', sos, '#dc2626'],
    ['Average response time', averageResponseTime, '#7c3aed'],
    ['Open / closed', `${open} / ${closed}`, '#0891b2'],
  ];
  return <div className="analytics-dashboard min-w-0 max-w-full space-y-6"><Heading eyebrow="Decision support" title="Incident analytics" description="Live aggregates from the incident service." action={<button type="button" className="dashboard-button" onClick={onRefresh}><Refresh className="text-[18px]" /> {t('Refresh')}</button>} />{error && <div className="dashboard-error" role="alert">{t(error)}</div>}{loading ? <div className="inline-loading">{t('Loading analytics...')}</div> : !hasData ? <EmptyState title="No analytics data" message="Incident analytics will appear when the service has records to report." /> : <><div className="analytics-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{summary.map(([label, value, color], index) => <AnalyticsSummaryCard key={label} label={label} value={value} color={color} index={index} />)}</div><div className="grid min-w-0 gap-5 md:grid-cols-2 2xl:grid-cols-3">
    <AnalyticsChartPanel title="Incident trends" empty={!incidentTrend.length}><LineChart data={incidentTrend} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="count" name={t('Incidents')} stroke="#155a91" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={!reduceMotion} animationDuration={650} /></LineChart></AnalyticsChartPanel>
    <AnalyticsChartPanel title="Incidents by category" empty={!types.length}><BarChart data={types} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={48} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><RechartsBar dataKey="value" name={t('Incidents')} radius={[6, 6, 0, 0]} isAnimationActive={!reduceMotion} animationDuration={650}>{types.map((entry, index) => <Cell key={entry.key} fill={chartColors[index % chartColors.length]} />)}</RechartsBar></BarChart></AnalyticsChartPanel>
    <AnalyticsChartPanel title="Status distribution" empty={!status.length}><PieChart><Tooltip /><Legend /><Pie data={status} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={54} outerRadius={88} paddingAngle={2} isAnimationActive={!reduceMotion} animationDuration={650}>{status.map((entry, index) => <Cell key={entry.key} fill={statusColors[entry.key] || chartColors[index % chartColors.length]} />)}</Pie></PieChart></AnalyticsChartPanel>
    <AnalyticsChartPanel title="Severity distribution" empty={!severity.length}><BarChart data={severity} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} /><Tooltip /><RechartsBar dataKey="value" name={t('Incidents')} radius={[0, 6, 6, 0]} isAnimationActive={!reduceMotion} animationDuration={650}>{severity.map((entry, index) => <Cell key={entry.key} fill={severityColors[entry.key] || chartColors[index % chartColors.length]} />)}</RechartsBar></BarChart></AnalyticsChartPanel>
    <AnalyticsChartPanel title="Response activity" empty={!responseTrend.length}><LineChart data={responseTrend} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="count" name={t('Responses')} stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={!reduceMotion} animationDuration={650} /></LineChart></AnalyticsChartPanel>
    <AnalyticsChartPanel title="Incidents by location" empty={!locations.length}><BarChart data={locations} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={54} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><RechartsBar dataKey="value" name={t('Incidents')} fill="#0891b2" radius={[6, 6, 0, 0]} isAnimationActive={!reduceMotion} animationDuration={650} /></BarChart></AnalyticsChartPanel>
  </div></>}</div>;
}

export function ResponsesPage({ responses, loading, error, onRefresh }) {
  const t = useTranslate();
  return <div className="space-y-8"><Heading eyebrow="Field coordination" title="Response management" description="Assignments and response status from the response service." action={<button type="button" className="dashboard-button" onClick={onRefresh}><Refresh className="text-[18px]" /> {t('Refresh')}</button>} />{error && <div className="dashboard-error" role="alert">{t(error)}</div>}{loading ? <div className="inline-loading">{t('Loading responses...')}</div> : responses.length ? <div className="dashboard-panel overflow-x-auto border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><table className="dashboard-table"><thead><tr><th>{t('Incident')}</th><th>{t('Responder')}</th><th>{t('Status')}</th><th>{t('Response time')}</th><th>{t('Assigned')}</th></tr></thead><tbody>{responses.map((response) => <tr key={response.response_id}><td className="font-bold">{t(titleCase(response.incident?.type || 'Incident'))}<span className="block text-xs font-normal text-slate-500">{response.incident?.location_name || t('Campus')}</span></td><td>{response.responder ? <div className="flex items-center gap-2"><UserAvatar user={response.responder} size="h-8 w-8" /><span>{response.responder.name || response.responder_id}</span></div> : response.responder_id}</td><td><span className="status-badge">{t(titleCase(response.status))}</span></td><td>{response.response_time_seconds == null ? t('Pending') : `${response.response_time_seconds}s`}</td><td>{response.created_at ? new Date(response.created_at).toLocaleString() : t('Unknown')}</td></tr>)}</tbody></table></div> : <EmptyState title="No responses" message="No response assignments are currently available." />}</div>;
}

export function AlertsZonesPage({ alerts, zones, loading, error, onRefresh, onReadAlert, canManage, showClear = true, selectedAlertId }) {
  const t = useTranslate();
  const [clearedAlertIds, setClearedAlertIds] = useState(() => new Set());
  const visibleAlerts = alerts.filter((alert) => !clearedAlertIds.has(String(alert.alert_id)));
  const clearAlerts = () => {
    setClearedAlertIds((current) => new Set([
      ...current,
      ...visibleAlerts.map((alert) => String(alert.alert_id)),
    ]));
  };
  return (
    <div className="space-y-8">
      <Heading
        eyebrow="Communications and coverage"
        title="Alerts and zones"
        description={canManage ? 'Review alerts and active campus zones. Alert actions are limited to supported operations.' : 'Review alerts and active campus zones.'}
        action={
          <div className="flex flex-wrap gap-2">
            {showClear && (
              <button type="button" className="dashboard-button" onClick={clearAlerts} disabled={!visibleAlerts.length} aria-label={t('Clear alerts')}>
                {t('Clear')}
              </button>
            )}
            <button type="button" className="dashboard-button" onClick={onRefresh}>
              <Refresh className="text-[18px]" /> {t('Refresh')}
            </button>
          </div>
        }
      />
      {error && <div className="dashboard-error" role="alert">{t(error)}</div>}
      {loading ? <div className="inline-loading">{t('Loading alerts and zones...')}</div> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-black text-[#0b1f3a]">{t('Alerts')}</h3>
            {visibleAlerts.length ? (
              <div className="mt-4 space-y-3">
                {visibleAlerts.map((alert) => (
                  <article
                    key={alert.alert_id}
                    id={`alert-${alert.alert_id}`}
                    data-selected={String(alert.alert_id) === String(selectedAlertId)}
                    className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/30 ${String(alert.alert_id) === String(selectedAlertId) ? 'ring-2 ring-sky-500' : ''}`}
                  >
                    <div className="flex gap-3">
                      <WarningAmberOutlined className="text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h4 className="font-black text-[#0b1f3a]">{alert.title || t(titleCase(alert.type))}</h4>
                          {canManage && !alert.is_read && <button type="button" className="table-action" onClick={() => onReadAlert(alert.alert_id)}>{t('Mark read')}</button>}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{alert.message || t('No additional details.')}</p>
                        <p className="mt-2 text-xs text-slate-500">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : t('Unscheduled')}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="mt-4"><EmptyState title="No alerts" message="There are no alerts to display." /></div>}
          </section>
          <section className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-black text-[#0b1f3a]">{t('Active zones')}</h3>
            {zones.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {zones.map((zone) => (
                  <article key={zone.zone_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/30">
                    <h4 className="font-black text-[#0b1f3a]">{zone.name}</h4>
                    <p className="mt-1 text-sm text-slate-600">{zone.description || t('No description provided.')}</p>
                    <p className="mt-3 text-xs font-bold text-slate-500">{t('Radius')}: {zone.radius || t('Unknown')}m</p>
                  </article>
                ))}
              </div>
            ) : <div className="mt-4"><EmptyState title="No active zones" message="No active zones are configured in the backend." /></div>}
            <p className="mt-4 text-xs text-slate-500">{t('Zone creation and editing are unavailable because the current backend exposes read-only zone operations.')}</p>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'slate' }) { const t = useTranslate(); const colors = { slate: 'bg-slate-100 text-slate-700 ring-slate-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200', red: 'bg-red-50 text-red-700 ring-red-200', teal: 'bg-cyan-50 text-cyan-700 ring-cyan-200' }; return <article className="dashboard-panel border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"><span className={`inline-flex rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${colors[tone]}`}>{t('Live')}</span><p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{t(label)}</p><p className="mt-1 text-3xl font-black tracking-tight text-[#0b1f3a]">{value}</p></article>; }
function Bar({ label, value, total }) { const t = useTranslate(); const width = total ? Math.min(100, (value / total) * 100) : 0; return <div><div className="flex justify-between text-sm font-bold text-slate-700"><span>{t(label)}</span><span className="text-[#0b1f3a]">{value}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-cyan-500 transition-all" style={{ width: `${width}%` }} /></div></div>; }
