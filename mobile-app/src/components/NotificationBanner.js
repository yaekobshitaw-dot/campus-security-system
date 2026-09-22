import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const NotificationBanner = ({ title, message, onPress, onClose }) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text numberOfLines={2} style={styles.message}>{message}</Text>
      </View>
      <TouchableOpacity onPress={onClose} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
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
});

export default NotificationBanner;
