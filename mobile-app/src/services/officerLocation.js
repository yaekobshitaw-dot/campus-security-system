import api from './api';
import { getLocation } from './location';

const LOCATION_UPDATE_INTERVAL_MS = 30000;

const sendAvailableStatus = async () => {
  try {
    await api.patch('/users/me/location', { availability_status: 'available' });
  } catch {
  }
};

export const startOfficerLocationUpdates = () => {
  let stopped = false;
  let updateInProgress = false;

  const sendLocation = async () => {
    if (stopped || updateInProgress) return;
    updateInProgress = true;
    try {
      await sendAvailableStatus();
      const location = await getLocation();
      if (!stopped) {
        await api.patch('/users/me/location', {
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    } catch {
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
