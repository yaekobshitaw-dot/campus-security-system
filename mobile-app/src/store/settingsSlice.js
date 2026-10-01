import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export const SETTINGS_STORAGE_KEY = 'app_settings';

export const defaultSettings = {
  showGeneralBanners: true,
  showIncidentBanners: true,
  showEmergencyBanners: true,
  vibrateOnAlerts: true,
  shareLocation: true,
  confirmSOS: true,
  dataSaving: false,
  theme: 'system',
  textSize: 'medium',
  language: 'en',
};

const getValidSettings = (settings) => {
  const booleans = Object.fromEntries(
    Object.keys(defaultSettings)
      .filter((key) => typeof defaultSettings[key] === 'boolean' && typeof settings?.[key] === 'boolean')
      .map((key) => [key, settings[key]])
  );
  const enums = Object.fromEntries(
    Object.entries({
      theme: ['system', 'light', 'dark'],
      textSize: ['small', 'medium', 'large'],
      language: ['en', 'am'],
    })
      .filter(([key, values]) => values.includes(settings?.[key]))
      .map(([key]) => [key, settings[key]])
  );

  return { ...defaultSettings, ...booleans, ...enums };
};

export const hydrateSettings = createAsyncThunk('settings/hydrate', async () => {
  try {
    const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    return savedSettings ? getValidSettings(JSON.parse(savedSettings)) : getValidSettings();
  } catch (error) {
    return getValidSettings();
  }
});

export const updateSetting = createAsyncThunk('settings/update', async ({ key, value }, { getState }) => {
  if (!Object.prototype.hasOwnProperty.call(defaultSettings, key)) {
    throw new Error(`Unknown app setting: ${key}`);
  }
  const settings = getValidSettings({ ...getState().settings.preferences, [key]: value });
  if (settings[key] !== value) {
    throw new Error(`Invalid value for app setting: ${key}`);
  }
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return settings;
});

export const resetSettings = createAsyncThunk('settings/reset', async () => {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
  return defaultSettings;
});

export const getNotificationBannerPreference = (notification, preferences = defaultSettings) => {
  const data = notification?.data || {};
  const searchableText = [
    notification?.type,
    notification?.category,
    notification?.event,
    notification?.title,
    notification?.message,
    data.type,
    data.category,
    data.event,
    data.title,
    data.message,
  ].filter(Boolean).join(' ');

  if (/\b(sos|emergency|critical)\b/i.test(searchableText)) {
    return preferences.showEmergencyBanners;
  }
  if (/\b(incident|report)\b/i.test(searchableText)) {
    return preferences.showIncidentBanners;
  }
  return preferences.showGeneralBanners;
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    preferences: defaultSettings,
    hydrated: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSettings.fulfilled, (state, action) => {
        state.preferences = action.payload;
        state.hydrated = true;
      })
      .addCase(updateSetting.fulfilled, (state, action) => {
        state.preferences = action.payload;
      })
      .addCase(resetSettings.fulfilled, (state, action) => {
        state.preferences = action.payload;
      });
  },
});

export default settingsSlice.reducer;
