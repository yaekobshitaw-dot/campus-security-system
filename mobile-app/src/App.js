import { NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Provider, useSelector } from 'react-redux';
import AppNavigator from './navigation/AppNavigator';
import { startOfficerLocationUpdates } from './services/officerLocation';
import { store } from './store';

function AppContent() {
  const userRole = useSelector((state) => state.auth.user?.role);
  useEffect(() => {
    if (userRole !== 'security') return undefined;
    return startOfficerLocationUpdates();
  }, [userRole]);

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
