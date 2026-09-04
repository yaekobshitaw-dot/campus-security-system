import { StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
