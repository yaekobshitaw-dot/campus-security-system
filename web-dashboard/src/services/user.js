import api from './api';

export const updateMyAvailability = (availability) => {
  return api.patch('/users/me/availability', { availability_status: availability });
};

export default { updateMyAvailability };