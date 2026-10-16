jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

jest.mock('../components/ui', () => ({ Icon: () => null }));
jest.mock('../components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children, ...props }) => React.createElement(Text, props, children);
});

import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TestRenderer, { act } from 'react-test-renderer';
import { Switch, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsScreen from './SettingsScreen';
import settingsReducer, { defaultSettings, SETTINGS_STORAGE_KEY } from '../store/settingsSlice';

const authReducer = (state = { user: { role: 'security' } }) => state;

const createStore = (role, locationStatus) => configureStore({
  reducer: { settings: settingsReducer, auth: authReducer },
  preloadedState: {
    settings: {
      preferences: defaultSettings,
      hydrated: true,
      officerLocationStatus: locationStatus,
    },
    auth: { user: { role } },
  },
});

const renderSettings = async (role, locationStatus) => {
  const store = createStore(role, locationStatus);
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <Provider store={store}>
        <SettingsScreen />
      </Provider>,
    );
  });
  return { renderer, store };
};

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.setItem.mockResolvedValue();
});

it('shows officer location state and persists disabling the Share My Location switch', async () => {
  const status = { status: 'permission-denied', message: 'Allow location access.', code: 'LOCATION_PERMISSION_DENIED' };
  const { renderer, store } = await renderSettings('security_officer', status);
  const text = renderer.root.findAllByType(Text).map((item) => item.props.children);
  const shareSwitch = () => renderer.root.findAllByType(Switch)
    .find((item) => item.props.accessibilityLabel === 'Share My Location');

  expect(text).toContain('Location permission denied');
  expect(text).toContain('Allow location access.');
  expect(shareSwitch().props.value).toBe(true);

  await act(async () => {
    shareSwitch().props.onValueChange(false);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(store.getState().settings.preferences.shareLocation).toBe(false);
  expect(shareSwitch().props.value).toBe(false);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...defaultSettings, shareLocation: false }),
  );
  await act(async () => renderer.unmount());
});

it.each([
  ['enabled', 'Location sharing enabled'],
  ['disabled', 'Location sharing disabled'],
])('displays the %s location-sharing state for officers', async (status, expectedLabel) => {
  const { renderer } = await renderSettings('security', { status, message: '', code: null });

  expect(renderer.root.findAllByType(Text).some((item) => item.props.children === expectedLabel)).toBe(true);
  await act(async () => renderer.unmount());
});

it('does not display officer-only sharing status to a student', async () => {
  const { renderer } = await renderSettings('student', { status: 'enabled', message: '', code: null });
  const text = renderer.root.findAllByType(Text).map((item) => item.props.children);
  const shareSwitch = renderer.root.findAllByType(Switch)
    .find((item) => item.props.accessibilityLabel === 'Share location by default');

  expect(shareSwitch).toBeDefined();
  expect(text).not.toContain('Location sharing enabled');
  await act(async () => renderer.unmount());
});