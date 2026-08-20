import { ScrollView, StyleSheet, Text, View } from 'react-native';

const SafetyResourcesScreen = () => (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Safety resources</Text>
    <Text style={styles.intro}>Practical reminders for staying aware and getting help quickly on campus.</Text>
    {[['In an emergency', 'Use SOS for a critical campus incident and contact your local emergency service if you are in immediate danger.'], ['When reporting', 'Share the clearest description you can, choose the right severity, and attach your location when safe to do so.'], ['Stay informed', 'Check Alerts for campus-wide updates and follow the status of incidents you have submitted.']].map(([heading, text]) => <View style={styles.card} key={heading}><Text style={styles.heading}>{heading}</Text><Text style={styles.text}>{text}</Text></View>)}
  </ScrollView>
);

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5F8F7' }, content: { padding: 20, paddingBottom: 35 }, title: { color: '#24343A', fontSize: 27, fontWeight: '700' }, intro: { marginTop: 8, marginBottom: 22, color: '#6E7C7F', fontSize: 14, lineHeight: 20 }, card: { marginBottom: 12, padding: 17, borderRadius: 10, backgroundColor: '#FFF' }, heading: { color: '#156B5D', fontSize: 16, fontWeight: '700' }, text: { marginTop: 7, color: '#657276', fontSize: 13, lineHeight: 20 } });

export default SafetyResourcesScreen;
