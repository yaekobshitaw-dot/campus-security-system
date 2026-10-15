jest.mock('./api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

jest.mock('./location', () => ({
  getFreshLocation: jest.fn(),
}));

import api from './api';
import { getFreshLocation } from './location';
import { isOfficerLocationRole, startOfficerLocationUpdates } from './officerLocation';

describe('startOfficerLocationUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getFreshLocation.mockResolvedValue({ latitude: 9, longitude: 38, timestamp: Date.now() });
    api.patch.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not read or share location when sharing is disabled', () => {
    const stop = startOfficerLocationUpdates({ shareLocation: false });

    expect(stop).toBeUndefined();
    expect(getFreshLocation).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('reduces nonessential location polling when data saving is enabled', () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    const stop = startOfficerLocationUpdates({ dataSaving: true });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 120000);
    stop();
    setIntervalSpy.mockRestore();
  });

  it('keeps the standard officer location polling interval by default', () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    const stop = startOfficerLocationUpdates();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    stop();
    setIntervalSpy.mockRestore();
  });

  it('starts location sharing only for the recognized security roles', () => {
    expect(isOfficerLocationRole('security')).toBe(true);
    expect(isOfficerLocationRole('security_officer')).toBe(true);
    expect(isOfficerLocationRole('student')).toBe(false);
  });

  it('sends actual coordinates and the device capture time to the existing endpoint', async () => {
    const timestamp = Date.now();
    getFreshLocation.mockResolvedValue({ latitude: 9.02, longitude: 38.75, timestamp });
    const stop = startOfficerLocationUpdates();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.patch).toHaveBeenCalledWith('/users/me/location', {
      latitude: 9.02,
      longitude: 38.75,
      location_timestamp: new Date(timestamp).toISOString(),
    });
    stop();
  });

  it('does not send stale or missing coordinates and reports the problem', async () => {
    getFreshLocation.mockResolvedValue({ latitude: 9.02, longitude: 38.75, timestamp: Date.now() - 121000 });
    const onStatusChange = jest.fn();
    const stop = startOfficerLocationUpdates({ onStatusChange });
    await Promise.resolve();
    await Promise.resolve();

    expect(api.patch).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Waiting for a fresh, valid device location.',
      code: 'LOCATION_FIX_STALE',
    }));
    stop();
  });

  it('reports a network failure without sending a fabricated location', async () => {
    api.patch.mockRejectedValue(new Error('Network Error'));
    const onStatusChange = jest.fn();
    const stop = startOfficerLocationUpdates({ onStatusChange });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.patch).toHaveBeenCalledWith('/users/me/location', expect.objectContaining({
      latitude: 9,
      longitude: 38,
    }));
    expect(onStatusChange).toHaveBeenCalledWith({
      message: 'Location could not be shared. Check your network connection and try again.',
      code: null,
    });
    stop();
  });
});
