jest.setTimeout(30000);

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import ReportIncidentScreen from './ReportIncidentScreen';
import SOSScreen from './SOSScreen';
import api from '../services/api';
import { getFreshLocation } from '../services/location';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: (selector) =>
    selector({
      settings: {
        preferences: {
          shareLocation: true,
          confirmSOS: true,
        },
      },
    }),
}));
jest.mock('../components/LocationPicker', () => () => null);
jest.mock('../components/PhotoUploader', () => () => null);
jest.mock('../components/ui', () => ({
  Icon: () => null,
  colors: { ink: '#000', line: '#ddd', teal: '#008080' },
}));
jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock('../services/location', () => ({
  getFreshLocation: jest.fn(),
  logLocationSubmission: jest.fn(),
  openLocationSettings: jest.fn(),
}));
jest.mock('../services/socket', () => ({
  socketService: { emitEvent: jest.fn() },
}));

const deviceLocation = {
  latitude: 10.1234567,
  longitude: 39.7654321,
  accuracy: 4.2,
  timestamp: 1780000000000,
};

beforeEach(() => {
  jest.clearAllMocks();
  getFreshLocation.mockResolvedValue(deviceLocation);
  api.post.mockResolvedValue({ data: { success: true, data: { incident_id: 'incident-1' } } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('incident submission gets a fresh position and sends the fresh coordinates and metadata', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<ReportIncidentScreen />);
  });

  const theftButton = renderer.root.findAllByType(TouchableOpacity).find((button) =>
    button.findAllByType(Text).some((text) => text.props.children === 'Theft')
  );
  const description = renderer.root.findAllByType(TextInput).find((input) =>
    input.props.placeholder === 'Describe what happened...'
  );
  const submitButton = renderer.root.findAllByType(TouchableOpacity).find((button) =>
    button.findAllByType(Text).some((text) => text.props.children === 'Submit report')
  );

  act(() => theftButton.props.onPress());
  act(() => description.props.onChangeText('A test incident'));
  await act(async () => submitButton.props.onPress());

  expect(getFreshLocation).toHaveBeenCalledTimes(1);
  const body = api.post.mock.calls[0][1];
  expect(body.get('latitude')).toBe(String(deviceLocation.latitude));
  expect(body.get('longitude')).toBe(String(deviceLocation.longitude));
  expect(body.get('location_accuracy')).toBe(String(deviceLocation.accuracy));
  expect(body.get('location_timestamp')).toBe(new Date(deviceLocation.timestamp).toISOString());
});

test('incident is not submitted when a fresh location cannot be obtained', async () => {
  getFreshLocation.mockRejectedValue(new Error('Unable to get your current location. Please enable GPS/Location and try again.'));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<ReportIncidentScreen />);
  });

  const theftButton = renderer.root.findAllByType(TouchableOpacity).find((button) =>
    button.findAllByType(Text).some((text) => text.props.children === 'Theft')
  );
  const description = renderer.root.findAllByType(TextInput).find((input) =>
    input.props.placeholder === 'Describe what happened...'
  );
  const submitButton = renderer.root.findAllByType(TouchableOpacity).find((button) =>
    button.findAllByType(Text).some((text) => text.props.children === 'Submit report')
  );
  act(() => theftButton.props.onPress());
  act(() => description.props.onChangeText('A test incident'));
  await act(async () => submitButton.props.onPress());

  expect(getFreshLocation).toHaveBeenCalledTimes(1);
  expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Current location required',
    'Unable to get your current location. Please enable GPS/Location and try again.',
    expect.any(Array)
  );
});

test('incident at Location A and a later SOS at Location B use separate fresh fixes', async () => {
  const locationA = {
    latitude: 10.1111111,
    longitude: 39.1111111,
    accuracy: 3.1,
    timestamp: 1780000001000,
  };
  const locationB = {
    latitude: 11.2222222,
    longitude: 40.2222222,
    accuracy: 5.2,
    timestamp: 1780000002000,
  };
  getFreshLocation.mockResolvedValueOnce(locationA).mockResolvedValueOnce(locationB);

  let incidentRenderer;
  await act(async () => {
    incidentRenderer = TestRenderer.create(<ReportIncidentScreen />);
  });
  const theftButton = incidentRenderer.root.findAllByType(TouchableOpacity).find((button) =>
    button.findAllByType(Text).some((text) => text.props.children === 'Theft')
  );
  const description = incidentRenderer.root.findAllByType(TextInput).find((input) =>
    input.props.placeholder === 'Describe what happened...'
  );
  const incidentSubmitButton = incidentRenderer.root.findAllByType(TouchableOpacity).find((button) =>
    button.findAllByType(Text).some((text) => text.props.children === 'Submit report')
  );
  act(() => theftButton.props.onPress());
  act(() => description.props.onChangeText('A test incident'));
  await act(async () => incidentSubmitButton.props.onPress());

  const incidentPayload = api.post.mock.calls[0][1];
  expect(incidentPayload.get('latitude')).toBe(String(locationA.latitude));
  expect(incidentPayload.get('longitude')).toBe(String(locationA.longitude));
  expect(incidentPayload.get('location_accuracy')).toBe(String(locationA.accuracy));
  expect(incidentPayload.get('location_timestamp')).toBe(new Date(locationA.timestamp).toISOString());

  let sosRenderer;
  await act(async () => {
    sosRenderer = TestRenderer.create(<SOSScreen />);
  });
  const sosButton = sosRenderer.root.findByProps({ accessibilityLabel: 'Send emergency SOS' });
  act(() => sosButton.props.onPress());
  const confirmation = Alert.alert.mock.calls.find(([title]) => title === 'Send SOS?');
  await act(async () => confirmation[2][1].onPress());

  expect(getFreshLocation).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenNthCalledWith(2, '/incidents/sos', {
    latitude: locationB.latitude,
    longitude: locationB.longitude,
    location_accuracy: locationB.accuracy,
    location_timestamp: new Date(locationB.timestamp).toISOString(),
  }, { timeout: 30000 });
  expect(locationA.latitude).not.toBe(locationB.latitude);
  expect(locationA.longitude).not.toBe(locationB.longitude);
});

test('SOS submission gets a fresh position and sends its coordinates and metadata', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<SOSScreen />);
  });

  const sosButton = renderer.root.findByProps({ accessibilityLabel: 'Send emergency SOS' });
  act(() => sosButton.props.onPress());
  const confirmation = Alert.alert.mock.calls.find(([title]) => title === 'Send SOS?');
  await act(async () => confirmation[2][1].onPress());

  expect(getFreshLocation).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/incidents/sos', {
    latitude: deviceLocation.latitude,
    longitude: deviceLocation.longitude,
    location_accuracy: deviceLocation.accuracy,
    location_timestamp: new Date(deviceLocation.timestamp).toISOString(),
  }, { timeout: 30000 });
});

test('SOS does not submit when fresh location acquisition fails', async () => {
  getFreshLocation.mockRejectedValue(new Error('Unable to get your current location.'));
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<SOSScreen />);
  });

  const sosButton = renderer.root.findByProps({ accessibilityLabel: 'Send emergency SOS' });
  act(() => sosButton.props.onPress());
  const confirmation = Alert.alert.mock.calls.find(([title]) => title === 'Send SOS?');
  await act(async () => confirmation[2][1].onPress());

  expect(api.post).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Current location required',
    'Unable to get your current location.',
    expect.any(Array)
  );
});

