import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import api from './api';

export const getPendingSms = async () => {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) return { data: { data: [] } };
  return api.get('/sms/pending');
};

export const sendSmsResult = async (smsId, status, message = '') => {
  try {
    const response = await api.patch(`/sms/${smsId}/result`, { status, message });
    return response.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || 'Failed to update SMS status.' };
  }
};

export const openNativeSmsComposer = async ({ phone, message }) => {
  const normalizedPhone = String(phone || '').replace(/\s+/g, '');
  if (!normalizedPhone) {
    Alert.alert('SMS unavailable', 'This user does not have a valid phone number on file.');
    return false;
  }

  const encodedMessage = encodeURIComponent(String(message || '')).replace(/%20/g, ' ');
  const smsUrl = `sms:${normalizedPhone}?body=${encodedMessage}`;

  const canOpen = await Linking.canOpenURL(smsUrl);
  if (!canOpen) {
    Alert.alert('SMS unavailable', 'This device cannot open the system SMS app.');
    return false;
  }

  await Linking.openURL(smsUrl);
  return true;
};
