import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import { useHotelBookings, type HotelBooking } from '../hooks/useHotelBookings';
import { useHostHotelBookings } from '../hooks/useHostHotelBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import InvoiceDisplay from '../components/InvoiceDisplay';
import { useCurrency } from '../hooks/useCurrency';
import { getCancellationPolicyLabel, getCancellationPolicyText } from '../utils/cancellationPolicy';
import { HOTEL_COLORS } from '../constants/colors';

type Route = RouteProp<RootStackParamList, 'HotelBookingDetails'>;

const HotelBookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { bookingId, viewMode = 'guest' } = route.params;
  const { user } = useAuth();
  const { currency, rates } = useCurrency();
  const { fetchGuestBookingById, fetchHotelBookingById, cancelHotelBooking, loading: guestActionLoading } =
    useHotelBookings();
  const { updateBookingStatus, loading: hostActionLoading } = useHostHotelBookings();

  const [booking, setBooking] = useState<HotelBooking | null>(null);
  const [guestProfile, setGuestProfile] = useState<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  } | null>(null);
  const [hostInfo, setHostInfo] = useState<{
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  } | null>(null);
  const [payment, setPayment] = useState<{ payment_method?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      let data: HotelBooking | null = null;
      if (viewMode === 'guest') {
        data = await fetchGuestBookingById(bookingId);
      } else {
        data = await fetchHotelBookingById(bookingId);
        if (data && data.hotel_establishments?.host_id !== user?.id) {
          data = null;
        }
      }

      if (!data) {
        Alert.alert('Erreur', 'Réservation introuvable');
        navigation.goBack();
        return;
      }

      setBooking(data);

      if (viewMode === 'host' && (data as HotelBooking & { profiles?: typeof guestProfile }).profiles) {
        setGuestProfile((data as HotelBooking & { profiles?: typeof guestProfile }).profiles ?? null);
      } else if (viewMode === 'guest' && data.guest_id) {
        const { data: gp } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, phone')
          .eq('user_id', data.guest_id)
          .maybeSingle();
        setGuestProfile(gp);
      }

      const hostId = data.hotel_establishments?.host_id;
      if (hostId) {
        const { data: hostData } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, email')
          .eq('user_id', hostId)
          .maybeSingle();
        setHostInfo(hostData);
      }

      const { data: pay } = await supabase
        .from('hotel_payments')
        .select('payment_method, status')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPayment(pay);
    } catch (e) {
      console.error('[HotelBookingDetails]', e);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    } finally {
      setLoading(false);
    }
  }, [bookingId, viewMode, fetchGuestBookingById, fetchHotelBookingById, navigation, user?.id]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const nights = useMemo(() => {
    if (!booking) return 0;
    return Math.max(
      1,
      Math.ceil(
        (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
  }, [booking]);

  const invoiceBooking = useMemo(() => {
    if (!booking) return null;
    const items = booking.hotel_booking_items ?? [];
    const first = items[0];
    const totalCleaning = items.reduce((s, i) => s + (i.cleaning_fee || 0) * (i.quantity || 1), 0);
    const taxesPerNight =
      (first as { hotel_room_types?: { taxes_per_night?: number } })?.hotel_room_types?.taxes_per_night || 0;
    const est = booking.hotel_establishments;
    return {
      ...booking,
      properties: {
        title: est?.title,
        address: est?.address || '',
        host_id: est?.host_id,
        cancellation_policy: est?.cancellation_policy || 'flexible',
        price_per_night: first?.price_per_night || 0,
        cleaning_fee: totalCleaning,
        taxes: taxesPerNight,
      },
      guest_profile: guestProfile,
      profiles: guestProfile,
    };
  }, [booking, guestProfile]);

  const formatBookingAmount = (amountXof: number) => {
    const bookingCurrency = (booking?.payment_currency || currency) as 'XOF' | 'EUR' | 'USD';
    const bookingRate =
      Number(booking?.exchange_rate) ||
      (bookingCurrency === 'EUR' ? Number(rates.EUR) : bookingCurrency === 'USD' ? Number(rates.USD) : 0);
    if (bookingCurrency === 'EUR' && bookingRate > 0) {
      return `${(amountXof / bookingRate).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(
      amountXof,
    );
  };

  const getEffectiveStatus = () => {
    if (!booking) return 'pending';
    if (booking.status === 'cancelled' || booking.status === 'completed') return booking.status;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    const checkOut = new Date(booking.check_out_date);
    checkIn.setHours(0, 0, 0, 0);
    checkOut.setHours(0, 0, 0, 0);
    if (checkOut < today) return 'completed';
    if (checkIn <= today && checkOut >= today && booking.status === 'confirmed') return 'in_progress';
    return booking.status;
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: '#f39c12', label: 'En attente' },
    confirmed: { color: '#27ae60', label: 'Confirmée' },
    cancelled: { color: '#e74c3c', label: 'Annulée' },
    completed: { color: '#3498db', label: 'Terminée' },
    in_progress: { color: '#3498db', label: 'En cours' },
  };

  const canGuestCancel = () => {
    if (!booking || viewMode !== 'guest') return false;
    if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    checkIn.setHours(0, 0, 0, 0);
    return checkIn >= today;
  };

  const handleCancel = () => {
    Alert.alert('Annuler la réservation', 'Confirmez-vous l\'annulation de cette réservation ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          const result = await cancelHotelBooking(bookingId);
          if (result.success) {
            Alert.alert('Annulée', 'Votre réservation a été annulée.');
            await loadDetails();
          } else {
            Alert.alert('Erreur', result.error || 'Annulation impossible');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={HOTEL_COLORS.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!booking || !invoiceBooking) return null;

  const effectiveStatus = getEffectiveStatus();
  const badge = statusConfig[effectiveStatus] || { color: '#95a5a6', label: effectiveStatus };
  const isConfirmed =
    booking.status === 'confirmed' || effectiveStatus === 'in_progress' || effectiveStatus === 'completed';
  const policy = booking.hotel_establishments?.cancellation_policy || 'flexible';
  const guestName = guestProfile
    ? `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim()
    : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails réservation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.establishment}>{booking.hotel_establishments?.title || 'Hôtel'}</Text>
          {booking.booking_code ? (
            <Text style={styles.ref}>Réf. {booking.booking_code}</Text>
          ) : null}
          <Text style={styles.dates}>
            {new Date(booking.check_in_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' → '}
            {new Date(booking.check_out_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Text style={styles.meta}>
            {nights} nuit{nights > 1 ? 's' : ''} · {booking.guests_count} voyageur
            {booking.guests_count > 1 ? 's' : ''} · {formatBookingAmount(booking.total_price)}
          </Text>
        </View>

        {(booking.hotel_booking_items ?? []).length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chambres</Text>
            {(booking.hotel_booking_items ?? []).map((item) => (
              <Text key={item.id} style={styles.roomLine}>
                {(item as { hotel_room_types?: { name?: string } }).hotel_room_types?.name || 'Chambre'} ×{' '}
                {item.quantity}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Politique d'annulation</Text>
          <Text style={styles.policyText}>
            <Text style={styles.policyEmphasis}>{getCancellationPolicyLabel(policy, 'property')}</Text>
            {' : '}
            {getCancellationPolicyText(policy, 'property')}
          </Text>
        </View>

        {viewMode === 'host' && guestProfile ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voyageur</Text>
            <Text style={styles.infoValue}>{guestName}</Text>
            {guestProfile.email ? <Text style={styles.infoSub}>{guestProfile.email}</Text> : null}
            {guestProfile.phone ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${guestProfile.phone}`)}>
                <Text style={styles.phoneLink}>{guestProfile.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {viewMode === 'guest' && isConfirmed && hostInfo ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact de l'hôtel</Text>
            <Text style={styles.infoValue}>
              {hostInfo.first_name} {hostInfo.last_name}
            </Text>
            {hostInfo.phone ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${hostInfo.phone}`)}>
                <Text style={styles.phoneLink}>{hostInfo.phone}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {booking.status === 'cancelled' ? (
          <View style={styles.section}>
            <Text style={styles.cancelledTitle}>Réservation annulée</Text>
            {booking.cancellation_reason ? (
              <Text style={styles.infoSub}>Motif : {booking.cancellation_reason}</Text>
            ) : null}
          </View>
        ) : null}

        {isConfirmed && booking.status !== 'cancelled' ? (
          <View style={styles.section}>
            <InvoiceDisplay
              type={viewMode === 'host' ? 'host' : 'traveler'}
              serviceType="hotel"
              booking={invoiceBooking as never}
              pricePerUnit={invoiceBooking.properties?.price_per_night || 0}
              cleaningFee={invoiceBooking.properties?.cleaning_fee || 0}
              taxes={invoiceBooking.properties?.taxes || 0}
              paymentMethod={payment?.payment_method || booking.payment_method || undefined}
              travelerName={guestName}
              travelerEmail={guestProfile?.email}
              travelerPhone={guestProfile?.phone}
              hostName={hostInfo ? `${hostInfo.first_name || ''} ${hostInfo.last_name || ''}`.trim() : undefined}
              hostEmail={hostInfo?.email}
              hostPhone={hostInfo?.phone}
              propertyOrVehicleTitle={booking.hotel_establishments?.title}
            />
          </View>
        ) : null}

        {viewMode === 'guest' && canGuestCancel() ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={guestActionLoading}
          >
            {guestActionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color="#fff" />
                <Text style={styles.cancelBtnText}>Annuler la réservation</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {viewMode === 'host' && booking.status === 'pending' ? (
          <View style={styles.hostActions}>
            <TouchableOpacity
              style={styles.confirmBtn}
              disabled={hostActionLoading}
              onPress={() => {
                Alert.alert('Confirmer', 'Confirmer cette réservation ?', [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Confirmer',
                    onPress: async () => {
                      await updateBookingStatus(bookingId, 'confirmed');
                      await loadDetails();
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.confirmBtnText}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              disabled={hostActionLoading}
              onPress={() => {
                Alert.alert('Refuser', 'Refuser cette réservation ?', [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Refuser',
                    style: 'destructive',
                    onPress: async () => {
                      await updateBookingStatus(bookingId, 'cancelled');
                      await loadDetails();
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.rejectBtnText}>Refuser</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  establishment: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  ref: { fontSize: 13, color: '#64748b', marginTop: 4 },
  dates: { fontSize: 15, color: '#334155', marginTop: 8 },
  meta: { fontSize: 14, color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#0f172a' },
  roomLine: { fontSize: 14, color: '#475569', marginBottom: 4 },
  policyText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  policyEmphasis: { fontWeight: '700' },
  infoValue: { fontSize: 16, fontWeight: '600' },
  infoSub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  phoneLink: { fontSize: 15, color: HOTEL_COLORS.primary, marginTop: 6 },
  cancelledTitle: { fontSize: 16, fontWeight: '700', color: '#e74c3c' },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e74c3c',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hostActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  confirmBtn: {
    flex: 1,
    backgroundColor: HOTEL_COLORS.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#e74c3c', fontWeight: '700' },
});

export default HotelBookingDetailsScreen;
