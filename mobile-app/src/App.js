import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏫 Campus Security</Text>
      <Text style={styles.subtitle}>Emergency Response System</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.sosButton}>
          <Text style={styles.sosButtonText}>🆘 SOS</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>📱 Report Incidents</Text>
        <Text style={styles.infoText}>🔔 Real-time Alerts</Text>
        <Text style={styles.infoText}>📍 Location Tracking</Text>
      </View>
      
      <Text style={styles.version}>Version 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 10
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 30
  },
  sosButton: {
    backgroundColor: '#FF1744',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold'
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginVertical: 4
  },
  version: {
    marginTop: 20,
    color: '#999',
    fontSize: 12
  }
});
