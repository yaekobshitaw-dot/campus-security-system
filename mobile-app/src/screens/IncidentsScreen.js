import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchIncidents } from '../store/incidentSlice';

const statusLabel = (status) => ({ reported: 'Reported', investigating: 'Investigating', resolved: 'Resolved', acknowledged: 'Acknowledged', dispatched: 'Officer assigned', on_scene: 'On scene', closed: 'Closed', cancelled: 'Cancelled' }[status] || 'Reported');
const statusColor = (status) => status === 'resolved' || status === 'closed' ? '#2D8A61' : status === 'investigating' || status === 'dispatched' || status === 'on_scene' ? '#8A5B9C' : '#C17A24';

const IncidentsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { incidents, loading, error } = useSelector((state) => state.incidents);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => { setRefreshing(true); await dispatch(fetchIncidents()); setRefreshing(false); }, [dispatch]);
  useEffect(() => { refresh(); }, [refresh]);
  if (loading && !refreshing && !incidents.length) return <View style={styles.center}><ActivityIndicator size="large" color="#156B5D" /><Text style={styles.muted}>Loading your incidents...</Text></View>;
  return <View style={styles.container}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color="#24343A" /></TouchableOpacity><Text style={styles.title}>My incidents</Text></View>{error && <View style={styles.error}><Text>{error}</Text><TouchableOpacity onPress={refresh}><Text style={styles.retry}>Retry</Text></TouchableOpacity></View>}<FlatList data={incidents} keyExtractor={(item) => item.incident_id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={incidents.length ? styles.list : styles.emptyList} ListEmptyComponent={<View style={styles.center}><Icon name="assignment-turned-in" size={50} color="#55A47C" /><Text style={styles.emptyTitle}>No submitted incidents</Text><Text style={styles.muted}>Reports you submit will appear here.</Text></View>} renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('IncidentDetail', { incident: item })}><View style={styles.cardTop}><Text style={styles.type}>{(item.type || 'incident').replace('_', ' ')}</Text><Text style={[styles.status, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text></View><Text style={styles.description} numberOfLines={2}>{item.description || 'No description provided'}</Text><View style={styles.meta}><Text style={styles.severity}>{item.severity || 'medium'}</Text><Text style={styles.location}><Icon name="location-on" size={14} color="#708083" /> {item.location_name || item.building || 'Location unavailable'}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text></View><Text style={styles.id}>ID: {item.incident_id}</Text></TouchableOpacity>} /></View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F8F7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, paddingTop: 24, backgroundColor: '#FFF' },
  title: { color: '#24343A', fontSize: 23, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 30 },
  emptyList: { flexGrow: 1, padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  muted: { marginTop: 9, color: '#748184', fontSize: 13 },
  emptyTitle: { marginTop: 14, color: '#24343A', fontSize: 17, fontWeight: '700' },
  card: { marginBottom: 11, padding: 15, borderRadius: 10, backgroundColor: '#FFF', elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  type: { color: '#24343A', fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  status: { fontSize: 12, fontWeight: '700' },
  description: { marginTop: 8, color: '#657276', fontSize: 13, lineHeight: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 12 },
  severity: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, color: '#8B5B24', backgroundColor: '#FFF0D2', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  location: { color: '#708083', fontSize: 11 },
  date: { color: '#8B9799', fontSize: 11 },
  id: { marginTop: 11, color: '#A1AAAC', fontSize: 10 },
  error: { flexDirection: 'row', justifyContent: 'space-between', margin: 16, padding: 12, borderRadius: 7, backgroundColor: '#FFF0EB' },
  retry: { color: '#B84F3C', fontWeight: '700' },
});

export default IncidentsScreen;
