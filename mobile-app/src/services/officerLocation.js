import api from './api';
import { getLocation } from './location';

const LOCATION_UPDATE_INTERVAL_MS = 30000;

export const startOfficerLocationUpdates = () => {
  let stopped = false;
  let updateInProgress = false;

  const sendLocation = async () => {
    if (stopped || updateInProgress) return;
    updateInProgress = true;
    try {
      const location = await getLocation();
      if (__DEV__) console.log('Officer GPS location acquired.');
      if (!stopped) {
        await api.patch('/users/me/location', {
          latitude: location.latitude,
          longitude: location.longitude,
        });
        if (__DEV__) console.log('Officer location update accepted by the server.');
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Officer location update failed:', error?.response?.data?.message || error?.message || 'Unknown location error');
      }
    } finally {
      updateInProgress = false;
    }
  };

  sendLocation();
  const intervalId = setInterval(sendLocation, LOCATION_UPDATE_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
};

export default { startOfficerLocationUpdates };
