// src/components/AnalyticsCharts.jsx
import { useMemo } from 'react';
import './analytics.css';

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['reported', 'in_progress', 'acknowledged', 'dispatched', 'on_scene', 'resolved', 'closed', 'cancelled'];

const label = (key) => key.replace(/_/g, ' ');

const AnalyticsCharts = ({ incidents = [] }) => {
  const { total, bySeverity, byStatus, critical, high, resolved, active } = useMemo(() => {
    const severityCount = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
    const statusCount = Object.fromEntries(STATUSES.map((s) => [s, 0]));

    incidents.forEach((incident) => {
      if (incident.severity in severityCount) severityCount[incident.severity] += 1;
      if (incident.status in statusCount) statusCount[incident.status] += 1;
    });

    const resolvedCount = statusCount.resolved || 0;
    const activeCount = incidents.length - resolvedCount - (statusCount.closed || 0) - (statusCount.cancelled || 0);

    return {
      total: incidents.length,
      bySeverity: severityCount,
      byStatus: statusCount,
      critical: severityCount.critical,
      high: severityCount.high,
      resolved: resolvedCount,
      active: Math.max(activeCount, 0),
    };
  }, [incidents]);

  const maxSeverity = Math.max(1, ...Object.values(bySeverity));

  return (
    <div className="analytics">
      <div className="analytics-header">
        <div>
          <p className="analytics-eyebrow">Decision support</p>
          <h2 className="analytics-title">Incident analytics</h2>
          <p className="analytics-subtitle">Live aggregates from the incident service.</p>
        </div>
        <button type="button" className="refresh-button">↻ Refresh</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="live-badge">live</span>
          <p className="stat-label">Total incidents</p>
          <p className="stat-value">{total}</p>
        </div>
        <div className="stat-card">
          <span className="live-badge critical">live</span>
          <p className="stat-label">Critical</p>
          <p className="stat-value">{critical}</p>
        </div>
        <div className="stat-card">
          <span className="live-badge high">live</span>
          <p className="stat-label">High</p>
          <p className="stat-value">{high}</p>
        </div>
        <div className="stat-card">
          <span className="live-badge resolved">live</span>
          <p className="stat-label">Resolved</p>
          <p className="stat-value">{resolved}</p>
        </div>
        <div className="stat-card">
          <span className="live-badge active">live</span>
          <p className="stat-label">Active</p>
          <p className="stat-value">{active}</p>
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h3 className="panel-title">By severity</h3>
          {SEVERITIES.map((severity) => (
            <div className="severity-row" key={severity}>
              <div className="severity-row-head">
                <span style={{ textTransform: 'capitalize' }}>{severity}</span>
                <span>{bySeverity[severity]}</span>
              </div>
              <div className="severity-track">
                <div
                  className={`severity-fill ${severity}`}
                  style={{ width: `${(bySeverity[severity] / maxSeverity) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3 className="panel-title">By status</h3>
          <div className="status-grid">
            {STATUSES.map((status) => (
              <div className="status-tile" key={status}>
                <p className="status-tile-label">{label(status)}</p>
                <p className="status-tile-value">{byStatus[status]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;