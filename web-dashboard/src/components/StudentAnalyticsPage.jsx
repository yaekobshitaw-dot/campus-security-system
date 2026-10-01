const titleCase = (value) => String(value || 'other')
  .replace(/[_-]/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown';
};

export default function StudentAnalyticsPage({
  incidents = [],
  userId,
  loading = false,
  error = '',
  onRefresh = () => {},
}) {
  const ownIncidents = incidents.filter((incident) => incident.user_id === userId);
  const counts = ownIncidents.reduce((result, incident) => {
    const status = String(incident.status || '').toLowerCase();
    if (['reported', 'pending', 'acknowledged'].includes(status)) result.open += 1;
    if (['investigating', 'dispatched', 'on_scene'].includes(status)) result.inProgress += 1;
    if (['resolved', 'closed'].includes(status)) result.resolved += 1;
    const category = incident.type || 'other';
    result.categories[category] = (result.categories[category] || 0) + 1;
    return result;
  }, { open: 0, inProgress: 0, resolved: 0, categories: {} });
  const categories = Object.entries(counts.categories).sort((left, right) => right[1] - left[1]);
  const recentIncidents = [...ownIncidents]
    .sort((left, right) => new Date(right.updated_at || right.created_at).getTime()
      - new Date(left.updated_at || left.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="dashboard-heading flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <p className="dashboard-eyebrow">Your reports</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#0b1f3a]">Personal analytics</h2>
          <p className="mt-1 text-sm text-slate-500">Statistics and activity for incidents you reported.</p>
        </div>
        <button type="button" className="dashboard-button" onClick={onRefresh} disabled={loading}>Refresh</button>
      </div>

      {error && <div className="dashboard-error" role="alert">{error}</div>}
      {loading && <div className="inline-loading">Loading your incident analytics...</div>}

      {!loading && !error && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Your incident statistics">
            {[
              ['Total incidents reported', ownIncidents.length],
              ['Open / Pending', counts.open],
              ['Investigating / In Progress', counts.inProgress],
              ['Resolved / Closed', counts.resolved],
            ].map(([label, value]) => (
              <article key={label} className="dashboard-panel border-slate-200/80 bg-white">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-black text-[#0b1f3a]">{value}</p>
              </article>
            ))}
          </section>

          {ownIncidents.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="text-lg font-black text-[#0b1f3a]">No incidents reported yet</h3>
              <p className="mt-2 text-sm text-slate-500">Your personal incident statistics and activity will appear here after you submit a report.</p>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="dashboard-panel border-slate-200/80 bg-white">
                <h3 className="text-lg font-black text-[#0b1f3a]">Incident categories</h3>
                <ul className="mt-4 space-y-4">
                  {categories.map(([category, count]) => (
                    <li key={category}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">{titleCase(category)}</span>
                        <span className="font-black text-[#0b1f3a]">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(count / ownIncidents.length) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="dashboard-panel border-slate-200/80 bg-white">
                <h3 className="text-lg font-black text-[#0b1f3a]">Recent incident activity</h3>
                <ul className="mt-4 divide-y divide-slate-100">
                  {recentIncidents.map((incident) => (
                    <li key={incident.incident_id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0">
                      <div>
                        <p className="font-bold text-[#0b1f3a]">{titleCase(incident.type)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(incident.updated_at || incident.created_at)}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{titleCase(incident.status)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
