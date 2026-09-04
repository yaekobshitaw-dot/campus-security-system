// web-dashboard/src/pages/Dashboard.js
import {
  Alert,
  Box,
  Grid,
  LinearProgress,
  Paper,
  Snackbar,
  Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { AnalyticsCharts } from '../components/dashboard/AnalyticsCharts';
import { IncidentList } from '../components/dashboard/IncidentList';
import { IncidentMap } from '../components/dashboard/IncidentMap.jsx';
import { StatsCards } from '../components/dashboard/StatsCards';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { webSocket } from '../services/socket';
import { addIncident, fetchIncidents, fetchStats, updateIncident } from '../store/incidentSlice';

export const Dashboard = () => {
  const dispatch = useDispatch();
  const { incidents, stats, loading } = useSelector(state => state.incidents);
  const [socketConnected, setSocketConnected] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadDashboardData();
    setupSocketListeners();

    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    return () => {
      webSocket.off('new-incident');
      webSocket.off('incident-updated');
      webSocket.off('connected');
      webSocket.off('disconnected');
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      await dispatch(fetchIncidents({ status: 'active', limit: 20 }));
      await dispatch(fetchStats());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const setupSocketListeners = () => {
    webSocket.on('connected', () => {
      setSocketConnected(true);
      toast.success('Connected to real-time updates');
    });

    webSocket.on('disconnected', () => {
      setSocketConnected(false);
      toast.error('Disconnected from real-time updates');
    });

    webSocket.on('new-incident', (incident) => {
      dispatch(addIncident(incident));

      // Show notification
      showNotification('New Incident Reported', {
        message: `${incident.type.toUpperCase()} - ${incident.location_name || 'Campus'}`,
        severity: incident.severity
      });

      // Play sound for critical incidents
      if (incident.severity === 'critical') {
        playAlertSound();
      }
    });

    webSocket.on('incident-updated', (data) => {
      dispatch(updateIncident(data));
    });
  };

  const showNotification = (title, data) => {
    setNotification({
      title,
      message: data.message,
      severity: data.severity === 'critical' ? 'error' :
        data.severity === 'high' ? 'warning' : 'info'
    });

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: data.message,
        icon: '/security-icon-128.png',
        silent: data.severity !== 'critical',
        tag: 'incident-alert'
      });
    }

    // Toast notification
    const toastFn = data.severity === 'critical' ? toast.error :
      data.severity === 'high' ? toast.warning : toast.info;
    toastFn(`${title}: ${data.message}`, {
      duration: 10000,
      icon: '🚨'
    });
  };

  const playAlertSound = () => {
    try {
      const audio = new Audio('/alert.mp3');
      audio.play().catch(() => { });
    } catch (error) {
      console.log('Could not play alert sound');
    }
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ width: '100%', mt: 4 }}>
          <LinearProgress />
          <Typography sx={{ mt: 2, textAlign: 'center' }}>Loading dashboard...</Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Connection Status */}
      <Box sx={{ mb: 3 }}>
        <Alert
          severity={socketConnected ? 'success' : 'warning'}
          variant="outlined"
          icon={socketConnected ? '✅' : '⚠️'}
        >
          {socketConnected
            ? '🟢 Live connection active - receiving real-time updates'
            : '🔴 Connection lost - showing cached data'}
        </Alert>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <StatsCards stats={stats} />
      </Grid>

      {/* Map and Incidents */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 2,
              height: 500,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Live Incident Map
              {stats?.total > 0 && (
                <Typography component="span" variant="caption" sx={{ ml: 2, color: '#666' }}>
                  ({stats.total} active incidents)
                </Typography>
              )}
            </Typography>
            <IncidentMap
              incidents={incidents || []}
              height={400}
              showResponders={true}
              center={[9.0227, 38.7468]} // Campus center
              zoom={15}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 500, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Active Incidents
              <Typography component="span" variant="caption" sx={{ ml: 2, color: '#666' }}>
                ({incidents?.filter(i => i.status !== 'resolved').length || 0})
              </Typography>
            </Typography>
            <IncidentList
              incidents={incidents?.filter(i => i.status !== 'resolved') || []}
              onIncidentClick={(incident) => {
                // Navigate to incident detail
              }}
            />
            {(!incidents || incidents.filter(i => i.status !== 'resolved').length === 0) && (
              <Box sx={{ textAlign: 'center', mt: 4, color: '#999' }}>
                <Typography variant="body1">No active incidents</Typography>
                <Typography variant="caption">Campus is safe</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Analytics Charts */}
      <Box sx={{ mt: 3 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Incident Analytics
          </Typography>
          <AnalyticsCharts stats={stats} />
        </Paper>
      </Box>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification?.severity || 'info'}
          variant="filled"
          sx={{ minWidth: 300 }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {notification?.title}
          </Typography>
          <Typography variant="body2">
            {notification?.message}
          </Typography>
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
};

export default Dashboard;