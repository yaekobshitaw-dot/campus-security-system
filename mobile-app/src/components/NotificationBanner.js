import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from './AppText';
import { useMobileTranslation } from '../utils/translations';

const NotificationBanner = ({ title, message, onPress, onClose, isDark = false }) => {
  const t = useMobileTranslation();

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <AppText style={[styles.title, isDark && styles.darkText]}>{title}</AppText>
        <AppText numberOfLines={2} style={[styles.message, isDark && styles.darkMessage]}>{message}</AppText>
      </View>
      <TouchableOpacity onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('Close notification')}>
        <AppText style={styles.closeText}>×</AppText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 40,
    left: 12,
    right: 12,
    backgroundColor: 'white',
    elevation: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    zIndex: 9999,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    color: '#444',
  },
  close: {
    padding: 6,
    marginLeft: 8,
  },
  closeText: {
    color: '#666',
    fontSize: 16,
  },
  darkContainer: {
    backgroundColor: '#1E293B',
  },
  darkText: {
    color: '#F1F5F9',
  },
  darkMessage: {
    color: '#CBD5E1',
  },
});

export default NotificationBanner;
