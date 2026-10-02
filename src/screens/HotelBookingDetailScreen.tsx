import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import {
  notifyHotelBookingCancelledByGuest,
  notifyHotelBookingStatusChange,
} from '../services/hotelBookingNotifications';
import { HOTEL_COLORS } from '../constants/colors';
import HotelInvoiceCard, { type HotelInvoiceData } from '../components/HotelInvoiceCard';
import type { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'HotelBookingDetail'>;

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + 'T12:00:00');
  const b = new Date(checkOut + 'T12:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function HotelBookingDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const { bookingId, role } = route.params;
  const isHost = role === 'host';

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<HotelInvoiceData | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: booking, error } = await supabase
        .from('hotel_bookings')
        .select(
          `
          id, booking_code, check_in_date, check_out_date, guests_count,
          total_price, host_net_amount, status, payment_method, payment_status, paid_at,
          message_to_host, created_at, guest_id, establishment_id,
          hotel_establishments ( id, title, host_id, address ),
          hotel_booking_items (
            quantity, price_per_night, cleaning_fee, line_total,
            hotel_room_types ( name, taxes_per_night )
          )
        `,
        )
        .eq('id', bookingId)
        .maybeSingle();
      if (error) throw error;
      if (!booking) {
        setInvoice(null);
        setRaw(null);
        return;
      }

      let travelerName: string | undefined;
      if (booking.guest_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', booking.guest_id)
          .maybeSingle();
        if (profile) {
          travelerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
      }

      const item = (booking.hotel_booking_items as any[])?.[0];
      const room = item?.hotel_room_types;
      const est = booking.hotel_establishments as any;
      const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
      const pricePerNight = Number(item?.price_per_night || 0);
      const cleaningFee = Number(item?.cleaning_fee || 0);
      const taxesPerNight = Number(room?.taxes_per_night || 0);
      const taxesTotal = taxesPerNight * nights;
      const nightsLine = pricePerNight * nights;
      const total = Number(booking.total_price || 0);
      const serviceFee = Math.max(0, Math.round(total - nightsLine - taxesTotal - cleaningFee));

      setRaw(booking);
      setInvoice({
        bookingCode: booking.booking_code,
        hotelTitle: est?.title || 'Hôtel',
        roomName: room?.name || 'Chambre',
        checkIn: booking.check_in_date,
        checkOut: booking.check_out_date,
        nights,
        guests: booking.guests_count,
        pricePerNight,
        cleaningFee,
        taxesTotal,
        total,
        serviceFee,
        hostNetAmount:
          (booking as any).host_net_amount != null
            ? Number((booking as any).host_net_amount)
            : null,
        paymentMethod: booking.payment_method,
        paymentStatus: (booking as any).payment_status || 'unpaid',
        status: booking.status,
        travelerName,
        createdAt: booking.created_at,
      });
    } catch (e) {
      console.error('HotelBookingDetail load:', e);
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateBooking = async (
    patch: Record<string, unknown>,
    successMsg: string,
    notifyStatus?: 'confirmed' | 'cancelled',
  ) => {
    setActing(true);
    try {
      const { error } = await supabase
        .from('hotel_bookings')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
      if (notifyStatus) {
        notifyHotelBookingStatusChange(bookingId, notifyStatus).catch(() => {});
      }
      Alert.alert('OK', successMsg);
      await load();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setActing(false);
    }
  };

  const confirm = () =>
    void updateBooking({ status: 'confirmed' }, 'Réservation confirmée.', 'confirmed');
  const refuse = () =>
    Alert.alert('Refuser', 'Refuser cette demande ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: () =>
          void updateBooking(
            {
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.id,
            },
            'Demande refusée.',
            'cancelled',
          ),
      },
    ]);
  const markPaid = () =>
    Alert.alert(
      'Encaissement',
      'Confirmer la réception du paiement en espèces à l’arrivée ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Marquer payé',
          onPress: () =>
            void updateBooking(
              {
                payment_status: 'paid',
                paid_at: new Date().toISOString(),
                paid_by: user?.id,
                status: raw?.status === 'confirmed' ? 'confirmed' : raw?.status,
              },
              'Paiement enregistré.',
            ),
        },
      ],
    );
  const cancelAsGuest = () =>
    Alert.alert('Annuler', 'Annuler votre demande de réservation ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            const { error } = await supabase
              .from('hotel_bookings')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_by: user?.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', bookingId);
            if (error) throw error;
            notifyHotelBookingCancelledByGuest(bookingId).catch(() => {});
            Alert.alert('OK', 'Réservation annulée.');
            await load();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Action impossible');
          } finally {
            setActing(false);
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réservation hôtel</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      ) : !invoice ? (
        <Text style={styles.empty}>Réservation introuvable.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <HotelInvoiceCard data={invoice} variant={isHost ? 'host' : 'traveler'} />

          {raw?.message_to_host ? (
            <View style={styles.msgBox}>
              <Text style={styles.msgLabel}>Message</Text>
              <Text style={styles.msgText}>{raw.message_to_host}</Text>
            </View>
          ) : null}

          {isHost && raw?.status === 'pending' ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnConfirm]}
                onPress={confirm}
                disabled={acting}
              >
                <Text style={styles.btnTextLight}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnRefuse]}
                onPress={refuse}
                disabled={acting}
              >
                <Text style={styles.btnTextDark}>Refuser</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isHost &&
          raw?.payment_method === 'cash' &&
          (raw as any)?.payment_status !== 'paid' &&
          raw?.status !== 'cancelled' ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnCash]}
              onPress={markPaid}
              disabled={acting}
            >
              <Ionicons name="cash" size={18} color="#fff" />
              <Text style={styles.btnTextLight}>Encaisser espèces à l’arrivée</Text>
            </TouchableOpacity>
          ) : null}

          {!isHost && raw?.status === 'pending' ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnRefuse]}
              onPress={cancelAsGuest}
              disabled={acting}
            >
              <Text style={styles.btnTextDark}>Annuler ma demande</Text>
            </TouchableOpacity>
          ) : null}

          {acting ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={HOTEL_COLORS.primary} />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333' },
  empty: { marginTop: 40, textAlign: 'center', color: '#666' },
  content: { padding: 16, paddingBottom: 40 },
  msgBox: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  msgLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  msgText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  btnConfirm: { backgroundColor: '#16a34a', flex: 1, marginTop: 16 },
  btnRefuse: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flex: 1,
    marginTop: 16,
  },
  btnCash: { backgroundColor: HOTEL_COLORS.primary, marginTop: 12 },
  btnTextLight: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextDark: { color: '#334155', fontWeight: '700', fontSize: 15 },
});
