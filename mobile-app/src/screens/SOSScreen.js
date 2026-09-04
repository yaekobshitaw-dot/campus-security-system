import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import api from '../services/api';
import { getLocation } from '../services/location';
import { addIncident } from '../store/incidentSlice';

const SOSScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [sending, setSending] = useState(false);

  const sendSOS = async () => {
    if (sending) return;

    try {
      setSending(true);
      const location = await getLocation();
      await submitSOS(location);
    } catch (error) {
      setSending(false);
      Alert.alert('SOS failed', error?.message || 'The SOS could not be sent. Please call campus security directly.');
    }
  };

  const submitSOS = async (location) => {
    try {
      const response = await api.post('/incidents/sos', {
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      }, { timeout: 30000 });

      if (!response?.data?.success) {
        throw new Error(response?.data?.message || 'The SOS could not be sent.');
      }

      const incident = response.data.data;
      dispatch(addIncident(incident));
      Alert.alert('SOS Alert Sent', 'Security has been notified.', [{ text: 'OK', onPress: () => navigation.navigate('Home') }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Icon name="arrow-back" size={22} color="#24343A" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
      <View style={styles.content}><View style={styles.icon}><Icon name="emergency" size={48} color="#FFF" /></View><Text style={styles.title}>Send an SOS</Text><Text style={styles.description}>This sends a critical incident report to campus security. Your current location will be attached when permission is available.</Text><TouchableOpacity style={[styles.button, sending && styles.disabled]} onPress={() => Alert.alert('Send SOS?', 'Only use this for a genuine emergency. Campus security will be notified immediately.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Send SOS', style: 'destructive', onPress: sendSOS }])} disabled={sending}>{sending ? <ActivityIndicator color="#FFF" /> : <><Icon name="emergency" size={22} color="#FFF" /><Text style={styles.buttonText}>Send emergency SOS</Text></>}</TouchableOpacity><Text style={styles.note}>If you are in immediate danger, also contact your local emergency service.</Text></View>
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
  note: { maxWidth: 300, marginTop: 20, color: '#9A7770', fontSize: 12, textAlign: 'center' },
});

export default SOSScreen;
