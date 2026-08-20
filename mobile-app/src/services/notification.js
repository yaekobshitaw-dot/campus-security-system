import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const getProjectId = () => Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

export const registerForPushNotifications = async () => {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Campus Security alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let permission = existing.status;
    if (permission !== 'granted') {
      permission = (await Notifications.requestPermissionsAsync()).status;
    }
    if (permission !== 'granted') return null;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
    const token = tokenResponse.data;
    if (!token) return null;

    await AsyncStorage.setItem('expo_push_token', token);
    await api.put('/users/push-token', { push_token: token });
    return token;
  } catch (error) {
    // Push registration is optional; login and incident reporting must still work.
    console.warn('Push notification registration unavailable:', error.message);
    return null;
  }
};

export const clearPushToken = async () => {
  await AsyncStorage.removeItem('expo_push_token');
};

export default { registerForPushNotifications, clearPushToken };
