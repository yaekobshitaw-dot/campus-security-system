import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { AnnouncementCard } from '../components/AnnouncementCard';
import { colors } from '../components/ui';
import { fetchAnnouncements } from '../store/announcementSlice';

const AnnouncementsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { announcements, unreadCount, loading, error } = useSelector((state) => state.announcements);
  const { user } = useSelector((state) => state.auth);
  const canViewAnnouncements = ['student', 'faculty', 'staff', 'security'].includes(user?.role);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (canViewAnnouncements) dispatch(fetchAnnouncements());
  }, [canViewAnnouncements, dispatch]);

  const refresh = async () => {
    setRefreshing(true);
    await dispatch(fetchAnnouncements());
    setRefreshing(false);
  };

  if (!canViewAnnouncements) {
    return <View style={styles.center}><Icon name="campaign" size={58} color="#B7C5C2" /><Text style={styles.emptyTitle}>Announcements unavailable</Text><Text style={styles.helper}>This mobile view is available to campus members and security staff.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.title}>Announcements</Text><Text style={styles.subtitle}>{unreadCount} unread</Text></View>
        <TouchableOpacity style={styles.refreshButton} onPress={refresh} accessibilityRole="button" accessibilityLabel="Refresh announcements"><Icon name="refresh" size={22} color={colors.teal} /></TouchableOpacity>
      </View>
      {loading && !refreshing ? <View style={styles.center}><ActivityIndicator size="large" color={colors.teal} /><Text style={styles.helper}>Loading announcements...</Text></View> : error && !announcements.length ? <View style={styles.center}><Icon name="error-outline" size={52} color={colors.danger} /><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={refresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : <FlatList
        data={announcements}
        keyExtractor={(item) => item.announcement_id}
        renderItem={({ item }) => <AnnouncementCard announcement={item} onPress={() => navigation.navigate('AnnouncementDetail', { announcementId: item.announcement_id })} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal} />}
        contentContainerStyle={announcements.length ? styles.list : styles.emptyList}
        ListEmptyComponent={<View style={styles.center}><Icon name="campaign" size={58} color="#B7C5C2" /><Text style={styles.emptyTitle}>No announcements</Text><Text style={styles.helper}>You are all caught up.</Text></View>}
        ListHeaderComponent={error ? <Text style={styles.inlineError} accessibilityRole="alert">{error}</Text> : null}
        showsVerticalScrollIndicator={false}
      />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 12 },
  refreshButton: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, backgroundColor: colors.tealSoft },
  list: { padding: 16, paddingBottom: 30 },
  emptyList: { flexGrow: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  helper: { marginTop: 10, color: colors.muted, fontSize: 14, textAlign: 'center' },
  emptyTitle: { marginTop: 16, color: colors.ink, fontSize: 20, fontWeight: '700' },
  error: { maxWidth: 300, marginTop: 14, color: colors.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  inlineError: { marginBottom: 12, color: colors.danger, fontSize: 13 },
  retryButton: { minWidth: 100, marginTop: 18, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.teal },
  retryText: { color: colors.surface, fontWeight: '700', textAlign: 'center' },
});

export default AnnouncementsScreen;
