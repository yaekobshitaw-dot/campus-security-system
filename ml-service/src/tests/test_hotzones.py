import asyncio
import unittest

from src.api.app import calculate_hotzones, detect_hotzones, HotzoneData


class HotzoneCalculationTests(unittest.TestCase):
    def test_hotzones_use_only_real_locations_with_matching_incidents(self):
        locations = [
            {'location_id': 'loc-1', 'name': 'Administration', 'is_active': True},
            {'location_id': 'loc-2', 'name': 'Library', 'is_active': True},
        ]
        incidents = [
            {'location_name': ' administration ', 'type': 'fire'},
            {'building': 'Administration', 'type': 'theft'},
            {'location_name': 'Unknown Place', 'type': 'assault'},
        ]

        self.assertEqual(calculate_hotzones(locations, incidents), [{
            'location_id': 'loc-1',
            'location': 'Administration',
            'risk_score': 0.65,
            'incident_count': 2,
            'incident_types': ['fire', 'theft'],
        }])

    def test_no_matching_incidents_returns_empty_hotzones(self):
        self.assertEqual(
            calculate_hotzones(
                [{'location_id': 'loc-1', 'name': 'Administration', 'is_active': True}],
                [{'location_name': 'Unknown Place', 'type': 'fire'}],
            ),
            [],
        )

    def test_gps_matched_incident_uses_its_campus_location_id(self):
        result = calculate_hotzones(
            [{'location_id': 'loc-1', 'name': 'Administration', 'is_active': True}],
            [{'campus_location_id': 'loc-1', 'location_name': 'Current device location', 'type': 'security_threat'}],
        )

        self.assertEqual(result[0]['location'], 'Administration')
        self.assertEqual(result[0]['incident_count'], 1)
        self.assertEqual(result[0]['incident_types'], ['security_threat'])

    def test_unknown_incident_type_uses_prediction_fallback_risk(self):
        result = calculate_hotzones(
            [{'location_id': 'loc-1', 'name': 'Administration'}],
            [{'location_name': 'Administration', 'type': 'vandalism'}],
        )

        self.assertEqual(result[0]['risk_score'], 0.5)
        self.assertEqual(result[0]['incident_types'], ['vandalism'])

    def test_endpoint_calculates_from_request_data(self):
        result = asyncio.run(detect_hotzones(HotzoneData(
            campus_locations=[{'location_id': 'loc-1', 'name': 'Administration'}],
            incidents=[{'location_name': 'Administration', 'type': 'security_threat'}],
        )))

        self.assertEqual(result['hotzones'][0]['location'], 'Administration')
        self.assertEqual(result['hotzones'][0]['incident_count'], 1)
        self.assertEqual(result['hotzones'][0]['risk_score'], 0.9)


if __name__ == '__main__':
    unittest.main()
