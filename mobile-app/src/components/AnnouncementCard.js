import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './ui';

const priorityStyles = {
  low: { label: 'Low', color: '#16734A', background: '#E7F5ED' },
  medium: { label: 'Medium', color: '#9A6700', background: '#FFF4D6' },
  high: { label: 'High', color: '#B54708', background: '#FFF0E5' },
  critical: { label: 'Critical', color: '#B42318', background: '#FEECEC' },
};

export const getPriorityStyle = (priority) => priorityStyles[priority] || priorityStyles.medium;

export const AnnouncementCard = ({ announcement, onPress }) => {
  const priority = getPriorityStyle(announcement.priority);
  return (
    <TouchableOpacity
      style={[styles.card, !announcement.is_read && styles.unreadCard]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${announcement.is_read ? '' : 'Unread '}${announcement.title}`}
    >
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          {!announcement.is_read && <View style={styles.unreadDot} accessibilityLabel="Unread" />}
          <Text style={styles.title} numberOfLines={2}>{announcement.title}</Text>
        </View>
        <View style={[styles.priority, { backgroundColor: priority.background }]}><Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text></View>
      </View>
      <Text style={styles.preview} numberOfLines={3}>{announcement.content}</Text>
      <Text style={styles.date}>{announcement.published_at ? new Date(announcement.published_at).toLocaleString() : 'Published recently'}</Text>
      <View style={styles.openHint}><Icon name="chevron-right" size={20} color={colors.teal} /><Text style={styles.readState}>{announcement.is_read ? 'Read' : 'Unread'}</Text></View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 12, padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, elevation: 1 },
  unreadCard: { borderColor: colors.teal, borderWidth: 1.5 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  unreadDot: { width: 8, height: 8, marginTop: 6, borderRadius: 4, backgroundColor: colors.teal },
  title: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  priority: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  preview: { marginTop: 12, color: '#657276', fontSize: 14, lineHeight: 21 },
  date: { marginTop: 12, color: '#8A9698', fontSize: 12 },
  openHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  readState: { color: colors.teal, fontSize: 12, fontWeight: '700' },
});
