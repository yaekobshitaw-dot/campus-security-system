import { Alert } from 'react-native';

export const getLocation = async () => {
  return new Promise((resolve, reject) => {
    if (!navigator && typeof navigator === 'undefined') {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error('Geolocation API is not supported by this platform'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
};

export const startLocationTracking = async () => {
  try {
    const location = await getLocation();
    return location;
  } catch (error) {
    Alert.alert('Location services', 'Unable to access device location at this time.');
    return null;
  }
};

export default { getLocation, startLocationTracking };
