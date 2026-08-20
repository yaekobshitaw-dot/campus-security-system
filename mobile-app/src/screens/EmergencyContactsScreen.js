import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const STORAGE_KEY = 'emergency_contacts';

const EmergencyContactsScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) setContacts(JSON.parse(stored));
  };

  const saveContacts = async (nextContacts) => {
    setContacts(nextContacts);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextContacts));
  };

  const addContact = async () => {
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (!name.trim() || !/^\+?[0-9]{7,15}$/.test(normalizedPhone)) {
      Alert.alert('Check contact details', 'Enter a name and a valid phone number.');
      return;
    }
    await saveContacts([...contacts, { id: `${Date.now()}`, name: name.trim(), phone: normalizedPhone }]);
    setName('');
    setPhone('');
  };

  const removeContact = (contact) => Alert.alert('Remove contact?', contact.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => saveContacts(contacts.filter((item) => item.id !== contact.id)) }]);
  const callContact = async (contact) => {
    const supported = await Linking.canOpenURL(`tel:${contact.phone}`);
    if (supported) Linking.openURL(`tel:${contact.phone}`);
    else Alert.alert('Calling unavailable', 'This device cannot place phone calls.');
  };

  return <View style={styles.container}><View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Icon name="arrow-back" size={24} color="#24343A" /></TouchableOpacity><Text style={styles.title}>Emergency contacts</Text></View><Text style={styles.intro}>Store trusted contacts locally on this device for quick calling. Do not add sensitive information.</Text><View style={styles.form}><TextInput style={styles.input} placeholder="Contact name" value={name} onChangeText={setName} /><TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><TouchableOpacity style={styles.addButton} onPress={addContact}><Icon name="add" size={20} color="#FFF" /><Text style={styles.addText}>Add contact</Text></TouchableOpacity></View><View style={styles.list}>{contacts.map((contact) => <View style={styles.contact} key={contact.id}><View style={styles.contactIcon}><Icon name="person" size={20} color="#156B5D" /></View><View style={styles.contactCopy}><Text style={styles.contactName}>{contact.name}</Text><Text style={styles.contactPhone}>{contact.phone}</Text></View><TouchableOpacity onPress={() => callContact(contact)} accessibilityLabel={`Call ${contact.name}`}><Icon name="call" size={21} color="#156B5D" /></TouchableOpacity><TouchableOpacity onPress={() => removeContact(contact)} accessibilityLabel={`Remove ${contact.name}`}><Icon name="delete-outline" size={21} color="#C44E3B" /></TouchableOpacity></View>)}</View></View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F5F8F7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 8, paddingBottom: 20 },
  title: { color: '#24343A', fontSize: 22, fontWeight: '700' },
  intro: { marginBottom: 18, color: '#6E7C7F', fontSize: 13, lineHeight: 19 },
  form: { gap: 10, padding: 16, borderRadius: 10, backgroundColor: '#FFF' },
  input: { padding: 12, borderWidth: 1, borderColor: '#DCE8E4', borderRadius: 7, backgroundColor: '#FBFCFC' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 13, borderRadius: 7, backgroundColor: '#156B5D' },
  addText: { color: '#FFF', fontWeight: '700' },
  list: { marginTop: 18, gap: 9 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 9, backgroundColor: '#FFF' },
  contactIcon: { alignItems: 'center', justifyContent: 'center', width: 35, height: 35, borderRadius: 18, backgroundColor: '#E2F3EA' },
  contactCopy: { flex: 1 },
  contactName: { color: '#24343A', fontWeight: '700' },
  contactPhone: { marginTop: 3, color: '#738084', fontSize: 12 },
});

export default EmergencyContactsScreen;
