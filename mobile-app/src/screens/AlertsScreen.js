import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCard } from '../components/AlertCard';
import { colors } from '../components/ui';
import { fetchAlerts, markAlertAsRead, markAllAlertsAsRead } from '../store/alertSlice';

const AlertsScreen = () => {
  const [refreshing, setRefreshing] = useState(false);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { alerts, loading } = useSelector(state => state.alerts);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    await dispatch(fetchAlerts());
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleAlertPress = (alert) => {
    if (!alert.is_read) {
      dispatch(markAlertAsRead(alert.alert_id));
    }
  };

  const renderAlert = ({ item }) => (
    <AlertCard alert={item} onPress={() => { handleAlertPress(item); navigation.navigate('AlertDetail', { alert: item }); }} />
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <TouchableOpacity style={styles.markAllButton} onPress={() => dispatch(markAllAlertsAsRead())}>
          <Icon name="done-all" size={18} color={colors.teal} />
          <Text style={styles.markAllRead}>Mark All Read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={alerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.alert_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="notifications-off" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No Alerts</Text>
            <Text style={styles.emptySubText}>You're all caught up!</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.ink,
  },
  markAllRead: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '500',
  },
  markAllButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8 },
  listContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    color: '#999',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 16,
    color: '#CCC',
    marginTop: 8,
  },
});

export default AlertsScreen;