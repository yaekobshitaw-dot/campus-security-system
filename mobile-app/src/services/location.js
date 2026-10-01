import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

const LOCATION_TIMEOUT_MS = 20000;
const MAX_FRESH_LOCATION_AGE_MS = 15000;
const LOCATION_WATCH_INTERVAL_MS = 1000;
const LOCATION_WATCH_FASTEST_INTERVAL_MS = 500;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;
export const LOCATION_PERMISSION_DENIED = 'LOCATION_PERMISSION_DENIED';
export const LOCATION_SERVICES_DISABLED = 'LOCATION_SERVICES_DISABLED';

const logLocationDebug = (event, details) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.debug(`[Location] ${event}`, details);
  }
};

export const logLocationSubmission = (source, location) => {
  logLocationDebug(`${source}_SUBMIT_COORDINATES`, {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    timestamp: location.timestamp,
  });
};

const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarsePermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if (await PermissionsAndroid.check(finePermission)) return true;

  const granted = await PermissionsAndroid.requestMultiple([finePermission, coarsePermission]);
  return granted[finePermission] === PermissionsAndroid.RESULTS.GRANTED;
};

const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Location request timed out.')), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const toLocation = (location) => {
  const rawLatitude = location?.coords?.latitude;
  const rawLongitude = location?.coords?.longitude;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (rawLatitude === null || rawLatitude === undefined || rawLongitude === null || rawLongitude === undefined
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Unable to get your current location. Please enable GPS/Location and try again.');
  }

  const accuracy = location?.coords?.accuracy;
  const timestamp = Number(location?.timestamp);
  return {
    latitude,
    longitude,
    accuracy: accuracy !== null && accuracy !== undefined && accuracy !== '' && Number.isFinite(Number(accuracy))
      ? Number(accuracy)
      : null,
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
  };
};

const getLocationError = (error) => {
  if (error?.code === 1) {
    const permissionError = new Error('Location permission is required. Allow location access in Settings and try again.');
    permissionError.code = LOCATION_PERMISSION_DENIED;
    return permissionError;
  }
  if (error?.code === 5) {
    const servicesError = new Error('Unable to get your current location. Please enable GPS/Location and try again.');
    servicesError.code = LOCATION_SERVICES_DISABLED;
    return servicesError;
  }
  return new Error('Unable to get your current location. Please enable GPS/Location and try again.');
};

export const getLocation = async () => {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    const error = new Error('Location permission is required. Allow location access in Settings and try again.');
    error.code = LOCATION_PERMISSION_DENIED;
    throw error;
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

export const getFreshLocation = async () => {
  let hasPermission;
  try {
    hasPermission = await requestLocationPermission();
  } catch (error) {
    throw getLocationError(error);
  }
  if (!hasPermission) {
    const error = new Error('Location permission is required. Allow location access in Settings and try again.');
    error.code = LOCATION_PERMISSION_DENIED;
    throw error;
  }

  const requestStartedAt = Date.now();
  logLocationDebug('GPS_REQUEST_STARTED', { timestamp: requestStartedAt });

  try {
    const location = await new Promise((resolve, reject) => {
      let watchId = null;
      let timeoutId;
      let settled = false;

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (watchId !== null) Geolocation.clearWatch(watchId);
        callback(value);
      };

      timeoutId = setTimeout(
        () => finish(reject, { code: 3, message: 'Location request timed out.' }),
        LOCATION_TIMEOUT_MS
      );

      try {
        watchId = Geolocation.watchPosition(
          (position) => {
            let candidate;
            try {
              candidate = toLocation(position);
            } catch (error) {
              finish(reject, error);
              return;
            }

            const ageMs = Date.now() - candidate.timestamp;
            logLocationDebug('GPS_FIX_RECEIVED', {
              timestamp: candidate.timestamp,
              ageMs,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
              accuracy: candidate.accuracy,
            });

            const timestampIsValid = Number.isFinite(candidate.timestamp)
              && candidate.timestamp >= requestStartedAt
              && ageMs <= MAX_FRESH_LOCATION_AGE_MS
              && ageMs >= -MAX_FUTURE_TIMESTAMP_SKEW_MS;
            const accuracyIsValid = Number.isFinite(candidate.accuracy) && candidate.accuracy >= 0;

            if (!timestampIsValid || !accuracyIsValid) return;
            logLocationDebug('GPS_FIX_TIMESTAMP', { timestamp: candidate.timestamp });
            logLocationDebug('GPS_FIX_AGE_MS', { ageMs });
            finish(resolve, candidate);
          },
          (error) => finish(reject, error),
          {
            enableHighAccuracy: true,
            distanceFilter: 0,
            interval: LOCATION_WATCH_INTERVAL_MS,
            fastestInterval: LOCATION_WATCH_FASTEST_INTERVAL_MS,
            showLocationDialog: false,
            forceRequestLocation: true,
          }
        );

        if (settled && watchId !== null) Geolocation.clearWatch(watchId);
      } catch (error) {
        finish(reject, error);
      }
    });

    return location;
  } catch (error) {
    throw getLocationError(error);
  }
};

export const openLocationSettings = async (errorCode) => {
  if (Platform.OS === 'android' && errorCode === LOCATION_SERVICES_DISABLED) {
    await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    return;
  }
  await Linking.openSettings();
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

export default { getLocation, getFreshLocation, openLocationSettings, startLocationTracking };
