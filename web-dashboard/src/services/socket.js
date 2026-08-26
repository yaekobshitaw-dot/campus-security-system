import { io } from 'socket.io-client';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || (
  API_URL.startsWith('http') ? API_URL.replace(/\/api$/, '') : 'http://localhost:5002'
);
const SOCKET_URL = configuredSocketUrl
  .replace(/^ws:\/\//, 'http://')
  .replace(/^wss:\/\//, 'https://')
  .replace(/\/$/, '');

class WebSocketService {
  constructor() {
    this.connected = false;
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    const token = localStorage.getItem('token');
    if (!token || this.socket) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.emit('connected');
    });
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.emit('disconnected', reason);
    });
    this.socket.on('connect_error', (error) => this.emit('error', error));
    ['new-incident', 'incident-updated', 'alert-received', 'sos_alert', 'incident_assigned', 'officer_assignment'].forEach((event) => {
      this.socket.on(event, (payload) => this.emit(event, payload));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  emitEvent(event, payload) {
    if (this.socket?.connected) this.socket.emit(event, payload);
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  off(event, listener) {
    if (!listener) {
      this.listeners.delete(event);
      return;
    }
    const listeners = (this.listeners.get(event) || []).filter((item) => item !== listener);
    this.listeners.set(event, listeners);
  }

  emit(event, payload) {
    (this.listeners.get(event) || []).forEach((listener) => listener(payload));
  }
}

export const webSocket = new WebSocketService();
export default webSocket;
