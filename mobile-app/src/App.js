import { NavigationContainer } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import AppNavigator from './navigation/AppNavigator';
import { setAuthInvalidationHandler } from './services/api';
import { startOfficerLocationUpdates } from './services/officerLocation';
import { getPendingSms, sendSmsResult } from './services/smsService';
import { store } from './store';
import { hydrateAuth, sessionExpired } from './store/authSlice';
import { socketService } from './services/socket';
import NotificationBanner from './components/NotificationBanner';
import { addRealtimeNotification } from './store/notificationSlice';

function AppContent() {
  const dispatch = useDispatch();
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isHydrated = useSelector((state) => state.auth.isHydrated);

  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

  useEffect(() => setAuthInvalidationHandler(() => dispatch(sessionExpired())), [dispatch]);

  const [banner, setBanner] = useState(null);

  useEffect(() => {
    // listen for realtime notifications and show a banner + add to store
    const handleNotification = (payload) => {
      try {
        dispatch(addRealtimeNotification(payload));
        setBanner({ title: payload.title || 'Notification', message: payload.message || (payload.data && payload.data.message) || '' });
        setTimeout(() => setBanner(null), 5000);
      } catch (err) {
        console.warn('Failed to handle realtime notification', err);
      }
    };

    socketService.on('notification-created', handleNotification);
    return () => socketService.off('notification-created', handleNotification);
  }, [dispatch]);

  useEffect(() => {
    if (userRole !== 'security') return undefined;
    return startOfficerLocationUpdates();
  }, [userRole]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let intervalId;
    const processPendingSms = async () => {
      try {
        const response = await getPendingSms();
        const pending = response?.data?.data || [];
        for (const item of pending) {
          const smsUrl = `sms:${item.recipient_phone}?body=${encodeURIComponent(item.message)}`;
          const result = await sendSmsResult(item.sms_id, 'sent');
          if (result?.success) {
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          if (typeof window !== 'undefined' && window.open) {
            window.open(smsUrl, '_self');
          }
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error('Pending SMS polling failed:', error.message || error);
        }
      }
    };

    processPendingSms();
    intervalId = setInterval(processPendingSms, 30000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      {banner && <NotificationBanner title={banner.title} message={banner.message} onClose={() => setBanner(null)} />}
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}
