import { useState } from 'react';
import { Alert, Image, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './ui';

const getImageMimeType = (photo, fileName) => {
  if (typeof photo?.type === 'string' && photo.type.startsWith('image/')) {
    return photo.type;
  }

  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const mimeTypes = {
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };

  return mimeTypes[extension] || 'image/jpeg';
};

const normalizePhoto = (photo, index) => {
  const fileName = photo?.fileName || photo?.name || `incident-photo-${index}.jpg`;
  return {
    uri: photo?.uri,
    fileName,
    mimeType: getImageMimeType(photo, fileName),
  };
};

const requestCameraPermission = async () => {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera permission required',
    message: 'Campus Security needs camera access to take an incident photo.',
    buttonNeutral: 'Ask Later',
    buttonNegative: 'Cancel',
    buttonPositive: 'Allow',
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const requestGalleryPermission = async () => {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, {
    title: 'Photos permission required',
    message: 'Campus Security needs access to your photo library to attach evidence.',
    buttonNeutral: 'Ask Later',
    buttonNegative: 'Cancel',
    buttonPositive: 'Allow',
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const PhotoUploader = ({ onPhotosSelected, maxPhotos = 5 }) => {
  const [photos, setPhotos] = useState([]);

  const updatePhotos = (nextPhotos) => {
    const dedupedPhotos = nextPhotos.filter((photo, index, arr) => {
      const currentUri = photo?.uri;
      return typeof currentUri === 'string' && arr.findIndex((candidate) => candidate?.uri === currentUri) === index;
    });

    setPhotos(dedupedPhotos);
    onPhotosSelected(dedupedPhotos);
  };

  const chooseFromGallery = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Photo limit reached', `You can attach up to ${maxPhotos} photos.`);
      return;
    }

    const granted = await requestGalleryPermission();
    if (!granted) {
      Alert.alert('Photos permission required', 'Allow photo access to attach evidence.');
      return;
    }

    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: Math.max(0, maxPhotos - photos.length),
      quality: 0.75,
      includeBase64: false,
    });

    if (result.didCancel || !result.assets?.length) {
      return;
    }

    const selected = result.assets.map((asset, index) => normalizePhoto(asset, index));
    updatePhotos([...photos, ...selected].slice(0, maxPhotos));
  };

  const takePhoto = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Photo limit reached', `You can attach up to ${maxPhotos} photos.`);
      return;
    }

    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert('Camera permission required', 'Allow camera access to take an incident photo.');
      return;
    }

    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.75,
      includeBase64: false,
    });

    if (result.didCancel || !result.assets?.length) {
      return;
    }

    const selected = result.assets.map((asset, index) => normalizePhoto(asset, index));
    updatePhotos([...photos, ...selected].slice(0, maxPhotos));
  };

  return (
    <View>
      <Text style={styles.label}>Photos (Optional)</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={takePhoto} disabled={photos.length >= maxPhotos}><Icon name="photo-camera" size={21} color={colors.teal} /><Text style={styles.actionText}>Camera</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={chooseFromGallery} disabled={photos.length >= maxPhotos}><Icon name="photo-library" size={21} color={colors.teal} /><Text style={styles.actionText}>Gallery</Text></TouchableOpacity>
      </View>
      <View style={styles.previewRow}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.preview}><Image source={{ uri: photo.uri }} style={styles.image} /><TouchableOpacity style={styles.remove} onPress={() => updatePhotos(photos.filter((_, photoIndex) => photoIndex !== index))} accessibilityLabel="Remove photo"><Icon name="close" size={16} color="#FFF" /></TouchableOpacity></View>)}</View>
      <Text style={styles.hint}>{photos.length}/{maxPhotos} attached. Photos are previewed here and included in the request payload.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 8, color: colors.ink, fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#A9D3C6', borderRadius: 12, backgroundColor: colors.tealSoft },
  actionText: { color: colors.teal, fontWeight: '700' },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preview: { position: 'relative' },
  image: { width: 76, height: 76, borderRadius: 7 },
  remove: { position: 'absolute', top: 3, right: 3, alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,.65)' },
  hint: { marginTop: 8, color: '#777', fontSize: 12 },
});

export default PhotoUploader;
