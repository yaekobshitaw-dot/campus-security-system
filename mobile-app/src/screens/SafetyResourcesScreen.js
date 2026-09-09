import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const SafetyResourcesScreen = () => (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Safety resources</Text>
    <Text style={styles.intro}>Practical reminders for staying aware and getting help quickly on campus.</Text>
    {[['emergency', 'In an emergency', 'Use SOS for a critical campus incident and contact your local emergency service if you are in immediate danger.'], ['assignment', 'When reporting', 'Share the clearest description you can, choose the right severity, and attach your location when safe to do so.'], ['notifications-active', 'Stay informed', 'Check Alerts for campus-wide updates and follow the status of incidents you have submitted.']].map(([icon, heading, text]) => <View style={styles.card} key={heading}><View style={styles.cardHeading}><View style={styles.icon}><Icon name={icon} size={20} color="#116B5F" /></View><Text style={styles.heading}>{heading}</Text></View><Text style={styles.text}>{text}</Text></View>)}
  </ScrollView>
);

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#40305a' }, content: { padding: 20, paddingBottom: 35 }, title: { color: '#17313A', fontSize: 27, fontWeight: '700' }, intro: { marginTop: 8, marginBottom: 22, color: '#6E7C7F', fontSize: 14, lineHeight: 20 }, card: { marginBottom: 12, padding: 17, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE9E5', elevation: 1 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 11, backgroundColor: '#E6F3EF' }, heading: { color: '#116B5F', fontSize: 16, fontWeight: '700' }, text: { marginTop: 10, color: '#657276', fontSize: 13, lineHeight: 20 } });

export default SafetyResourcesScreen;
