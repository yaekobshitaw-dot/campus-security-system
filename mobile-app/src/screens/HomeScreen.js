// mobile-app/src/screens/HomeScreen.js
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { AlertCard } from '../components/AlertCard';
import { IncidentCard } from '../components/IncidentCard';
import { SOSButton } from '../components/SOSButton';
import { socketService } from '../services/socket';
import { addAlert, fetchAlerts } from '../store/alertSlice';
import { fetchRecentIncidents, updateIncident } from '../store/incidentSlice';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSelector(state => state.auth);
  const { recentIncidents, loading: incidentsLoading } = useSelector(
    state => state.incidents
  );
  const { alerts, unreadCount } = useSelector(state => state.alerts);

  useEffect(() => {
    loadInitialData();
    setupSocketListeners();

    return () => {
      socketService.off('new-incident');
      socketService.off('incident-updated');
      socketService.off('incident_assigned');
      socketService.off('alert-received');
    };
  }, []);

  const loadInitialData = async () => {
    await dispatch(fetchRecentIncidents());
    await dispatch(fetchAlerts());
  };

  const setupSocketListeners = () => {
    socketService.on('new-incident', (incident) => {
      dispatch(fetchRecentIncidents());

      // Show notification for critical incidents
      if (incident.severity === 'critical' || incident.severity === 'high') {
        Alert.alert(
          '🚨 Emergency Alert',
          `${incident.type.toUpperCase()} incident reported in ${incident.location_name || 'campus'}`,
          [
            { text: 'View', onPress: () => navigation.navigate('IncidentDetail', { id: incident.incident_id }) },
            { text: 'Dismiss', style: 'cancel' }
          ]
        );
      }
    });

    socketService.on('incident-updated', (incident) => {
      dispatch(updateIncident(incident));
      dispatch(fetchRecentIncidents());
    });

    socketService.on('incident_assigned', () => {
      dispatch(fetchRecentIncidents());
    });

    socketService.on('alert-received', (alert) => {
      dispatch(addAlert(alert));
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handleSOSPress = () => {
    Alert.alert(
      '🚨 SOS Emergency',
      'This will immediately send an emergency alert to campus security with your current location.\n\n⚠️ Only use in genuine emergencies!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => navigation.navigate('SOS')
        }
      ]
    );
  };

  const navigateToAlerts = () => {
    navigation.navigate('Alerts');
  };

  const navigateToReport = () => {
    navigation.navigate('Report');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name || 'Student'}!</Text>
            <Text style={styles.subGreeting}>Welcome to Campus Safety</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
          >
            <Icon name="account-circle" size={44} color="#2196F3" />
          </TouchableOpacity>
        </View>

        {/* Campus Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, styles.activeDot]} />
            <Text style={styles.statusText}>Campus Safety Connected</Text>
          </View>
          <TouchableOpacity onPress={navigateToAlerts} style={styles.alertBadge}>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
            <Icon name="notifications" size={28} color="#666" />
          </TouchableOpacity>
        </View>

        {/* SOS Button */}
        <SOSButton onPress={handleSOSPress} />

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={navigateToReport}
          >
            <View style={[styles.actionIcon, styles.reportIcon]}>
              <Icon name="report" size={28} color="#2196F3" />
            </View>
            <Text style={styles.actionText}>Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={navigateToAlerts}
          >
            <View style={[styles.actionIcon, styles.alertIcon]}>
              <Icon name="notifications-active" size={28} color="#FF5722" />
            </View>
            <Text style={styles.actionText}>Alerts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SafetyResources')}
          >
            <View style={[styles.actionIcon, styles.resourceIcon]}>
              <Icon name="info" size={28} color="#4CAF50" />
            </View>
            <Text style={styles.actionText}>Safety Info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EmergencyContacts')}
          >
            <View style={[styles.actionIcon, styles.contactIcon]}>
              <Icon name="contacts" size={28} color="#9C27B0" />
            </View>
            <Text style={styles.actionText}>Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Incidents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Incidents</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Incidents')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {incidentsLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading incidents...</Text>
            </View>
          ) : recentIncidents && recentIncidents.length > 0 ? (
            recentIncidents.slice(0, 3).map((incident) => (
              <IncidentCard
                key={incident.incident_id}
                incident={incident}
                onPress={() => navigation.navigate('IncidentDetail', { id: incident.incident_id })}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="check-circle" size={48} color="#4CAF50" />
              <Text style={styles.emptyText}>No recent incidents</Text>
              <Text style={styles.emptySubText}>Campus is safe</Text>
            </View>
          )}
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            <TouchableOpacity onPress={navigateToAlerts}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {alerts && alerts.length > 0 ? (
            alerts.slice(0, 3).map((alert) => (
              <AlertCard
                key={alert.alert_id}
                alert={alert}
                onPress={() => navigation.navigate('AlertDetail', { alert })}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="notifications-off" size={48} color="#999" />
              <Text style={styles.emptyText}>No recent alerts</Text>
            </View>
          )}
        </View>

        {/* Emergency Contacts Quick Access */}
        <View style={styles.emergencySection}>
          <Text style={styles.emergencyTitle}>📞 Emergency Contacts</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactItem}>
              <View style={[styles.contactIconCircle, styles.securityIcon]}>
                <Icon name="security" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.contactLabel}>Security</Text>
              <Text style={styles.contactNumber}>+251-911-234-567</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactItem}>
              <View style={[styles.contactIconCircle, styles.medicalIcon]}>
                <Icon name="local-hospital" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.contactLabel}>Medical</Text>
              <Text style={styles.contactNumber}>+251-911-765-432</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactItem}>
              <View style={[styles.contactIconCircle, styles.fireIcon]}>
                <Icon name="local-fire-department" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.contactLabel}>Fire</Text>
              <Text style={styles.contactNumber}>+251-911-987-654</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  scrollContent: {
    paddingBottom: 30
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333'
  },
  subGreeting: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  profileButton: {
    padding: 4
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10
  },
  activeDot: {
    backgroundColor: '#4CAF50'
  },
  inactiveDot: {
    backgroundColor: '#FF9800'
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  alertBadge: {
    position: 'relative',
    padding: 4
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 4
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 8
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  reportIcon: {
    backgroundColor: '#E3F2FD'
  },
  alertIcon: {
    backgroundColor: '#FBE9E7'
  },
  resourceIcon: {
    backgroundColor: '#E8F5E9'
  },
  contactIcon: {
    backgroundColor: '#F3E5F5'
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  seeAll: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500'
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center'
  },
  loadingText: {
    color: '#999',
    fontSize: 14
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center'
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 8
  },
  emptySubText: {
    color: '#CCC',
    fontSize: 14,
    marginTop: 4
  },
  emergencySection: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  contactItem: {
    alignItems: 'center'
  },
  contactIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  securityIcon: {
    backgroundColor: '#2196F3'
  },
  medicalIcon: {
    backgroundColor: '#F44336'
  },
  fireIcon: {
    backgroundColor: '#FF9800'
  },
  contactLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  contactNumber: {
    fontSize: 11,
    color: '#333',
    marginTop: 2
  }
});

export default HomeScreen;