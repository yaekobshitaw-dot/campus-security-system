jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn(), sendIntent: jest.fn() },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'fine-location',
      ACCESS_COARSE_LOCATION: 'coarse-location',
    },
    RESULTS: { GRANTED: 'granted' },
    check: jest.fn(),
    requestMultiple: jest.fn(),
  },
  Platform: { OS: 'android' },
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

import { PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
  getFreshLocation,
  LOCATION_PERMISSION_DENIED,
  LOCATION_SERVICES_DISABLED,
  openLocationSettings,
} from './location';
import { Linking } from 'react-native';

const freshPosition = (timestamp = Date.now()) => ({
  coords: { latitude: 10.1, longitude: 39.2, accuracy: 6.5 },
  timestamp,
});

beforeEach(() => {
  jest.clearAllMocks();
  PermissionsAndroid.check.mockResolvedValue(true);
  PermissionsAndroid.requestMultiple.mockResolvedValue({
    'fine-location': 'granted',
    'coarse-location': 'granted',
  });
});

test('gets a high-accuracy, uncached device position and returns its metadata', async () => {
  Geolocation.watchPosition.mockImplementation((success) => {
    success(freshPosition());
    return 17;
  });

  await expect(getFreshLocation()).resolves.toEqual({
    latitude: 10.1,
    longitude: 39.2,
    accuracy: 6.5,
    timestamp: expect.any(Number),
  });
  expect(Geolocation.watchPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({
      enableHighAccuracy: true,
      distanceFilter: 0,
      interval: 1000,
      fastestInterval: 500,
    })
  );
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(17);
});

test('rejects when fine location permission is denied', async () => {
  PermissionsAndroid.check.mockResolvedValue(false);
  PermissionsAndroid.requestMultiple.mockResolvedValue({
    'fine-location': 'denied',
    'coarse-location': 'denied',
  });

  await expect(getFreshLocation()).rejects.toMatchObject({ code: LOCATION_PERMISSION_DENIED });
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith(['fine-location', 'coarse-location']);
});

test('does not allow approximate-only location permission for emergency submissions', async () => {
  PermissionsAndroid.check.mockResolvedValue(false);
  PermissionsAndroid.requestMultiple.mockResolvedValue({
    'fine-location': 'denied',
    'coarse-location': 'granted',
  });

  await expect(getFreshLocation()).rejects.toMatchObject({ code: LOCATION_PERMISSION_DENIED });
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});

test('rejects when the device cannot get a location', async () => {
  Geolocation.watchPosition.mockImplementation((success, failure) => {
    failure({ code: 2 });
    return 18;
  });

  await expect(getFreshLocation()).rejects.toThrow(
    'Unable to get your current location. Please enable GPS/Location and try again.'
  );
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(18);
});

test('ignores a stale position and waits for a fresh watch fix', async () => {
  const requestStartedAt = 100000;
  jest.spyOn(Date, 'now').mockReturnValue(requestStartedAt);
  Geolocation.watchPosition.mockImplementation((success) => {
    success(freshPosition(requestStartedAt - 1));
    success({
      coords: { latitude: 11.2, longitude: 40.3, accuracy: 4.5 },
      timestamp: requestStartedAt,
    });
    return 19;
  });

  await expect(getFreshLocation()).resolves.toEqual({
    latitude: 11.2,
    longitude: 40.3,
    accuracy: 4.5,
    timestamp: requestStartedAt,
  });
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(19);
});

test('reports disabled location services and opens Android Location settings', async () => {
  Geolocation.watchPosition.mockImplementation((success, failure) => {
    failure({ code: 5 });
    return 20;
  });

  await expect(getFreshLocation()).rejects.toMatchObject({ code: LOCATION_SERVICES_DISABLED });
  await openLocationSettings(LOCATION_SERVICES_DISABLED);
  expect(Linking.sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');
});

test('rejects incomplete coordinates instead of coercing null to zero', async () => {
  Geolocation.watchPosition.mockImplementation((success) => {
    success({
      coords: { latitude: null, longitude: 39.2, accuracy: 6 },
      timestamp: Date.now(),
    });
    return 21;
  });

  await expect(getFreshLocation()).rejects.toThrow(
    'Unable to get your current location. Please enable GPS/Location and try again.'
  );
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(21);
});

test('does not accept a fix without a timestamp or numeric accuracy', async () => {
  Geolocation.watchPosition.mockImplementation((success, failure) => {
    success({
      coords: { latitude: 10.1, longitude: 39.2, accuracy: null },
      timestamp: null,
    });
    failure({ code: 2 });
    return 22;
  });

  await expect(getFreshLocation()).rejects.toThrow(
    'Unable to get your current location. Please enable GPS/Location and try again.'
  );
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(22);
});
