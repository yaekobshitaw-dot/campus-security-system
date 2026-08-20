import * as Location from 'expo-location';
import { Alert } from 'react-native';

export const getLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission was denied. Enable it in Settings to attach your location.');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
  };
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
