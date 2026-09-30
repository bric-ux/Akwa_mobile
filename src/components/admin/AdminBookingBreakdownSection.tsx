import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StatusCounts = {
  pending?: number;
  confirmed?: number;
  in_progress?: number;
  cancelled?: number;
  completed?: number;
  visit_authorized?: number;
  accepted?: number;
  rejected?: number;
};

export type BookingBreakdown = {
  residences?: StatusCounts;
  vehicles?: StatusCounts;
  hotels?: StatusCounts;
  monthly?: StatusCounts;
};

type Props = {
  breakdown?: BookingBreakdown | null;
};

const ROWS: {
  key: keyof BookingBreakdown;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { key: 'residences', label: 'Résidences meublées', icon: 'home-outline', color: '#c2410c' },
  { key: 'vehicles', label: 'Véhicules', icon: 'car-outline', color: '#1e3a5f' },
  { key: 'hotels', label: 'Hôtels', icon: 'bed-outline', color: '#6d28d9' },
  { key: 'monthly', label: 'Bail longue durée', icon: 'calendar-outline', color: '#0f766e' },
];

export default function AdminBookingBreakdownSection({ breakdown }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Réservations par service</Text>
      {ROWS.map((row) => {
        const data = breakdown?.[row.key] || {};
        const cells =
          row.key === 'monthly'
            ? [
                { label: 'En cours', value: data.pending || 0 },
                { label: 'Visite OK', value: data.visit_authorized || 0 },
                { label: 'Acceptées', value: data.accepted || 0 },
                { label: 'Refusées', value: data.rejected || 0 },
              ]
            : [
                { label: 'Confirmées', value: data.confirmed || 0 },
                { label: 'En cours', value: data.in_progress || 0 },
                { label: 'Annulées', value: data.cancelled || 0 },
                { label: 'Terminées', value: data.completed || 0 },
              ];
        return (
          <View key={row.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: row.color + '18' }]}>
                <Ionicons name={row.icon} size={18} color={row.color} />
              </View>
              <Text style={styles.cardTitle}>{row.label}</Text>
            </View>
            <View style={styles.grid}>
              {cells.map((c) => (
                <View key={c.label} style={styles.cell}>
                  <Text style={styles.cellValue}>{c.value}</Text>
                  <Text style={styles.cellLabel}>{c.label}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 12, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4, paddingHorizontal: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '47%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cellValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  cellLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
});
