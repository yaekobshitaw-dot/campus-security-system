import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export const colors = {
  ink: '#17313A',
  muted: '#6B7D82',
  canvas: '#F4F8F7',
  surface: '#FFFFFF',
  line: '#DCE9E5',
  teal: '#116B5F',
  tealSoft: '#E6F3EF',
  blue: '#2D6CDF',
  danger: '#D64545',
  dangerSoft: '#FFF0EE',
};

const iconSymbols = {
  'account-circle': '👤',
  add: '➕',
  'add-circle-outline': '➕',
  'add-alert': '📝',
  'admin-panel-settings': '⚙️',
  assignment: '📝',
  'assignment-turned-in': '✅',
  'access-time': '⏰',
  'arrow-back': '←',
  'arrow-forward': '→',
  business: '🏢',
  campaign: '🔔',
  'check-circle': '✅',
  check: '✅',
  'chevron-left': '←',
  'chevron-right': '→',
  contacts: '📞',
  clear: '❌',
  cancel: '❌',
  call: '📞',
  close: '❌',
  'cloud-upload': '⬆️',
  'done-all': '✅',
  'delete-outline': '🗑️',
  delete: '🗑️',
  edit: '✏️',
  error: '❌',
  email: '✉️',
  emergency: '🚨',
  'error-outline': '❌',
  'fire-extinguisher': '🚨',
  'health-and-safety': '🛡️',
  help: 'ℹ️',
  'help-outline': 'ℹ️',
  home: '🏠',
  'local-fire-department': '🚨',
  'local-hospital': '🏥',
  'local-police': '🚓',
  location: '📍',
  'location-on': '📍',
  map: '📍',
  lock: '🔒',
  login: '🚪',
  logout: '🚪',
  'mark-email-read': '✉️',
  'my-location': '📍',
  menu: '☰',
  nature: '🌿',
  notifications: '🔔',
  'notifications-active': '🔔',
  'notifications-none': '🔔',
  'notifications-off': '🔔',
  person: '👤',
  'person-add': '👤',
  'person-outline': '👤',
  phone: '📞',
  'phone-in-talk': '📞',
  'photo-camera': '📷',
  'photo-library': '📷',
  power: '⚡',
  refresh: '🔄',
  remove: '➖',
  'remove-circle-outline': '➖',
  report: '📝',
  search: '🔍',
  school: '🎓',
  security: '🔒',
  settings: '⚙️',
  'smart-toy': '🤖',
  sms: '📞',
  dashboard: '🏠',
  'outlined-flag': '📝',
  'water-drop': '💧',
  gavel: '⚖️',
  shield: '🔒',
  send: '→',
  info: 'ℹ️',
  'visibility': '👁️',
  'visibility-off': '🙈',
  warning: '⚠️',
};

export const Icon = ({ name, size = 24, color = colors.ink, style }) => (
  <Text
    accessible={false}
    allowFontScaling={false}
    style={[
      {
        color,
        fontSize: size,
        includeFontPadding: false,
        lineHeight: Math.ceil(size * 1.25),
        textAlign: 'center',
      },
      style,
    ]}
  >
    {iconSymbols[name] || 'ℹ️'}
  </Text>
);

export const IconButton = ({ name, onPress, color = colors.ink, accessibilityLabel, style }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={8}
    onPress={onPress}
    style={[styles.iconButton, style]}
  >
    <Icon name={name} size={22} color={color} />
  </TouchableOpacity>
);

export const screenStyles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 18,
  },
  title: { color: colors.ink, fontSize: 23, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#17313A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
});

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    borderRadius: 22,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
});
