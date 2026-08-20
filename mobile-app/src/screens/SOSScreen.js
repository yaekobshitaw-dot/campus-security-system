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
      let location = null;
      try {
        location = await getLocation();
      } catch (locationError) {
        Alert.alert('Location unavailable', `${locationError.message} You can still send the SOS.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => setSending(false) },
          { text: 'Send without location', style: 'destructive', onPress: () => submitSOS(null).catch((error) => { setSending(false); Alert.alert('SOS failed', error.response?.data?.message || 'The SOS could not be sent.'); }) },
        ]);
        return;
      }
      await submitSOS(location);
    } catch (error) {
      setSending(false);
      Alert.alert('SOS failed', error.response?.data?.message || 'The SOS could not be sent. Please call campus security directly.');
    }
  };

  const submitSOS = async (location) => {
    const response = await api.post('/incidents', {
      type: 'security_threat',
      severity: 'critical',
      description: 'SOS emergency alert sent from the Campus Security mobile app.',
      is_sos: true,
      location_name: location ? 'Current device location' : '',
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    });
    dispatch(addIncident(response.data.data));
    setSending(false);
    Alert.alert('SOS sent', 'Campus security has been notified.', [{ text: 'OK', onPress: () => navigation.navigate('Home') }]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color="#24343A" /><Text>Back</Text></TouchableOpacity>
      <View style={styles.content}><View style={styles.icon}><Icon name="warning" size={48} color="#FFF" /></View><Text style={styles.title}>Send an SOS</Text><Text style={styles.description}>This sends a critical incident report to campus security. Your current location will be attached when permission is available.</Text><TouchableOpacity style={[styles.button, sending && styles.disabled]} onPress={() => Alert.alert('Send SOS?', 'Only use this for a genuine emergency. Campus security will be notified immediately.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Send SOS', style: 'destructive', onPress: sendSOS }])} disabled={sending}>{sending ? <ActivityIndicator color="#FFF" /> : <><Icon name="sos" size={22} color="#FFF" /><Text style={styles.buttonText}>Send emergency SOS</Text></>}</TouchableOpacity><Text style={styles.note}>If you are in immediate danger, also contact your local emergency service.</Text></View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F5' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 18, paddingTop: 24 },
  content: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 28 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 94, height: 94, marginBottom: 24, borderRadius: 47, backgroundColor: '#D9533F' },
  title: { color: '#24343A', fontSize: 29, fontWeight: '700' },
  description: { maxWidth: 340, marginTop: 12, marginBottom: 28, color: '#657278', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', maxWidth: 340, padding: 16, borderRadius: 9, backgroundColor: '#D9533F' },
  disabled: { opacity: .6 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  note: { maxWidth: 300, marginTop: 20, color: '#9A7770', fontSize: 12, textAlign: 'center' },
});

export default SOSScreen;
