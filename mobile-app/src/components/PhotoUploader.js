import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PhotoUploader = ({ onPhotosSelected, maxPhotos = 5 }) => {
  const [photos, setPhotos] = useState([]);

  const updatePhotos = (nextPhotos) => {
    setPhotos(nextPhotos);
    onPhotosSelected(nextPhotos);
  };

  const chooseFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission required', 'Allow photo access to attach evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maxPhotos - photos.length,
      quality: 0.75,
    });
    if (!result.canceled) updatePhotos([...photos, ...result.assets].slice(0, maxPhotos));
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Allow camera access to take an incident photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (!result.canceled) updatePhotos([...photos, ...result.assets].slice(0, maxPhotos));
  };

  return (
    <View>
      <Text style={styles.label}>Photos (Optional)</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={takePhoto} disabled={photos.length >= maxPhotos}><Icon name="photo-camera" size={20} color="#156B5D" /><Text style={styles.actionText}>Camera</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={chooseFromGallery} disabled={photos.length >= maxPhotos}><Icon name="photo-library" size={20} color="#156B5D" /><Text style={styles.actionText}>Gallery</Text></TouchableOpacity>
      </View>
      <View style={styles.previewRow}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.preview}><Image source={{ uri: photo.uri }} style={styles.image} /><TouchableOpacity style={styles.remove} onPress={() => updatePhotos(photos.filter((_, photoIndex) => photoIndex !== index))} accessibilityLabel="Remove photo"><Icon name="close" size={16} color="#FFF" /></TouchableOpacity></View>)}</View>
      <Text style={styles.hint}>{photos.length}/{maxPhotos} attached. Photos are previewed here and included in the request payload.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 8, color: '#333', fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, borderWidth: 1, borderColor: '#BBDDD3', borderRadius: 8, backgroundColor: '#F2FAF7' },
  actionText: { color: '#156B5D', fontWeight: '600' },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preview: { position: 'relative' },
  image: { width: 76, height: 76, borderRadius: 7 },
  remove: { position: 'absolute', top: 3, right: 3, alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,.65)' },
  hint: { marginTop: 8, color: '#777', fontSize: 12 },
});

export default PhotoUploader;
