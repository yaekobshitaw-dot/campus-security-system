import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

let pushRegistrationWarningShown = false;

export const registerForPushNotifications = async () => {
  try {
    if (!pushRegistrationWarningShown) {
      console.info('Push notifications are currently unavailable because native Firebase/FCM is not configured for this React Native CLI Android app.');
      pushRegistrationWarningShown = true;
    }

    await AsyncStorage.removeItem('push_token');
    return null;
  } catch (error) {
    console.warn('Push notification registration unavailable:', error?.message || error);
    return null;
  }
};

export const clearPushToken = async () => {
  await AsyncStorage.removeItem('push_token');
};

export default { registerForPushNotifications, clearPushToken };
