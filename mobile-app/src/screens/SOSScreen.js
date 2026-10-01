import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '../components/ui';
import AppText from '../components/AppText';
import api from '../services/api';
import { getFreshLocation, logLocationSubmission, openLocationSettings } from '../services/location';
import { addIncident } from '../store/incidentSlice';
import { useMobileTranslation } from '../utils/translations';
import { useMobileTheme } from '../utils/settingsAppearance';

const Text = AppText;

const SOSScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const confirmSOS = useSelector((state) => state.settings.preferences.confirmSOS);
  const t = useMobileTranslation();
  const { colors } = useMobileTheme();
  const [sending, setSending] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  const sendSOS = async () => {
    if (sending) return;

    try {
      setSending(true);
      setLocationStatus(t('Getting current location...'));
      let location;
      try {
        location = await getFreshLocation();
      } catch (locationError) {
        setLocationStatus('');
        Alert.alert(
          t('Current location required'),
          t(locationError?.message || 'Unable to get your current location. Please enable GPS/Location and try again.'),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Retry'),
              onPress: sendSOS,
            },
            {
              text: t('Open Settings'),
              onPress: () => {
                openLocationSettings(locationError?.code).catch(() => {
                  Alert.alert(t('Settings unavailable'), t('Please enable Location/GPS in your device settings and try again.'));
                });
              },
            },
          ]
        );
        return;
      }
      setLocationStatus(t('Location captured'));
      await submitSOS(location);
    } catch (error) {
      Alert.alert(t('SOS failed'), t('The SOS could not be sent. Please try again or call campus security directly.'));
    } finally {
      setSending(false);
      setLocationStatus('');
    }
  };

  const submitSOS = async (location) => {
    logLocationSubmission('SOS', location);
    const response = await api.post('/incidents/sos', {
      latitude: location.latitude,
      longitude: location.longitude,
      location_accuracy: location.accuracy,
      location_timestamp: location.timestamp === null ? null : new Date(location.timestamp).toISOString(),
    }, { timeout: 30000 });

    if (!response?.data?.success) {
      throw new Error(response?.data?.message || 'The SOS could not be sent.');
    }

    const incident = response.data.data;
    dispatch(addIncident(incident));
    Alert.alert(t('SOS Alert Sent'), t('Security has been notified.'), [{ text: t('OK'), onPress: () => navigation.navigate('Home') }]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel={t('Go back')}><Icon name="arrow-back" size={22} color={colors.text} /><Text style={styles.backText}>{t('Back')}</Text></TouchableOpacity>
      <View style={styles.content}><View style={styles.icon}><Icon name="emergency" size={48} color="#FFF" /></View><Text style={styles.title}>{t('Send an SOS')}</Text><Text style={styles.description}>{t('This sends a critical incident report to campus security. Your current location will be attached when permission is available.')}</Text><TouchableOpacity style={[styles.button, sending && styles.disabled]} onPress={() => {
        if (confirmSOS) {
          Alert.alert(t('Send SOS?'), t('Only use this for a genuine emergency. Campus security will be notified immediately.'), [{ text: t('Cancel'), style: 'cancel' }, { text: t('Send SOS'), style: 'destructive', onPress: sendSOS }]);
        } else {
          sendSOS();
        }
      }} disabled={sending} accessibilityRole="button" accessibilityLabel={t('Send emergency SOS')}>{sending ? <ActivityIndicator color="#FFF" /> : <><Icon name="emergency" size={22} color="#FFF" /><Text style={styles.buttonText}>{t('Send emergency SOS')}</Text></>}</TouchableOpacity>{locationStatus ? <Text accessibilityLiveRegion="polite" style={styles.locationStatus}>{t(locationStatus)}</Text> : null}<Text style={styles.note}>{t('If you are in immediate danger, also contact your local emergency service.')}</Text></View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 18, paddingTop: 18 },
  backText: { color: '#24343A', fontSize: 14, fontWeight: '700' },
  content: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 28 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 94, height: 94, marginBottom: 24, borderRadius: 47, backgroundColor: '#D64545', elevation: 5 },
  title: { color: '#24343A', fontSize: 29, fontWeight: '700' },
  description: { maxWidth: 340, marginTop: 12, marginBottom: 28, color: '#657278', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', maxWidth: 340, minHeight: 54, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#D64545', elevation: 3 },
  disabled: { opacity: .6 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  locationStatus: { marginTop: 8, color: '#657278', fontSize: 13 },
  note: { maxWidth: 300, marginTop: 20, color: '#9A7770', fontSize: 12, textAlign: 'center' },
});

export default SOSScreen;
