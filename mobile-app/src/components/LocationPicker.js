import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getLocation } from '../services/location';

const LocationPicker = ({ onLocationSelect }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      const currentLocation = await getLocation();
      setLocation(currentLocation);
      onLocationSelect({ ...currentLocation, name: 'Current device location' });
    } catch (error) {
      Alert.alert('Location unavailable', error.message || 'Could not determine your current location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>Location</Text>
      <TouchableOpacity style={styles.button} onPress={handleUseCurrentLocation} disabled={loading}>
        {loading ? <ActivityIndicator color="#156B5D" /> : <Icon name="my-location" size={20} color="#156B5D" />}
        <Text style={styles.buttonText}>{loading ? 'Finding your location...' : location ? 'Location attached' : 'Use current location'}</Text>
      </TouchableOpacity>
      {location && <Text style={styles.coordinates}>GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>}
      {!location && <Text style={styles.hint}>Allow location access so responders have useful context.</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 8, color: '#333', fontSize: 16, fontWeight: '600' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, borderColor: '#BBDDD3', borderRadius: 8, backgroundColor: '#F2FAF7' },
  buttonText: { color: '#156B5D', fontSize: 14, fontWeight: '600' },
  coordinates: { marginTop: 8, color: '#156B5D', fontSize: 12 },
  hint: { marginTop: 8, color: '#777', fontSize: 12 },
});

export default LocationPicker;
