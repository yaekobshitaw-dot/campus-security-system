import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import LocationPicker from '../components/LocationPicker';
import PhotoUploader from '../components/PhotoUploader';
import api from '../services/api';
import { socketService } from '../services/socket';
import { reportIncident } from '../store/incidentSlice';

const ReportIncidentScreen = () => {
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    severity: 'medium',
    latitude: null,
    longitude: null,
    location_name: '',
    building: '',
    room: '',
    floor: '',
    is_anonymous: false,
    photos: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const incidentTypes = [
    { label: 'Fire/Hazard', value: 'fire' },
    { label: 'Medical Emergency', value: 'medical' },
    { label: 'Security Threat', value: 'security_threat' },
    { label: 'Suspicious Package', value: 'suspicious_package' },
    { label: 'Flood/Water Damage', value: 'flood' },
    { label: 'Power Outage', value: 'power_outage' },
    { label: 'Missing Person', value: 'missing_person' },
    { label: 'Assault', value: 'assault' },
    { label: 'Theft', value: 'theft' },
    { label: 'Vandalism', value: 'vandalism' },
    { label: 'Other', value: 'other' },
  ];

  const severityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' },
  ];

  const handleSubmit = async () => {
    if (!formData.type) {
      Alert.alert('Error', 'Please select an incident type');
      return;
    }

    if (!formData.description) {
      Alert.alert('Error', 'Please provide a description');
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post('/incidents', formData);
      const incident = response.data.data;

      socketService.emitEvent('new-incident', incident);
      dispatch(reportIncident(incident));

      Alert.alert(
        '✅ Success',
        'Incident reported successfully. Security has been notified.',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      console.error('Error reporting incident:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to report incident. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderTypeSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Incident Type *</Text>
      <View style={styles.optionsGrid}>
        {incidentTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.optionButton,
              formData.type === type.value && styles.optionSelected,
            ]}
            onPress={() => setFormData({ ...formData, type: type.value })}
          >
            <Text
              style={[
                styles.optionText,
                formData.type === type.value && styles.optionTextSelected,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSeveritySelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Severity</Text>
      <View style={styles.optionsRow}>
        {severityOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.severityButton,
              formData.severity === option.value && styles.severitySelected,
              option.value === 'critical' && styles.severityCritical,
              option.value === 'high' && styles.severityHigh,
              option.value === 'medium' && styles.severityMedium,
              option.value === 'low' && styles.severityLow,
            ]}
            onPress={() => setFormData({ ...formData, severity: option.value })}
          >
            <Text
              style={[
                styles.severityText,
                formData.severity === option.value && styles.severityTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Incident</Text>
        </View>

        {renderTypeSelector()}
        {renderSeveritySelector()}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Description *</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Describe what happened..."
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <LocationPicker
            onLocationSelect={(location) =>
              setFormData({
                ...formData,
                latitude: location.latitude,
                longitude: location.longitude,
                location_name: location.name,
              })
            }
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Building (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Building name"
            value={formData.building}
            onChangeText={(text) => setFormData({ ...formData, building: text })}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.sectionLabel}>Room (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Room number"
              value={formData.room}
              onChangeText={(text) => setFormData({ ...formData, room: text })}
              placeholderTextColor="#999"
            />
          </View>
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.sectionLabel}>Floor (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Floor"
              value={formData.floor}
              onChangeText={(text) => setFormData({ ...formData, floor: text })}
              placeholderTextColor="#999"
            />
          </View>
        </View>

        <View style={styles.section}>
          <PhotoUploader
            onPhotosSelected={(photos) => setFormData({ ...formData, photos })}
            maxPhotos={5}
          />
        </View>

        <View style={styles.anonymousContainer}>
          <TouchableOpacity
            style={styles.anonymousButton}
            onPress={() =>
              setFormData({ ...formData, is_anonymous: !formData.is_anonymous })
            }
          >
            <Icon
              name={formData.is_anonymous ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color="#2196F3"
            />
            <Text style={styles.anonymousText}>Report Anonymously</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.disabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    margin: 4,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  severityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: '#E0E0E0',
  },
  severitySelected: {
    backgroundColor: '#2196F3',
  },
  severityCritical: {
    backgroundColor: '#9C27B0',
  },
  severityHigh: {
    backgroundColor: '#F44336',
  },
  severityMedium: {
    backgroundColor: '#FF9800',
  },
  severityLow: {
    backgroundColor: '#4CAF50',
  },
  severityText: {
    fontSize: 14,
    color: '#333',
  },
  severityTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  halfWidth: {
    flex: 1,
    marginHorizontal: 4,
  },
  anonymousContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  anonymousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  anonymousText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReportIncidentScreen;