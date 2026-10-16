import api from './api';
import { getFreshLocation, LOCATION_PERMISSION_DENIED, LOCATION_SERVICES_DISABLED, LOCATION_UNAVAILABLE } from './location';

const LOCATION_UPDATE_INTERVAL_MS = 30000;
const DATA_SAVING_LOCATION_UPDATE_INTERVAL_MS = 120000;
const MAX_LOCATION_AGE_MS = 2 * 60 * 1000;
const MAX_FUTURE_LOCATION_SKEW_MS = 60000;

export const isOfficerLocationRole = (role) => ['security', 'security_officer']
    .includes(String(role || '').trim().toLowerCase());

export const canShareOfficerLocation = ({ isAuthenticated, role, shareLocation }) => (
    Boolean(isAuthenticated && isOfficerLocationRole(role) && shareLocation)
);

export const officerLocationStatusFor = (error) => {
    if (!error) return { status: 'enabled', message: '', code: null };
    if (error.status === 'loading') return { status: 'loading', message: '', code: null };
    if (error.code === LOCATION_PERMISSION_DENIED) {
        return { status: 'permission-denied', message: error.message, code: error.code };
    }
    if ([LOCATION_SERVICES_DISABLED, LOCATION_UNAVAILABLE, 'LOCATION_FIX_STALE'].includes(error.code)) {
        return { status: 'gps-unavailable', message: error.message, code: error.code };
    }
    return { status: 'update-failed', message: getLocationErrorMessage(error), code: error.code || null };
};

const getLocationErrorMessage = (error) => {
    if ([LOCATION_PERMISSION_DENIED, LOCATION_SERVICES_DISABLED, LOCATION_UNAVAILABLE, 'LOCATION_FIX_STALE'].includes(error?.code)) return error.message;
    if (error?.response?.status === 401) return 'Sign in again to share your location with the response team.';
    if (error?.response) return error.response.data?.message || 'The response team could not receive your location.';
    return 'Location could not be shared. Check your network connection and try again.';
};

export const startOfficerLocationUpdates = ({ shareLocation = true, dataSaving = false, onStatusChange } = {}) => {
    if (!shareLocation) return undefined;

    let stopped = false;
    let updateInProgress = false;
    let hasStartedLocationRequest = false;

    const sendLocation = async() => {
        if (stopped || updateInProgress) return;
        updateInProgress = true;
        if (!hasStartedLocationRequest) {
            hasStartedLocationRequest = true;
            onStatusChange?.({ status: 'loading' });
        }
        try {
            const location = await getFreshLocation();
            const latitude = Number(location?.latitude);
            const longitude = Number(location?.longitude);
            const timestamp = Number(location?.timestamp);
            const age = Date.now() - timestamp;
            if (location?.timestamp == null || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
                !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
                !Number.isFinite(timestamp) || age > MAX_LOCATION_AGE_MS || age < -MAX_FUTURE_LOCATION_SKEW_MS) {
                const staleError = new Error('Waiting for a fresh, valid device location.');
                staleError.code = 'LOCATION_FIX_STALE';
                throw staleError;
            }
            if (!stopped) {
                await api.patch('/users/me/location', {
                    latitude,
                    longitude,
                    location_timestamp: new Date(timestamp).toISOString(),
                });
                if (!stopped) onStatusChange?.(null);
            }
        } catch (error) {
            if (!stopped) onStatusChange?.({ message: getLocationErrorMessage(error), code: error?.code || null });
        } finally {
            updateInProgress = false;
        }
    };

    sendLocation();
    const intervalId = setInterval(
        sendLocation,
        dataSaving ? DATA_SAVING_LOCATION_UPDATE_INTERVAL_MS : LOCATION_UPDATE_INTERVAL_MS
    );

    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

export default { startOfficerLocationUpdates };