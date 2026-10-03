import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { notifyHotelBookingStatusChange } from '../services/hotelBookingNotifications';
import { HOTEL_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';
import { useLanguage } from '../contexts/LanguageContext';

type BookingRow = {
  id: string;
  booking_code: string | null;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  total_price: number;
  host_net_amount: number | null;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  message_to_host: string | null;
  establishment_id: string;
  hotel_establishments?: { title: string } | null;
  room_name?: string;
};

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export default function HotelOwnerBookingsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatPrice } = useCurrency();

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: t('hotelOwner.statusPending'),
      confirmed: t('hotelOwner.statusConfirmed'),
      cancelled: t('hotelOwner.statusCancelled'),
      completed: t('hotelOwner.statusCompleted'),
    };
    return map[s] || s;
  };

  const payStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      unpaid: t('hotelOwner.payUnpaid'),
      paid: t('hotelOwner.payPaid'),
      refunded: t('hotelOwner.payRefunded'),
      waived: t('hotelOwner.payWaived'),
    };
    return map[s] || s;
  };
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const { data: ests, error: e1 } = await supabase
        .from('hotel_establishments')
        .select('id, title')
        .eq('host_id', user.id);
      if (e1) throw e1;
      if (!ests?.length) {
        setRows([]);
        return;
      }
      const ids = ests.map((e) => e.id);
      const titleById = Object.fromEntries(ests.map((e) => [e.id, e.title]));
      const { data, error } = await supabase
        .from('hotel_bookings')
        .select(
          `
          id, booking_code, check_in_date, check_out_date, guests_count,
          total_price, host_net_amount, status, payment_method, payment_status, message_to_host, establishment_id,
          hotel_booking_items ( hotel_room_types ( name ) )
        `,
        )
        .in('establishment_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows(
        ((data as any[]) || []).map((b) => ({
          ...b,
          payment_status: b.payment_status || 'unpaid',
            hotel_establishments: { title: titleById[b.establishment_id] || '' },
          room_name: b.hotel_booking_items?.[0]?.hotel_room_types?.name || '',
        })),
      );
    } catch (e) {
      console.error('HotelOwnerBookings load:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const updateStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    const { error } = await supabase
      .from('hotel_bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'cancelled'
          ? { cancelled_at: new Date().toISOString(), cancelled_by: user?.id }
          : {}),
      })
      .eq('id', id);
    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      notifyHotelBookingStatusChange(id, status).catch(() => {});
      void load();
    }
  };

  const markPaid = (id: string) => {
    Alert.alert('Encaissement', 'Confirmer la réception des espèces ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Marquer payé',
        onPress: async () => {
          const { error } = await supabase
            .from('hotel_bookings')
            .update({
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
              paid_by: user?.id,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', id);
          if (error) Alert.alert(t('common.error'), error.message);
          else void load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('hotelOwner.bookings')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={HOTEL_COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
              <Text style={styles.title}>{t('hotelOwner.bookingsEmpty')}</Text>
              <Text style={styles.text}>{t('hotelOwner.bookingsEmptyDesc')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const unpaid =
              item.payment_method === 'cash' &&
              item.payment_status !== 'paid' &&
              item.status !== 'cancelled';
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate('HotelBookingDetail', {
                    bookingId: item.id,
                    role: 'host',
                  })
                }
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {item.hotel_establishments?.title || t('hotelOwner.establishmentFallback')}
                    </Text>
                    <Text style={styles.cardRoom}>
                      {item.room_name || t('hotel.defaultRoom')}
                    </Text>
                  </View>
                  {item.booking_code ? (
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{item.booking_code}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.cardMeta}>
                  {formatDate(item.check_in_date, language)} → {formatDate(item.check_out_date, language)} ·{' '}
                  {t('hotelOwner.persons', { count: String(item.guests_count) })}
                </Text>

                <View style={styles.badges}>
                  <View
                    style={[
                      styles.badge,
                      item.status === 'confirmed'
                        ? styles.badgeOk
                        : item.status === 'cancelled'
                          ? styles.badgeKo
                          : styles.badgePending,
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                  <View style={[styles.badge, unpaid ? styles.badgeCash : styles.badgePaid]}>
                    <Ionicons
                      name="cash-outline"
                      size={12}
                      color={unpaid ? '#92400e' : '#166534'}
                    />
                    <Text
                      style={[
                        styles.badgeText,
                        { color: unpaid ? '#92400e' : '#166534' },
                      ]}
                    >
                      {payStatusLabel(item.payment_status || 'unpaid')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardPrice}>
                  {formatPrice(
                    item.host_net_amount != null ? item.host_net_amount : item.total_price,
                  )}
                </Text>
                {item.host_net_amount != null &&
                item.host_net_amount !== item.total_price ? (
                  <Text style={styles.cardNetHint}>
                    {t('hotelOwner.youReceive', { amount: formatPrice(item.total_price) })}
                  </Text>
                ) : null}

                {!!item.message_to_host && (
                  <Text style={styles.cardMsg} numberOfLines={2}>
                    {item.message_to_host}
                  </Text>
                )}

                {item.status === 'pending' ? (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => void updateStatus(item.id, 'confirmed')}
                    >
                      <Text style={styles.confirmText}>{t('hotelOwner.confirm')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => void updateStatus(item.id, 'cancelled')}
                    >
                      <Text style={styles.cancelText}>{t('hotelOwner.refuse')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {unpaid && item.status === 'confirmed' ? (
                  <TouchableOpacity
                    style={styles.cashBtn}
                    onPress={() => markPaid(item.id)}
                  >
                    <Ionicons name="cash" size={16} color="#fff" />
                    <Text style={styles.cashBtnText}>{t('hotelOwner.collectCash')}</Text>
                  </TouchableOpacity>
                ) : null}

                <Text style={styles.detailLink}>{t('hotelOwner.viewInvoice')}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  list: { padding: 16, gap: 12 },
  emptyWrap: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { marginTop: 12, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  text: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardRoom: { marginTop: 2, fontSize: 13, color: '#64748b' },
  codeBadge: {
    backgroundColor: HOTEL_COLORS.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeText: { fontSize: 11, fontWeight: '700', color: HOTEL_COLORS.dark },
  cardMeta: { marginTop: 10, fontSize: 13, color: '#475569' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeOk: { backgroundColor: '#dcfce7' },
  badgeKo: { backgroundColor: '#fee2e2' },
  badgeCash: { backgroundColor: '#ffedd5' },
  badgePaid: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  cardPrice: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
    color: HOTEL_COLORS.primary,
  },
  cardNetHint: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  cardMsg: { marginTop: 8, fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '700' },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: { color: '#334155', fontWeight: '700' },
  cashBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: HOTEL_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cashBtnText: { color: '#fff', fontWeight: '700' },
  detailLink: {
    marginTop: 12,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: HOTEL_COLORS.primary,
  },
});
