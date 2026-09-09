import { NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { Provider, useDispatch, useSelector } from 'react-redux';
import AppNavigator from './navigation/AppNavigator';
import { setAuthInvalidationHandler } from './services/api';
import { startOfficerLocationUpdates } from './services/officerLocation';
import { getPendingSms, sendSmsResult } from './services/smsService';
import { store } from './store';
import { hydrateAuth, sessionExpired } from './store/authSlice';

function AppContent() {
  const dispatch = useDispatch();
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isHydrated = useSelector((state) => state.auth.isHydrated);

  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

  useEffect(() => setAuthInvalidationHandler(() => dispatch(sessionExpired())), [dispatch]);

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
