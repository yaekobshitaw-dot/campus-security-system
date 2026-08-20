import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const relativeTime = (value) => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
};

export const AlertCard = ({ alert, onPress }) => {
  const getChannelIcon = (channel) => {
    const icons = {
      push: 'notifications',
      sms: 'sms',
      email: 'email',
      dashboard: 'dashboard',
    };
    return icons[channel] || 'notifications';
  };

  return (
    <TouchableOpacity
      style={[styles.card, !alert.is_read && styles.unread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon name={getChannelIcon(alert.channel)} size={20} color="#2196F3" />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {alert.title}
        </Text>
        {!alert.is_read && <View style={styles.unreadDot} />}
      </View>

      <Text style={styles.message} numberOfLines={3}>
        {alert.message}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.time}>
          {relativeTime(alert.sent_at || alert.created_at)}
        </Text>
        {alert.channel && (
          <View style={styles.channelBadge}>
            <Text style={styles.channelText}>{alert.channel}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  unread: {
    backgroundColor: '#F0F7FF',
    borderColor: '#2196F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  channelBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  channelText: {
    fontSize: 10,
    color: '#2196F3',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
});