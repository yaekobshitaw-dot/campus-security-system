import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsRead } from '../store/notificationSlice';

const NotificationsScreen = () => {
  const dispatch = useDispatch();
  const { notifications, unreadCount, loading } = useSelector((s) => s.notifications || { notifications: [], unreadCount: 0, loading: false });

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const renderItem = ({ item }) => (
    <View style={[styles.item, item.is_read ? styles.read : styles.unread]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title || item.message}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.meta}>{new Date(item.created_at || item.createdAt || item.timestamp).toLocaleString()}</Text>
      </View>
      {!item.is_read && (
        <TouchableOpacity onPress={() => dispatch(markNotificationAsRead(item.notification_id))} style={styles.markBtn}>
          <Text style={styles.markText}>Mark read</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Notifications</Text>
        <TouchableOpacity onPress={() => dispatch(markAllNotificationsRead())}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.unread}>Unread: {unreadCount}</Text>
      <FlatList data={notifications} keyExtractor={(i) => i.notification_id} renderItem={renderItem} refreshing={loading} onRefresh={() => dispatch(fetchNotifications())} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerText: { fontSize: 20, fontWeight: '700' },
  markAll: { color: '#007AFF' },
  unread: { marginBottom: 8, color: '#666' },
  item: { flexDirection: 'row', padding: 12, borderRadius: 8, marginBottom: 8, alignItems: 'center' },
  unreadItem: {},
  read: { backgroundColor: '#f5f5f5' },
  unread: { backgroundColor: '#fff' },
  title: { fontWeight: '700' },
  message: { color: '#444', marginTop: 4 },
  meta: { color: '#999', fontSize: 12, marginTop: 6 },
  markBtn: { padding: 8 },
  markText: { color: '#007AFF' },
});

export default NotificationsScreen;
