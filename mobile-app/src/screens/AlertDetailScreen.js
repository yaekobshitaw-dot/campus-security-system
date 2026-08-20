import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const AlertDetailScreen = ({ route, navigation }) => {
  const alert = route.params?.alert || {};
  return <View style={styles.container}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color="#24343A" /></TouchableOpacity><Text style={styles.title}>Alert details</Text></View><View style={styles.card}><Icon name="notifications-active" size={35} color="#156B5D" /><Text style={styles.alertTitle}>{alert.title || 'Campus security alert'}</Text><Text style={styles.message}>{alert.message || 'No additional alert details are available.'}</Text><Text style={styles.date}>{alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Recently'}</Text></View></View>;
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5F8F7' }, header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, paddingTop: 24, backgroundColor: '#FFF' }, title: { color: '#24343A', fontSize: 23, fontWeight: '700' }, card: { margin: 16, padding: 22, borderRadius: 11, backgroundColor: '#FFF' }, alertTitle: { marginTop: 18, color: '#24343A', fontSize: 22, fontWeight: '700' }, message: { marginTop: 12, color: '#657276', fontSize: 15, lineHeight: 22 }, date: { marginTop: 20, color: '#8A9698', fontSize: 12 } });

export default AlertDetailScreen;
