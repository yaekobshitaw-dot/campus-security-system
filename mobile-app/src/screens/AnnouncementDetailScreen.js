import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import { getPriorityStyle } from '../components/AnnouncementCard';
import { colors } from '../components/ui';
import { fetchAnnouncementRequest } from '../services/announcementService';
import { markAnnouncementAsRead } from '../store/announcementSlice';
import { getAnnouncementDetailFields } from '../utils/announcement';

const AnnouncementDetailScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const announcementId = route.params?.announcementId;
  const [announcement, setAnnouncement] = useState(route.params?.announcement || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const readRequestSent = useRef(false);

  const loadAnnouncement = async () => {
    if (!announcementId) {
      setLoading(false);
      setError('Announcement not found.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetchAnnouncementRequest(announcementId);
      const data = response.data?.data;
      setAnnouncement(data);
      if (data && !data.is_read && !readRequestSent.current) {
        readRequestSent.current = true;
        await dispatch(markAnnouncementAsRead(announcementId));
        setAnnouncement((current) => current ? { ...current, is_read: true } : current);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load announcement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncement();
  }, [announcementId]);

  const fields = getAnnouncementDetailFields(announcement || {});
  const priority = getPriorityStyle(fields.priority);

  return <View style={styles.container}><View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Icon name="arrow-back" size={22} color={colors.ink} /></TouchableOpacity><Text style={styles.headerTitle}>Announcement</Text></View>{loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.teal} /><Text style={styles.helper}>Loading announcement...</Text></View> : error ? <View style={styles.center}><Icon name="error-outline" size={52} color={colors.danger} /><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={loadAnnouncement}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.card}><View style={styles.topRow}><View style={[styles.priority, { backgroundColor: priority.background }]}><Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text></View><Text style={[styles.readState, fields.isRead ? styles.read : styles.unread]}>{fields.isRead ? 'Read' : 'Unread'}</Text></View><Text style={styles.title}>{fields.title}</Text><Text style={styles.published}>Published {fields.publishedAt ? new Date(fields.publishedAt).toLocaleString() : 'recently'}</Text><Text style={styles.contentText}>{fields.content}</Text>{fields.expiresAt && <Text style={styles.expiry}>Expires {new Date(fields.expiresAt).toLocaleString()}</Text>}</View></ScrollView>}</View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 24, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  backButton: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  headerTitle: { marginLeft: 8, color: colors.ink, fontSize: 22, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 30 },
  card: { padding: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, elevation: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priority: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  readState: { fontSize: 12, fontWeight: '800' },
  read: { color: colors.muted },
  unread: { color: colors.teal },
  title: { marginTop: 20, color: colors.ink, fontSize: 26, fontWeight: '700', lineHeight: 33 },
  published: { marginTop: 10, color: colors.muted, fontSize: 12 },
  contentText: { marginTop: 24, color: '#657276', fontSize: 16, lineHeight: 25 },
  expiry: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line, color: colors.muted, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  helper: { marginTop: 10, color: colors.muted, fontSize: 14 },
  error: { maxWidth: 300, marginTop: 14, color: colors.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minWidth: 100, marginTop: 18, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.teal },
  retryText: { color: colors.surface, fontWeight: '700', textAlign: 'center' },
});

export default AnnouncementDetailScreen;
