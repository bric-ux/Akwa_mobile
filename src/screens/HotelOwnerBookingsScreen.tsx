import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HOTEL_COLORS } from '../constants/colors';

/** Placeholder réservations hôtel — à brancher sur hotel_bookings. */
export default function HotelOwnerBookingsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Réservations</Text>
      </View>
      <View style={styles.center}>
        <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
        <Text style={styles.title}>Réservations hôtel</Text>
        <Text style={styles.text}>
          Les réservations de vos types de chambres apparaîtront ici.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { marginTop: 12, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  text: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
