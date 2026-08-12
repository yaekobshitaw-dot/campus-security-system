// src/components/NotificationSystem.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [latestAlert, setLatestAlert] = useState(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await api.get('/incidents');
      const incidents = response.data.data || [];

      const newNotifications = incidents.slice(0, 5).map(inc => ({
        id: inc.incident_id,
        message: '🚨 ' + inc.type.toUpperCase() + ' incident reported',
        severity: inc.severity || 'medium',
        timestamp: new Date(inc.created_at),
        location: inc.location_name || 'Campus'
      }));

      const oldIds = notifications.map(n => n.id);
      const newItems = newNotifications.filter(n => !oldIds.includes(n.id));

      if (newItems.length > 0) {
        const latest = newItems[0];
        setLatestAlert({
          message: latest.message + ' at ' + latest.location,
          severity: latest.severity
        });
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 5000);
      }

      setNotifications(newNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
      critical: '#9C27B0'
    };
    return colors[severity] || '#999';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
      critical: '🟣'
    };
    return icons[severity] || '🔵';
  };

  return (
    <>
      {showAlert && latestAlert && (
        <div style={{...styles.floatingAlert, animation: 'slideIn 0.5s ease'}}>
          <div style={{ ...styles.alertContent, borderLeftColor: getSeverityColor(latestAlert.severity) }}>
            <div style={styles.alertHeader}>
              <span style={styles.alertIcon}>🚨</span>
              <span style={styles.alertTitle}>New Incident</span>
              <button onClick={() => setShowAlert(false)} style={styles.closeBtn}>✕</button>
            </div>
            <p style={styles.alertMessage}>{latestAlert.message}</p>
          </div>
        </div>
      )}

      <div style={styles.container}>
        <div style={styles.header}>
          <h4>🔔 Notifications</h4>
          <span style={styles.count}>{notifications.length}</span>
        </div>
        {notifications.length === 0 ? (
          <p style={styles.noAlerts}>No notifications</p>
        ) : (
          notifications.map((notif) => (
            <div key={notif.id} style={styles.notifItem}>
              <span style={styles.icon}>{getSeverityIcon(notif.severity)}</span>
              <div style={styles.notifContent}>
                <span style={styles.notifMessage}>{notif.message}</span>
                <span style={styles.notifLocation}>📍 {notif.location}</span>
              </div>
              <span style={styles.notifTime}>
                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginTop: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  count: {
    backgroundColor: '#2196F3',
    color: 'white',
    borderRadius: '50%',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  noAlerts: {
    color: '#999',
    textAlign: 'center',
    padding: '20px',
    margin: 0
  },
  notifItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    borderBottom: '1px solid #f0f0f0',
    gap: '10px'
  },
  icon: {
    fontSize: '20px'
  },
  notifContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  notifMessage: {
    fontSize: '14px',
    color: '#333'
  },
  notifLocation: {
    fontSize: '12px',
    color: '#999'
  },
  notifTime: {
    fontSize: '12px',
    color: '#999',
    whiteSpace: 'nowrap'
  },
  floatingAlert: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 1000
  },
  alertContent: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    borderLeft: '4px solid #F44336',
    minWidth: '300px'
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  alertIcon: {
    fontSize: '24px'
  },
  alertTitle: {
    fontWeight: 'bold',
    fontSize: '16px',
    flex: 1
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#999'
  },
  alertMessage: {
    margin: 0,
    color: '#666'
  }
};

export default NotificationSystem;
