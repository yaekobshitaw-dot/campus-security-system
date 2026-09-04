import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, isHydrated } = useSelector((state) => state.auth);

  if (!isHydrated) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;