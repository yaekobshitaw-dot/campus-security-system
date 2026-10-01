jest.mock('./api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

jest.mock('./location', () => ({
  getLocation: jest.fn(),
}));

import api from './api';
import { getLocation } from './location';
import { startOfficerLocationUpdates } from './officerLocation';

describe('startOfficerLocationUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLocation.mockResolvedValue({ latitude: 9, longitude: 38 });
    api.patch.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not read or share location when sharing is disabled', () => {
    const stop = startOfficerLocationUpdates({ shareLocation: false });

    expect(stop).toBeUndefined();
    expect(getLocation).not.toHaveBeenCalled();
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
});
