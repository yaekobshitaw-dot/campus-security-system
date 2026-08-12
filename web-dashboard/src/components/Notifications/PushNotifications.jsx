// src/components/Notifications/PushNotifications.jsx
import React, { useState, useEffect } from 'react';

const PushNotifications = () => {
  const [permission, setPermission] = useState('default');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setIsEnabled(true);
        alert('✅ Notifications enabled!');
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  };

  const sendTestNotification = () => {
    if (permission === 'granted') {
      new Notification('🚨 Campus Security Alert', {
        body: 'This is a test notification from your Campus Security System!',
        icon: '/security-icon.png',
        tag: 'test-notification'
      });
    }
  };

  return (
    <div style={styles.container}>
      <h4>🔔 Push Notifications</h4>
      <div style={styles.status}>
        Status: <span style={{ color: permission === 'granted' ? '#4CAF50' : '#FF9800' }}>
          {permission === 'granted' ? '✅ Enabled' : permission === 'denied' ? '❌ Blocked' : '⏳ Not Requested'}
        </span>
      </div>
      {permission !== 'granted' && (
        <button onClick={requestPermission} style={styles.button}>Enable Notifications</button>
      )}
      {permission === 'granted' && (
        <button onClick={sendTestNotification} style={styles.button}>Send Test Notification</button>
      )}
      <div style={styles.info}>
        <p>📱 You will receive:</p>
        <ul>
          <li>🚨 Emergency alerts</li>
          <li>📋 Incident updates</li>
          <li>🔔 Safety reminders</li>
          <li>📍 Location-based alerts</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px' },
  status: { marginBottom: '15px', fontSize: '14px' },
  button: { backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' },
  info: { marginTop: '15px', fontSize: '13px', color: '#666' }
};

export default PushNotifications;
