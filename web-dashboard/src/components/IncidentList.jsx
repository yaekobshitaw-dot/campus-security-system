import React, { useState } from 'react';
import { theme } from '../theme';

function IncidentList({ incidents, onIncidentClick }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const getStatusColor = (status) => {
    const colors = {
      reported: '#ff9100',
      acknowledged: '#2979ff',
      dispatched: '#d500f9',
      on_scene: '#00c853',
      resolved: '#00c853',
      closed: '#78909c',
      cancelled: '#78909c'
    };
    return colors[status] || '#78909c';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#00c853',
      medium: '#ff9100',
      high: '#ff1744',
      critical: '#d500f9'
    };
    return colors[severity] || '#78909c';
  };

  const filteredIncidents = incidents.filter(incident => {
    if (filter === 'all') return true;
    return incident.status === filter;
  });

  const searchedIncidents = filteredIncidents.filter(incident =>
    incident.type.toLowerCase().includes(search.toLowerCase()) ||
    incident.location_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <h2 style={styles.title}>📋 Incidents</h2>
          <span style={styles.count}>{searchedIncidents.length} total</span>
        </div>
        <div style={styles.controls}>
          <input
            type="text"
            placeholder="🔍 Search incidents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">📊 All Status</option>
            <option value="reported">🟡 Reported</option>
            <option value="acknowledged">🔵 Acknowledged</option>
            <option value="dispatched">🟣 Dispatched</option>
            <option value="on_scene">🟢 On Scene</option>
            <option value="resolved">✅ Resolved</option>
            <option value="closed">🔘 Closed</option>
          </select>
        </div>
      </div>

      {searchedIncidents.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>📭</span>
          <p style={styles.emptyText}>No incidents found</p>
          <p style={styles.emptySubText}>Report a new incident to get started</p>
        </div>
      ) : (
        <div style={styles.list}>
          {searchedIncidents.map((incident) => (
            <div
              key={incident.incident_id}
              style={styles.card}
              onClick={() => onIncidentClick(incident)}
            >
              <div style={styles.cardGlow}></div>
              <div style={styles.cardHeader}>
                <div style={styles.typeContainer}>
                  <span style={styles.typeIcon}>
                    {incident.type === 'fire' ? '🔥' :
                     incident.type === 'medical' ? '🚑' :
                     incident.type === 'security_threat' ? '🚨' :
                     incident.type === 'suspicious_package' ? '📦' :
                     incident.type === 'flood' ? '🌊' :
                     incident.type === 'assault' ? '⚔️' :
                     incident.type === 'theft' ? '💰' :
                     '⚠️'}
                  </span>
                  <span style={styles.cardType}>
                    {incident.type.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <span
                  style={{
                    ...styles.statusBadge,
                    background: getStatusColor(incident.status),
                  }}
                >
                  {incident.status}
                </span>
              </div>
              <p style={styles.cardDescription}>
                {incident.description || 'No description provided'}
              </p>
              <div style={styles.cardFooter}>
                <span
                  style={{
                    ...styles.severityBadge,
                    background: getSeverityColor(incident.severity),
                  }}
                >
                  {incident.severity}
                </span>
                <span style={styles.cardLocation}>
                  📍 {incident.location_name || incident.building || 'Unknown'}
                </span>
                <span style={styles.cardTime}>
                  🕐 {new Date(incident.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: theme.colors.shadow,
    border: '1px solid rgba(255,255,255,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '15px',
    marginBottom: '20px',
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    margin: 0,
    color: theme.colors.text,
    fontSize: '20px',
    fontWeight: '700',
  },
  count: {
    background: '#e8f0fe',
    color: '#667eea',
    padding: '2px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  controls: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  searchInput: {
    padding: '10px 16px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '25px',
    fontSize: '14px',
    minWidth: '220px',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(10px)',
    outline: 'none',
    transition: 'all 0.3s',
    ':focus': {
      borderColor: '#667eea',
      boxShadow: '0 0 20px rgba(102,126,234,0.15)',
    }
  },
  filterSelect: {
    padding: '10px 16px',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '25px',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(10px)',
    outline: 'none',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.5)',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    ':hover': {
      transform: 'translateY(-4px) scale(1.01)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
      borderColor: 'rgba(102,126,234,0.3)',
    }
  },
  cardGlow: {
    position: 'absolute',
    top: '-50%',
    right: '-50%',
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle, rgba(102,126,234,0.05) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    position: 'relative',
    zIndex: 1,
  },
  typeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  typeIcon: {
    fontSize: '20px',
  },
  cardType: {
    fontWeight: '700',
    color: '#2d3436',
    fontSize: '14px',
    letterSpacing: '0.5px',
  },
  statusBadge: {
    padding: '4px 14px',
    borderRadius: '20px',
    color: 'white',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'capitalize',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardDescription: {
    margin: '0 0 12px 0',
    color: '#636e72',
    fontSize: '14px',
    lineHeight: '1.6',
    position: 'relative',
    zIndex: 1,
  },
  cardFooter: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    position: 'relative',
    zIndex: 1,
  },
  severityBadge: {
    padding: '2px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardLocation: {
    fontSize: '13px',
    color: '#636e72',
  },
  cardTime: {
    fontSize: '12px',
    color: '#b2bec3',
    marginLeft: 'auto',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#2d3436',
    fontWeight: '600',
    margin: '0 0 4px 0',
  },
  emptySubText: {
    fontSize: '14px',
    color: '#b2bec3',
    margin: 0,
  },
};

export default IncidentList;
