import { useNavigation } from '@react-navigation/native';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    Alert.alert('Sign out?', 'You will need to sign in again to access campus security tools.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Profile</Text></View>
      <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text></View><Text style={styles.name}>{user?.name || 'Campus member'}</Text><Text style={styles.email}>{user?.email || ''}</Text><View style={styles.role}><Text style={styles.roleText}>{user?.role || 'student'}</Text></View></View>
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EmergencyContacts')}><Icon name="contacts" size={22} color="#156B5D" /><View><Text style={styles.menuTitle}>Emergency contacts</Text><Text style={styles.menuSub}>Manage people you can call quickly</Text></View><Icon name="chevron-right" size={22} color="#9AA5A7" /></TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Incidents')}><Icon name="assignment" size={22} color="#156B5D" /><View><Text style={styles.menuTitle}>My incidents</Text><Text style={styles.menuSub}>Review submitted reports and statuses</Text></View><Icon name="chevron-right" size={22} color="#9AA5A7" /></TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('SafetyResources')}><Icon name="info-outline" size={22} color="#156B5D" /><View><Text style={styles.menuTitle}>Safety resources</Text><Text style={styles.menuSub}>Guidance for common campus situations</Text></View><Icon name="chevron-right" size={22} color="#9AA5A7" /></TouchableOpacity>
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
  name: { marginTop: 12, color: '#FFF', fontSize: 20, fontWeight: '700' },
  email: { marginTop: 5, color: 'rgba(255,255,255,.65)', fontSize: 13 },
  role: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, backgroundColor: 'rgba(168,223,195,.18)' },
  roleText: { color: '#A8DFC3', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  menu: { marginTop: 18, borderRadius: 12, backgroundColor: '#FFF' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 17, borderBottomWidth: 1, borderBottomColor: '#EDF1F0' },
  menuTitle: { color: '#24343A', fontSize: 14, fontWeight: '600' },
  menuSub: { marginTop: 3, color: '#7A8789', fontSize: 11 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, padding: 14, borderWidth: 1, borderColor: '#F0C5BC', borderRadius: 8, backgroundColor: '#FFF5F2' },
  logoutText: { color: '#C44E3B', fontSize: 14, fontWeight: '700' },
});

export default ProfileScreen;
