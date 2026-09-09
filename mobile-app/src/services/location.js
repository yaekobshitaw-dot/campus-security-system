import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

const LOCATION_TIMEOUT_MS = 20000;

const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location permission required',
      message: 'Campus Security needs access to your location to attach incident and SOS context.',
      buttonNeutral: 'Ask Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'Allow',
    }
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Location request timed out.')), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const toLocation = (location) => {
  const latitude = Number(location?.coords?.latitude);
  const longitude = Number(location?.coords?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('The device returned an invalid location.');
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(Number(location?.coords?.accuracy)) ? Number(location.coords.accuracy) : null,
  };
};

export const getLocation = async () => {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new Error('Location permission was denied. Enable it in Settings to attach your location.');
  }

  try {
    const location = await withTimeout(
      new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (position) => resolve(position),
          (error) => reject(new Error(error?.message || 'Unable to determine the current device location.')),
          {
            enableHighAccuracy: true,
            timeout: LOCATION_TIMEOUT_MS,
            maximumAge: 10000,
            distanceFilter: 10,
          }
        );
      }),
      LOCATION_TIMEOUT_MS
    );
    return toLocation(location);
  } catch (currentLocationError) {
    try {
      const lastKnown = await withTimeout(
        new Promise((resolve, reject) => {
          Geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(error),
            {
              enableHighAccuracy: false,
              timeout: LOCATION_TIMEOUT_MS,
              maximumAge: 300000,
              distanceFilter: 50,
            }
          );
        }),
        LOCATION_TIMEOUT_MS
      );
      if (lastKnown) return toLocation(lastKnown);
    } catch {
    }
    throw new Error('Unable to determine the current device location.');
  }
};

export const startLocationTracking = async () => {
  try {
    const location = await getLocation();
    return location;
  } catch (error) {
    Alert.alert('Location services', error.message || 'Unable to access device location at this time.');
    return null;
  }
};

export default { getLocation, startLocationTracking };
