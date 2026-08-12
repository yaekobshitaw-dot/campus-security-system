import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import io from 'socket.io-client';

const getWSURL = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'ws://10.0.2.2:5000';
    }
    return 'ws://localhost:5000';
  }
  return 'wss://api.yourdomain.com';
};

const WS_URL = process.env.WS_URL || getWSURL();

class SocketService extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async connect() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('No token available, skipping socket connection');
        return;
      }

      if (this.socket && this.isConnected) {
        console.log('Socket already connected');
        return;
      }

      this.socket = io(WS_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        timeout: 20000,
        forceNew: true,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.isConnected = false;
        this.emit('disconnected', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.log('Socket connection error:', error);
        this.reconnectAttempts++;
        this.emit('error', error);
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to connect socket:', error);
      throw error;
    }
  }

  setupEventListeners() {
    this.socket.on('new-incident', (data) => {
      this.emit('new-incident', data);
    });

    this.socket.on('incident-updated', (data) => {
      this.emit('incident-updated', data);
    });

    this.socket.on('alert-received', (data) => {
      this.emit('alert-received', data);
    });
  }

  emitEvent(event, data) {
    if (this.isConnected && this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export const socketService = new SocketService();
export default socketService;