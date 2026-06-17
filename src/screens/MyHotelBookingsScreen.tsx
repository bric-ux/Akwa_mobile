import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { HOTEL_COLORS } from '../constants/colors';
import { useHotelBookings, type HotelBooking } from '../hooks/useHotelBookings';
import { useCurrency } from '../hooks/useCurrency';

const MyHotelBookingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { fetchGuestBookings } = useHotelBookings();
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchGuestBookings();
    setBookings(data);
    setLoading(false);
  }, [fetchGuestBookings]);

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

  const statusLabel = (s: string) => {
    switch (s) {
      case 'confirmed':
        return 'Confirmée';
      case 'pending':
        return 'En attente';
      case 'cancelled':
        return 'Annulée';
      default:
        return s;
    }
  };

  const renderItem = ({ item }: { item: HotelBooking }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('HotelBookingDetails', { bookingId: item.id, viewMode: 'guest' })}
    >
      <Text style={styles.cardTitle}>{item.hotel_establishments?.title || 'Hôtel'}</Text>
      <Text style={styles.cardDates}>
        {item.check_in_date} → {item.check_out_date}
      </Text>
      <Text style={styles.cardMeta}>
        {item.guests_count} voyageur{item.guests_count > 1 ? 's' : ''} · {formatPrice(item.total_price)}
      </Text>
      <View style={[styles.badge, item.status === 'confirmed' && styles.badgeOk]}>
        <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
      </View>
      {item.payment_method ? (
        <Text style={styles.payMethod}>
          Paiement : {item.payment_method === 'cash' ? 'Espèces à l\'arrivée' : item.payment_method}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={HOTEL_COLORS.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Mes réservations hôtel</Text>
      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bed-outline" size={56} color="#cbd5e1" />
          <Text style={styles.title}>Aucune réservation</Text>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Search')}>
            <Text style={styles.ctaText}>Rechercher un hôtel</Text>
          </TouchableOpacity>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    fontSize: 22,
    fontWeight: '800',
    padding: 16,
    color: '#1e293b',
    backgroundColor: '#fff',
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  cardDates: { fontSize: 14, color: '#64748b', marginTop: 4 },
  cardMeta: { fontSize: 14, color: '#475569', marginTop: 6 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeOk: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  payMethod: { fontSize: 12, color: '#64748b', marginTop: 6 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#334155' },
  cta: {
    marginTop: 12,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
});

export default MyHotelBookingsScreen;
