import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { getSocketBaseUrl } from '../config/server';

class LocalEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, listener) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(listener);
  }

  off(event, listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = listener
      ? this.listeners[event].filter((item) => item !== listener)
      : [];
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((listener) => listener(data));
  }
}

const WS_URL = process.env.WS_URL || getSocketBaseUrl();

class SocketService extends LocalEventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
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
        this.reconnectAttempts++;
        if (this.reconnectAttempts <= 3 || this.reconnectAttempts % 5 === 0) {
          console.warn('Socket connection error:', error.message || error);
        }
        this.emit('error', error);
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to connect socket:', error);
    }
  }

  setupEventListeners() {
    if (!this.socket) {
      return;
    }

    this.socket.on('new-incident', (data) => {
      this.emit('new-incident', data);
    });

    this.socket.on('incident-updated', (data) => {
      this.emit('incident-updated', data);
    });

    this.socket.on('alert-received', (data) => {
      this.emit('alert-received', data);
    });

    this.socket.on('sos_alert', (data) => {
      this.emit('sos_alert', data);
    });

    this.socket.on('incident_assigned', (data) => {
      this.emit('incident_assigned', data);
    });

    this.socket.on('officer_assignment', (data) => {
      this.emit('officer_assignment', data);
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