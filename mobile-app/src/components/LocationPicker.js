import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getLocation } from '../services/location';
import { colors } from './ui';

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
        {loading ? <ActivityIndicator color={colors.teal} /> : <Icon name="my-location" size={21} color={colors.teal} />}
        <Text style={styles.buttonText}>{loading ? 'Finding your location...' : location ? 'Location attached' : 'Use current location'}</Text>
      </TouchableOpacity>
      {location && <Text style={styles.coordinates}>GPS: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>}
      {!location && <Text style={styles.hint}>Allow location access so responders have useful context.</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 8, color: colors.ink, fontSize: 16, fontWeight: '700' },
  button: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 15, borderWidth: 1, borderColor: '#A9D3C6', borderRadius: 12, backgroundColor: colors.tealSoft },
  buttonText: { color: colors.teal, fontSize: 14, fontWeight: '700' },
  coordinates: { marginTop: 8, color: colors.teal, fontSize: 12 },
  hint: { marginTop: 8, color: '#777', fontSize: 12 },
});

export default LocationPicker;
