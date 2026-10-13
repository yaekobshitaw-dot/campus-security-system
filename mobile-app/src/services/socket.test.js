jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn() },
}));

jest.mock('socket.io-client', () => jest.fn());

import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { socketService } from './socket';

const createSocket = () => ({
  handlers: {},
  on: jest.fn(function on(event, handler) {
    this.handlers[event] = handler;
  }),
  disconnect: jest.fn(),
  emit: jest.fn(),
});

describe('mobile socket session revocation', () => {
  beforeEach(() => {
    socketService.disconnect();
    socketService.off('session-revoked');
    socketService.off('disconnected');
    jest.clearAllMocks();
  });

  it('disconnects and forwards revocation for the current authenticated socket', async () => {
    const socket = createSocket();
    const payload = { reason: 'new_login', message: 'Signed in on another device.' };
    const onRevoked = jest.fn();
    AsyncStorage.getItem.mockResolvedValue('access-token-a');
    io.mockReturnValue(socket);

    await socketService.connect();
    socketService.on('session-revoked', onRevoked);
    await socket.handlers['session-revoked'](payload);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socketService.socket).toBeNull();
    expect(onRevoked).toHaveBeenCalledWith(payload);
  });

  it('ignores a revocation event when storage now contains a newer token', async () => {
    const socket = createSocket();
    const onRevoked = jest.fn();
    AsyncStorage.getItem.mockResolvedValue('access-token-a');
    io.mockReturnValue(socket);

    await socketService.connect();
    socketService.on('session-revoked', onRevoked);
    AsyncStorage.getItem.mockResolvedValue('newer-access-token');
    await socket.handlers['session-revoked']({ reason: 'new_login', message: 'Signed in elsewhere.' });

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socketService.socket).toBe(socket);
    expect(onRevoked).not.toHaveBeenCalled();
  });
});