import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { HOTEL_COLORS } from '../constants/colors';
import { useHostHotelBookings } from '../hooks/useHostHotelBookings';
import type { HotelBooking } from '../hooks/useHotelBookings';
import { useCurrency } from '../hooks/useCurrency';

const HostHotelBookingsScreen: React.FC = () => {
  const { fetchHostBookings, updateBookingStatus, loading } = useHostHotelBookings();
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchHostBookings();
    setBookings(data);
    setListLoading(false);
  }, [fetchHostBookings]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleConfirm = (id: string) => {
    Alert.alert('Confirmer', 'Confirmer cette réservation ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          await updateBookingStatus(id, 'confirmed');
          await load();
        },
      },
    ]);
  };

  const handleReject = (id: string) => {
    Alert.alert('Refuser', 'Refuser cette réservation ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          await updateBookingStatus(id, 'cancelled');
          await load();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: HotelBooking }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.hotel_establishments?.title || 'Établissement'}</Text>
      <Text style={styles.cardDates}>
        {item.check_in_date} → {item.check_out_date}
      </Text>
      <Text style={styles.cardMeta}>
        {item.guests_count} voyageur{item.guests_count > 1 ? 's' : ''} · {formatPrice(item.total_price)}
      </Text>
      <Text style={styles.status}>Statut : {item.status}</Text>
      {item.payment_method ? (
        <Text style={styles.pay}>Paiement : {item.payment_method}</Text>
      ) : null}
      {item.status === 'pending' ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(item.id)}>
            <Text style={styles.confirmText}>Confirmer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
            <Text style={styles.rejectText}>Refuser</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  if (listLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={HOTEL_COLORS.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Réservations hôtel</Text>
      </View>
      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Aucune réservation</Text>
          <Text style={styles.emptySub}>Les demandes de vos établissements apparaîtront ici.</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
      {loading ? <ActivityIndicator style={styles.overlay} color={HOTEL_COLORS.primary} /> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardDates: { fontSize: 14, color: '#64748b', marginTop: 4 },
  cardMeta: { fontSize: 14, color: '#475569', marginTop: 6 },
  status: { fontSize: 13, fontWeight: '600', marginTop: 8, color: '#334155' },
  pay: { fontSize: 12, color: '#64748b', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  confirmBtn: {
    flex: 1,
    backgroundColor: HOTEL_COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '700' },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectText: { color: '#dc2626', fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  overlay: { position: 'absolute', bottom: 24, alignSelf: 'center' },
});

export default HostHotelBookingsScreen;
