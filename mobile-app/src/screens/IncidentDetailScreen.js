import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socketService } from '../services/socket';
import { updateIncident } from '../store/incidentSlice';

const labels = { reported: 'Reported', investigating: 'In Progress', resolved: 'Resolved', acknowledged: 'Acknowledged', dispatched: 'Dispatched', on_scene: 'On Scene', closed: 'Closed', cancelled: 'Cancelled' };

const IncidentDetailScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const initialIncident = route.params?.incident || { incident_id: route.params?.id };
  const [liveIncident, setLiveIncident] = useState(initialIncident);
  const storedIncident = useSelector((state) => state.incidents.incidents.find((item) => item.incident_id === initialIncident.incident_id));
  const incident = storedIncident || liveIncident;

  useEffect(() => {
    const handleIncidentUpdate = (updatedIncident) => {
      if (updatedIncident?.incident_id !== initialIncident.incident_id) return;
      dispatch(updateIncident(updatedIncident));
      setLiveIncident((current) => ({ ...current, ...updatedIncident }));
    };
    socketService.on('incident-updated', handleIncidentUpdate);
    return () => socketService.off('incident-updated', handleIncidentUpdate);
  }, [dispatch, initialIncident.incident_id]);

  return <View style={styles.container}><View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Icon name="arrow-back" size={22} color="#24343A" /></TouchableOpacity><Text style={styles.title}>Incident details</Text></View><View style={styles.card}><View style={styles.typeRow}><Icon name="assignment" size={25} color="#116B5F" /><Text style={styles.type}>{(incident.type || 'incident').replace('_', ' ')}</Text></View><View style={styles.status}><View style={[styles.dot, { backgroundColor: incident.status === 'resolved' ? '#2D8A61' : '#C17A24' }]} /><Text>{labels[incident.status] || 'Reported'}</Text></View><Text style={styles.label}>Incident ID</Text><Text style={styles.value}>{incident.incident_id || 'Unavailable'}</Text><Text style={styles.label}>Description</Text><Text style={styles.value}>{incident.description || 'No description provided'}</Text><Text style={styles.label}>Severity</Text><Text style={styles.value}>{incident.severity || 'medium'}</Text><Text style={styles.label}>Location</Text><Text style={styles.value}>{incident.location_name || incident.building || 'Location unavailable'}</Text><Text style={styles.label}>Reported</Text><Text style={styles.value}>{incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Unavailable'}</Text></View></View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8F7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 24, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#DCE9E5' },
  backButton: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  title: { color: '#24343A', fontSize: 23, fontWeight: '700' },
  card: { margin: 16, padding: 20, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE9E5', elevation: 2 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  type: { color: '#24343A', fontSize: 24, fontWeight: '700', textTransform: 'capitalize' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { marginTop: 22, color: '#8A9698', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  value: { marginTop: 5, color: '#304147', fontSize: 14, lineHeight: 20 },
});

export default IncidentDetailScreen;
