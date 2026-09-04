import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const AlertDetailScreen = ({ route, navigation }) => {
  const alert = route.params?.alert || {};
  return <View style={styles.container}><View style={styles.header}><TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back"><Icon name="arrow-back" size={22} color="#24343A" /></TouchableOpacity><Text style={styles.title}>Alert details</Text></View><View style={styles.card}><View style={styles.iconWrap}><Icon name="notifications-active" size={30} color="#116B5F" /></View><Text style={styles.alertTitle}>{alert.title || 'Campus security alert'}</Text><Text style={styles.message}>{alert.message || 'No additional alert details are available.'}</Text><Text style={styles.date}>{alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recently'}</Text></View></View>;
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F4F8F7' }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 24, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#DCE9E5' }, backButton: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }, title: { color: '#17313A', fontSize: 23, fontWeight: '700' }, card: { margin: 16, padding: 22, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE9E5', elevation: 2 }, iconWrap: { alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 29, backgroundColor: '#E6F3EF' }, alertTitle: { marginTop: 18, color: '#17313A', fontSize: 22, fontWeight: '700' }, message: { marginTop: 12, color: '#657276', fontSize: 15, lineHeight: 22 }, date: { marginTop: 20, color: '#8A9698', fontSize: 12 } });

export default AlertDetailScreen;
