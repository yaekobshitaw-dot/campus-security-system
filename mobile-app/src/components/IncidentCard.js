import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './ui';

const relativeTime = (value) => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
};

export const IncidentCard = ({ incident, onPress }) => {
  const getTypeIcon = (type) => {
    const icons = {
      fire: 'fire',
      medical: 'local-hospital',
      security_threat: 'security',
      suspicious_package: 'warning',
      flood: 'water',
      power_outage: 'power',
      missing_person: 'person',
      natural_disaster: 'nature',
      assault: 'gavel',
      theft: 'local-police',
      vandalism: 'report',
      other: 'help',
    };
    return icons[type] || 'report';
  };

  const getTypeColor = (type) => {
    const colors = {
      fire: '#D9573F',
      medical: '#F44336',
      security_threat: '#6B5CA5',
      suspicious_package: '#FF9800',
      flood: '#2D6CDF',
      power_outage: '#607D8B',
      missing_person: '#FF5722',
      natural_disaster: '#FF5722',
      assault: '#F44336',
      theft: '#FF5722',
      vandalism: '#FF5722',
      other: '#999',
    };
    return colors[type] || '#999';
  };

  const getStatusColor = (status) => {
    const colors = {
      reported: '#FF9800',
      investigating: '#8A5B9C',
      acknowledged: '#2196F3',
      dispatched: '#9C27B0',
      on_scene: '#4CAF50',
      resolved: '#4CAF50',
      closed: '#999',
      cancelled: '#999',
    };
    return colors[status] || '#999';
  };
  const getStatusLabel = (status) => status === 'investigating' ? 'In Progress' : status;

  const getSeverityLabel = (severity) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.typeContainer}>
          <Icon
            name={getTypeIcon(incident.type)}
            size={24}
            color={getTypeColor(incident.type)}
          />
          <Text style={styles.typeText}>{incident.type.replace('_', ' ')}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(incident.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(incident.status)}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {incident.description || 'No description provided'}
      </Text>

      <View style={styles.footer}>
        <View style={styles.locationContainer}>
          <Icon name="location-on" size={16} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {incident.location_name || incident.building || 'Unknown location'}
          </Text>
        </View>
        <View style={styles.timeContainer}>
          <Icon name="access-time" size={16} color="#666" />
          <Text style={styles.timeText}>
            {relativeTime(incident.created_at)}
          </Text>
        </View>
      </View>

      {incident.severity && (
        <View
          style={[
            styles.severityIndicator,
            { backgroundColor: getStatusColor(incident.severity) },
          ]}
        >
          <Text style={styles.severityText}>{getSeverityLabel(incident.severity)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  severityIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  severityText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});