import { useSyncExternalStore } from 'react';

const listeners = new Map();
const storageKey = (userId) => `campussecure-theme:${userId || 'anonymous'}`;

export const getAppearanceTheme = (userId) => (
  localStorage.getItem(storageKey(userId)) === 'dark' ? 'dark' : 'light'
);

export function setAppearanceTheme(userId, theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem(storageKey(userId), nextTheme);
  listeners.get(userId)?.forEach((listener) => listener());
}

export function useAppearanceTheme(userId) {
  return useSyncExternalStore(
    (listener) => {
      const userListeners = listeners.get(userId) || new Set();
      userListeners.add(listener);
      listeners.set(userId, userListeners);
      return () => {
        userListeners.delete(listener);
        if (!userListeners.size) listeners.delete(userId);
      };
    },
    () => getAppearanceTheme(userId),
    () => 'light',
  );
}

export const defaultUserPreferences = {
  inAppNotifications: true,
  incidentNotifications: true,
  alertNotifications: true,
  sosNotifications: true,
  responseNotifications: true,
  autoRefreshSeconds: 'off',
  mapDefault: 'standard',
  tableDensity: 'comfortable',
  confirmBeforeClear: true,
  officerAvailability: 'all',
  shareLocation: true,
  confirmSOS: false,
  textSize: 'medium',
};

const preferencesKey = (userId) => `campussecure-preferences:${userId || 'anonymous'}`;

export function getUserPreferences(userId) {
  try {
    return {
      ...defaultUserPreferences,
      ...JSON.parse(localStorage.getItem(preferencesKey(userId)) || '{}'),
    };
  } catch {
    return { ...defaultUserPreferences };
  }
}

export function saveUserPreferences(userId, preferences) {
  localStorage.setItem(preferencesKey(userId), JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent('campussecure:preferences-changed', { detail: { userId } }));
}
