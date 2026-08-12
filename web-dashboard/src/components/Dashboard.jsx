// src/components/Dashboard.jsx - Complete with Register and Report
import React, { useState, useEffect } from 'react';
import incidentService from '../services/incidentService';
import AnalyticsCharts from './Analytics/AnalyticsCharts';
import ExportReports from './Analytics/ExportReports';
import SafetyChatbot from './Chatbot/SafetyChatbot';
import PushNotifications from './Notifications/PushNotifications';
import Footer from './Footer';
import Register from './Register';
import ReportIncident from './ReportIncident';

function Dashboard({ user, onLogout }) {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
      const [incidentsData, statsData] = await Promise.all([
        incidentService.getAll(),
        incidentService.getStats()
      ]);
      setIncidents(incidentsData.data || []);
      setStats(statsData.data || { total: 0, active: 0, resolved: 0 });
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading dashboard...</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>🏫 Campus Security</h1>
            <span style={styles.emergencyBadge}>🚨 EMERGENCY</span>
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>
              <span style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div style={styles.userDetails}>
              <span style={styles.userName}>{user?.name}</span>
              <span style={styles.userRole}>{user?.role}</span>
            </div>
            <button onClick={() => setShowRegister(true)} style={styles.registerBtn}>
              👤 Register
            </button>
            <button onClick={() => setShowReport(true)} style={styles.reportBtn}>
              ➕ Report
            </button>
            <button onClick={onLogout} style={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div style={styles.content}>
        {error && (
          <div style={styles.error}>
            <span>⚠️</span>
            <p>{error}</p>
            <button onClick={loadData} style={styles.retryBtn}>Retry</button>
          </div>
        )}

        <div style={styles.stats}>
          <div style={styles.statCard}>
            <h3>📊 Total Incidents</h3>
            <p>{stats.total || 0}</p>
          </div>
          <div style={styles.statCard}>
            <h3>🔥 Active Incidents</h3>
            <p>{stats.active || 0}</p>
          </div>
          <div style={styles.statCard}>
            <h3>✅ Resolved</h3>
            <p>{stats.resolved || 0}</p>
          </div>
        </div>

        <AnalyticsCharts incidents={incidents} />
        <ExportReports incidents={incidents} />
        <PushNotifications />

        <div style={styles.incidentList}>
          <h2>📋 Incidents ({incidents.length})</h2>
          {incidents.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyIcon}>📭</p>
              <p>No incidents found</p>
              <p style={styles.emptySubText}>Click "Report Incident" to get started</p>
            </div>
          ) : (
            incidents.map(incident => (
              <div key={incident.incident_id} style={styles.incidentCard}>
                <div style={styles.incidentHeader}>
                  <strong>{incident.type.toUpperCase()}</strong>
                  <span style={styles.statusBadge}>{incident.status}</span>
                </div>
                <p>{incident.description || 'No description'}</p>
                <div style={styles.incidentFooter}>
                  <span style={styles.severityBadge}>{incident.severity}</span>
                  <span>📍 {incident.location_name || 'Unknown'}</span>
                  <span>🕐 {new Date(incident.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Register Modal */}
      {showRegister && (
        <div style={styles.modalOverlay} onClick={() => setShowRegister(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <Register onSwitchToLogin={() => setShowRegister(false)} />
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div style={styles.modalOverlay} onClick={() => setShowReport(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <ReportIncident 
              onClose={() => setShowReport(false)}
              onSuccess={loadData}
            />
          </div>
        </div>
      )}

      <Footer />
      <SafetyChatbot />
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
