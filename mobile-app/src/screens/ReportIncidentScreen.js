import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import LocationPicker from '../components/LocationPicker';
import PhotoUploader from '../components/PhotoUploader';
import { Icon, colors } from '../components/ui';
import AppText from '../components/AppText';
import AppTextInput from '../components/AppTextInput';
import api from '../services/api';
import { getFreshLocation, logLocationSubmission, openLocationSettings } from '../services/location';
import { socketService } from '../services/socket';
import { addIncident } from '../store/incidentSlice';
import { useMobileTranslation } from '../utils/translations';
import { useMobileTheme } from '../utils/settingsAppearance';

const Text = AppText;
const TextInput = AppTextInput;

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
  const [submissionStatus, setSubmissionStatus] = useState('');
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const shareLocation = useSelector((state) => state.settings.preferences.shareLocation);
  const t = useMobileTranslation();
  const { colors } = useMobileTheme();

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
    if (submitting) {
      return;
    }

    if (!formData.type) {
      Alert.alert(t('Error'), t('Please select an incident type'));
      return;
    }

    if (!formData.description || !formData.description.trim()) {
      Alert.alert(t('Error'), t('Please provide a description'));
      return;
    }

    try {
      setSubmitting(true);
      let location = null;
      if (shareLocation) {
        setSubmissionStatus('Getting current location...');
        try {
          location = await getFreshLocation();
        } catch (locationError) {
          setSubmissionStatus('');
          Alert.alert(
            t('Current location required'),
            t(locationError?.message || 'Unable to get your current location. Please enable GPS/Location and try again.'),
            [
              { text: t('Cancel'), style: 'cancel' },
              {
                text: t('Try Again'),
                onPress: handleSubmit,
              },
              {
                text: t('Open Settings'),
                onPress: () => {
                  openLocationSettings(locationError?.code).catch(() => {
                    Alert.alert(t('Settings unavailable'), t('Please enable Location/GPS in your device settings and try again.'));
                  });
                },
              },
            ]
          );
          return;
        }
        setSubmissionStatus('Location captured');
        logLocationSubmission('INCIDENT', location);
      }

      const payload = new FormData();
      const safeEntries = {
        ...formData,
        description: formData.description.trim(),
        latitude: location?.latitude ?? (shareLocation ? null : formData.latitude),
        longitude: location?.longitude ?? (shareLocation ? null : formData.longitude),
        location_accuracy: location?.accuracy ?? null,
        location_timestamp: location?.timestamp == null ? null : new Date(location.timestamp).toISOString(),
        location_name: location ? 'Current device location' : (shareLocation ? '' : formData.location_name),
        building: formData.building || '',
        room: formData.room || '',
        floor: formData.floor || '',
      };

      Object.entries(safeEntries).forEach(([key, value]) => {
        if (key === 'photos') return;
        if (value == null || value === '') {
          payload.append(key, '');
          return;
        }
        payload.append(key, String(value));
      });

      const validPhotos = (formData.photos || []).filter((photo) => photo?.uri);
      validPhotos.forEach((photo, index) => {
        payload.append('photos', {
          uri: photo.uri,
          name: photo.fileName || photo.name || `incident-photo-${index}.jpg`,
          type: photo.mimeType || photo.type || 'image/jpeg',
        });
      });

      const response = await api.post('/incidents', payload, {
        timeout: 120000,
      });

      if (!response?.data?.success) {
        throw new Error(response?.data?.message || 'Failed to report incident. Please try again.');
      }

      const incident = response.data.data;
      socketService.emitEvent('new-incident', incident);
      dispatch(addIncident(incident));

      Alert.alert(
        t('Incident reported'),
        t('Incident reported successfully. Security has been notified.'),
        [{ text: t('OK'), onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to report incident. Please try again.';
      Alert.alert(t('Error'), t(message));
    } finally {
      setSubmitting(false);
      setSubmissionStatus('');
    }
  };

  const renderTypeSelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('Incident Type *')}</Text>
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
              {t(type.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSeveritySelector = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{t('Severity')}</Text>
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
              {t(option.label)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Report Incident')}</Text>
        </View>

        {renderTypeSelector()}
        {renderSeveritySelector()}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('Description *')}</Text>
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
            <><Icon name="send" size={20} color="#FFFFFF" /><Text style={styles.submitButtonText}>Submit report</Text></>
          )}
        </TouchableOpacity>
        {submissionStatus ? <Text accessibilityLiveRegion="polite" style={styles.locationStatus}>{submissionStatus}</Text> : null}
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
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.ink,
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
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    margin: 4,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
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
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: '#E0E0E0',
  },
  severitySelected: {
    backgroundColor: colors.teal,
  },
  severityCritical: {
    backgroundColor: '#6B5CA5',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    minHeight: 44,
    paddingHorizontal: 8,
  },
  anonymousText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: colors.teal,
    borderRadius: 13,
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
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
  locationStatus: {
    marginTop: 8,
    color: colors.teal,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default ReportIncidentScreen;