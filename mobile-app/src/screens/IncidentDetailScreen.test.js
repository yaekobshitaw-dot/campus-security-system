jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn() },
}));

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) => selector({ incidents: { incidents: [] } }),
}));

jest.mock('../components/ui', () => ({ Icon: () => null }));
jest.mock('../services/socket', () => ({ socketService: { on: jest.fn(), off: jest.fn() } }));
jest.mock('../config/server', () => ({ getServerBaseUrl: () => 'https://api.example' }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import IncidentDetailScreen from './IncidentDetailScreen';
import { updateIncident } from '../store/incidentSlice';

const mockDispatch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue('access-token');
  api.get.mockResolvedValue({ data: { data: {
    incident_id: 'incident-1',
    type: 'theft',
    description: 'Saved incident details',
    photos: ['/api/incidents/incident-1/evidence/photo.png'],
  } } });
});

test('fetches the current incident and displays protected evidence after refresh', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<IncidentDetailScreen route={{ params: { id: 'incident-1' } }} navigation={{ goBack: jest.fn() }} />);
  });

  expect(api.get).toHaveBeenCalledWith('/incidents/incident-1');
  expect(mockDispatch).toHaveBeenCalledWith(updateIncident(expect.objectContaining({ incident_id: 'incident-1' })));
  expect(renderer.root.findAllByType(Text).some((text) => text.props.children === 'Saved incident details')).toBe(true);
  const image = renderer.root.findByType(Image);
  expect(image.props.source).toEqual({
    uri: 'https://api.example/api/incidents/incident-1/evidence/photo.png',
    headers: { Authorization: 'Bearer access-token' },
  });
  await act(async () => renderer.unmount());
});
