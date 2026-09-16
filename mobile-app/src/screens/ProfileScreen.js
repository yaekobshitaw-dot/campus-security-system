import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { logout, removeProfilePhoto, updateProfilePhoto } from '../store/authSlice';

const requestGalleryPermission = async () => {
  if (Platform.OS !== 'android') return true;
  const permission = Platform.Version >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const granted = await PermissionsAndroid.request(permission, {
    title: 'Photos permission required',
    message: 'Campus Security needs access to choose a profile photo.',
    buttonNegative: 'Cancel',
    buttonPositive: 'Allow',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const requestCameraPermission = async () => {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera permission required',
    message: 'Campus Security needs camera access to take a profile photo.',
    buttonNegative: 'Cancel',
    buttonPositive: 'Allow',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const normalizePhoto = (asset) => {
  const fileName = asset.fileName || `profile-photo-${Date.now()}.jpg`;
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const mimeType = asset.type === 'image/jpg' ? 'image/jpeg' : asset.type;
  const fallbackTypes = { '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  return { uri: asset.uri, fileName, mimeType: mimeType?.startsWith('image/') ? mimeType : fallbackTypes[extension] || 'image/jpeg' };
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to access campus security tools.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const choosePhoto = async (source) => {
    const permitted = source === 'camera' ? await requestCameraPermission() : await requestGalleryPermission();
    if (!permitted) {
      Alert.alert('Permission required', `Allow ${source === 'camera' ? 'camera' : 'photo'} access to choose a profile photo.`);
      return;
    }
    try {
      const result = source === 'camera'
        ? await launchCamera({ mediaType: 'photo', quality: 0.8, includeBase64: false })
        : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8, includeBase64: false });
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Photo selection failed', result.errorMessage || 'The device could not open the photo source.');
        return;
      }
      if (result.assets?.[0]?.uri) setSelectedPhoto(normalizePhoto(result.assets[0]));
    } catch (error) {
      Alert.alert('Photo selection failed', error.message || 'The device could not open the photo source.');
    }
  };

  const uploadPhoto = async () => {
    if (!selectedPhoto) return;
    setPhotoLoading(true);
    try {
      await dispatch(updateProfilePhoto(selectedPhoto)).unwrap();
      setSelectedPhoto(null);
      Alert.alert('Profile photo updated', 'Your new photo is now available across Campus Security.');
    } catch (error) {
      Alert.alert('Upload failed', error);
    } finally {
      setPhotoLoading(false);
    }
  };

  const removePhoto = () => Alert.alert('Remove profile photo?', 'Your default avatar will be shown instead.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      setPhotoLoading(true);
      try {
        await dispatch(removeProfilePhoto()).unwrap();
        setSelectedPhoto(null);
      } catch (error) {
        Alert.alert('Remove failed', error);
      } finally {
        setPhotoLoading(false);
      }
    } },
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Profile</Text></View>
      <View style={styles.profileCard}><View style={styles.avatar}>{selectedPhoto?.uri || user?.profile_photo_url ? <Image source={{ uri: selectedPhoto?.uri || user.profile_photo_url }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>}</View><Text style={styles.name}>{user?.name || 'Campus member'}</Text><Text style={styles.email}>{user?.email || ''}</Text><View style={styles.role}><Text style={styles.roleText}>{user?.role || 'student'}</Text></View><View style={styles.photoActions}><TouchableOpacity style={styles.photoAction} onPress={() => choosePhoto('camera')} disabled={photoLoading}><Icon name="photo-camera" size={18} color="#A8DFC3" /><Text style={styles.photoActionText}>Camera</Text></TouchableOpacity><TouchableOpacity style={styles.photoAction} onPress={() => choosePhoto('gallery')} disabled={photoLoading}><Icon name="photo-library" size={18} color="#A8DFC3" /><Text style={styles.photoActionText}>Gallery</Text></TouchableOpacity>{user?.profile_photo_url && <TouchableOpacity style={styles.photoAction} onPress={removePhoto} disabled={photoLoading}><Icon name="delete-outline" size={18} color="#FFD0C5" /><Text style={styles.removeActionText}>Remove</Text></TouchableOpacity>}</View>{selectedPhoto && <TouchableOpacity style={styles.uploadButton} onPress={uploadPhoto} disabled={photoLoading}>{photoLoading ? <ActivityIndicator color="#0A4A42" /> : <><Icon name="cloud-upload" size={18} color="#0A4A42" /><Text style={styles.uploadButtonText}>Upload photo</Text></>}</TouchableOpacity>}</View>
      <View style={styles.menu}>
        <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => navigation.navigate('EmergencyContacts')}><Icon name="contacts" size={22} color="#116B5F" /><View style={styles.menuCopy}><Text style={styles.menuTitle}>Emergency contacts</Text><Text style={styles.menuSub}>Manage people you can call quickly</Text></View><Icon name="chevron-right" size={22} color="#9AA5A7" /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => navigation.navigate('Incidents')}><Icon name="assignment" size={22} color="#116B5F" /><View style={styles.menuCopy}><Text style={styles.menuTitle}>My incidents</Text><Text style={styles.menuSub}>Review submitted reports and statuses</Text></View><Icon name="chevron-right" size={22} color="#9AA5A7" /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.menuItem} onPress={() => navigation.navigate('SafetyResources')}><Icon name="health-and-safety" size={22} color="#116B5F" /><View style={styles.menuCopy}><Text style={styles.menuTitle}>Safety resources</Text><Text style={styles.menuSub}>Guidance for common campus situations</Text></View><Icon name="chevron-right" size={22} color="#9AA5A7" /></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.logout} onPress={handleLogout}><Icon name="logout" size={20} color="#C44E3B" /><Text style={styles.logoutText}>Sign out</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F8F7' },
  header: { paddingTop: 8, paddingBottom: 20 },
  title: { color: '#24343A', fontSize: 26, fontWeight: '700' },
  profileCard: { alignItems: 'center', padding: 24, borderRadius: 12, backgroundColor: '#0A4A42' },
  avatar: { alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: '#A8DFC3' },
  avatarText: { color: '#0A4A42', fontSize: 28, fontWeight: '700' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  name: { marginTop: 12, color: '#FFF', fontSize: 20, fontWeight: '700' },
  email: { marginTop: 5, color: 'rgba(255,255,255,.65)', fontSize: 13 },
  role: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, backgroundColor: 'rgba(168,223,195,.18)' },
  roleText: { color: '#A8DFC3', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  photoAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(168,223,195,.35)', borderRadius: 8 },
  photoActionText: { color: '#A8DFC3', fontSize: 12, fontWeight: '700' },
  removeActionText: { color: '#FFD0C5', fontSize: 12, fontWeight: '700' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 42, marginTop: 12, paddingHorizontal: 16, borderRadius: 9, backgroundColor: '#A8DFC3' },
  uploadButtonText: { color: '#0A4A42', fontSize: 13, fontWeight: '800' },
  menu: { marginTop: 18, borderRadius: 12, backgroundColor: '#FFF' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 70, padding: 14, borderBottomWidth: 1, borderBottomColor: '#EDF1F0' },
  menuCopy: { flex: 1 },
  menuTitle: { color: '#24343A', fontSize: 14, fontWeight: '600' },
  menuSub: { marginTop: 3, color: '#7A8789', fontSize: 11 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, marginTop: 22, paddingHorizontal: 14, borderWidth: 1, borderColor: '#F0C5BC', borderRadius: 12, backgroundColor: '#FFF5F2' },
  logoutText: { color: '#C44E3B', fontSize: 14, fontWeight: '700' },
});

export default ProfileScreen;
