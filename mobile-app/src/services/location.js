import * as Location from 'expo-location';
import { Alert } from 'react-native';

const LOCATION_TIMEOUT_MS = 20000;

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
    accuracy: Number.isFinite(Number(location.coords.accuracy)) ? Number(location.coords.accuracy) : null,
  };
};

export const getLocation = async () => {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  }

  if (status !== 'granted') {
    throw new Error('Location permission was denied. Enable it in Settings to attach your location.');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Location services are turned off.');
  }

  try {
    const location = await withTimeout(Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    }), LOCATION_TIMEOUT_MS);
    return toLocation(location);
  } catch (currentLocationError) {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 300000,
        requiredAccuracy: 1000,
      });
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
