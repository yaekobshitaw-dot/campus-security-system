// src/components/NotificationSystem.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import * as socketService from '../services/socket';

// Support both default and named export shapes so tests that mock the module either way still work.
const webSocket = socketService.webSocket || socketService.default || socketService;

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [latestAlert, setLatestAlert] = useState(null);

  useEffect(() => {
    loadNotifications();
    // also subscribe for realtime notifications
    if (webSocket && typeof webSocket.on === 'function') webSocket.on('notification-created', handleRealtimeNotification);
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      if (webSocket && typeof webSocket.off === 'function') webSocket.off('notification-created', handleRealtimeNotification);
      clearInterval(interval);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await api.get('/notifications');
      const items = response.data.data || [];

      const mapped = items.map((n) => ({
        id: n.notification_id,
        title: n.title,
        message: n.message,
        severity: (n.data && n.data.severity) || 'medium',
        timestamp: n.created_at ? new Date(n.created_at) : new Date(),
        location: (n.data && n.data.location) || (n.data && n.data.location_name) || 'Campus',
        is_read: Boolean(n.is_read),
        raw: n,
      }));

      setNotifications(mapped);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleRealtimeNotification = (payload) => {
    try {
      const n = payload;
      const mapped = {
        id: n.notification_id || n.notificationId || n.id,
        title: n.title || 'Notification',
        message: n.message || (n.data && n.data.message) || 'You have a notification',
        severity: (n.data && n.data.severity) || 'medium',
        timestamp: n.created_at ? new Date(n.created_at) : new Date(),
        location: (n.data && n.data.location) || 'Campus',
        is_read: Boolean(n.is_read),
        raw: n,
      };

      // prepend and show transient alert
      setNotifications((prev) => [mapped, ...prev].slice(0, 100));
      setLatestAlert({ message: mapped.message + ' at ' + mapped.location, severity: mapped.severity });
      setShowAlert(true);
      setTimeout(() => setShowAlert(false), 5000);
    } catch (err) {
      console.warn('Failed to process realtime notification', err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (error) {
      console.error('Failed to mark notification read', error);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications read', error);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={markAllRead} style={{ cursor: 'pointer' }}>Mark all read</button>
            <span style={styles.count}>{notifications.filter((n) => !n.is_read).length}</span>
          </div>
        </div>
        {notifications.length === 0 ? (
          <p style={styles.noAlerts}>No notifications</p>
        ) : (
          notifications.map((notif) => (
            <div key={notif.id} style={{ ...styles.notifItem, backgroundColor: notif.is_read ? 'white' : '#f9fefb' }}>
              <span style={styles.icon}>{getSeverityIcon(notif.severity)}</span>
              <div style={styles.notifContent}>
                <span style={styles.notifMessage}>{notif.title || notif.message}</span>
                <span style={styles.notifLocation}>📍 {notif.location}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={styles.notifTime}>
                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {!notif.is_read && (
                  <button onClick={() => markAsRead(notif.id)} style={{ cursor: 'pointer', fontSize: 12 }}>Mark read</button>
                )}
              </div>
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
