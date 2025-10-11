import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BookingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Réservations</Text>
      <Text style={styles.subtitle}>Fonctionnalité en cours de développement</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
});

export default BookingScreen;

