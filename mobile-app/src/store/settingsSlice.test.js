jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import settingsReducer, {
  defaultSettings,
  getNotificationBannerPreference,
  hydrateSettings,
  resetSettings,
  SETTINGS_STORAGE_KEY,
  updateSetting,
} from './settingsSlice';

const createStore = () => configureStore({ reducer: { settings: settingsReducer } });

describe('settingsSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
  });

  it('hydrates saved preferences and fills missing options with defaults', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ showIncidentBanners: false, unknown: false }));
    const store = createStore();

    await store.dispatch(hydrateSettings());

    expect(store.getState().settings.preferences).toEqual({
      ...defaultSettings,
      showIncidentBanners: false,
    });
    expect(store.getState().settings.hydrated).toBe(true);
  });

  it('persists preference changes locally', async () => {
    const store = createStore();

    await store.dispatch(updateSetting({ key: 'showEmergencyBanners', value: false }));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...defaultSettings, showEmergencyBanners: false })
    );
    expect(store.getState().settings.preferences.showEmergencyBanners).toBe(false);
  });

  it('restores persisted defaults', async () => {
    const store = createStore();

    await store.dispatch(resetSettings());

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
    expect(store.getState().settings.preferences).toEqual(defaultSettings);
  });

  it('matches emergency, incident, and general banners to their preferences', () => {
    expect(getNotificationBannerPreference({ type: 'sos-created' }, { ...defaultSettings, showEmergencyBanners: false })).toBe(false);
    expect(getNotificationBannerPreference({ title: 'Incident report received' }, { ...defaultSettings, showIncidentBanners: false })).toBe(false);
    expect(getNotificationBannerPreference({ title: 'Campus announcement' }, { ...defaultSettings, showGeneralBanners: false })).toBe(false);
  });
});
