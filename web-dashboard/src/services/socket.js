import { EventEmitter } from 'events';

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
  }

  connect() {
    this.connected = true;
    this.emit('connected');
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnected');
  }

  emitEvent(event, payload) {
    this.emit(event, payload);
  }
}

export const webSocket = new WebSocketService();
export default webSocket;
