import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

type Nav = StackNavigationProp<RootStackParamList>;

interface HostBookingFinancialAlertsProps {
  bookingId: string;
  bookingType: 'property' | 'vehicle';
}

/**
 * Vue hôte / propriétaire : commission espèces non réglée + pénalités liées à la réservation.
 */
const HostBookingFinancialAlerts: React.FC<HostBookingFinancialAlertsProps> = ({
  bookingId,
  bookingType,
}) => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [commissionPending, setCommissionPending] = useState<{
    amount_due: number;
  } | null>(null);
  const [penaltyRows, setPenaltyRows] = useState<
    { id: string; penalty_amount: number; status: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id || !bookingId) return;
      try {
        const { data: comm } = await supabase
          .from('platform_commission_due')
          .select('id, amount_due, status')
          .eq('host_id', user.id)
          .eq('booking_id', bookingId)
          .eq('booking_type', bookingType)
          .maybeSingle();

        if (!cancelled && comm && comm.status && comm.status !== 'paid') {
          setCommissionPending({ amount_due: Number(comm.amount_due || 0) });
        } else if (!cancelled) {
          setCommissionPending(null);
        }

        let q = supabase
          .from('penalty_tracking')
          .select('id, penalty_amount, status')
          .eq('host_id', user.id);

        if (bookingType === 'property') {
          q = q.eq('booking_id', bookingId);
        } else {
          q = q.eq('vehicle_booking_id', bookingId);
        }

        const { data: pens } = await q;
        if (!cancelled && pens?.length) {
          const relevant = pens.filter(
            (p: { status: string }) =>
              p.status === 'pending' ||
              p.status === 'deducted' ||
              p.status === 'collected_manually'
          );
          setPenaltyRows(relevant);
        } else if (!cancelled) {
          setPenaltyRows([]);
        }
      } catch (e) {
        console.warn('[HostBookingFinancialAlerts]', e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, bookingId, bookingType]);

  if (!commissionPending && penaltyRows.length === 0) return null;

  const formatFcfa = (n: number) =>
    `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

  const penaltyLabel = (status: string) => {
    if (status === 'deducted') return 'déduite de vos revenus';
    if (status === 'pending') return 'à régler';
    if (status === 'collected_manually') return 'encaissée (hors ligne)';
    return status;
  };

  return (
    <View style={styles.wrap}>
      {commissionPending && (
        <TouchableOpacity
          style={styles.commissionBanner}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('Penalties', { initialTab: 'commissions' })
          }
        >
          <Ionicons name="warning" size={22} color="#b91c1c" />
          <View style={styles.bannerTextCol}>
            <Text style={styles.commissionTitle}>
              Commission plateforme non réglée
            </Text>
            <Text style={styles.commissionSub}>
              Montant dû : {formatFcfa(commissionPending.amount_due)} — touchez
              pour ouvrir l’onglet règlement des commissions.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#b91c1c" />
        </TouchableOpacity>
      )}

      {penaltyRows.length > 0 && (
        <View style={styles.penaltyBox}>
          <Text style={styles.penaltyTitle}>Pénalité liée à cette réservation</Text>
          {penaltyRows.map((p) => (
            <View key={p.id} style={styles.penaltyRow}>
              <Text style={styles.penaltyAmount}>{formatFcfa(p.penalty_amount)}</Text>
              <Text style={styles.penaltyMeta}>{penaltyLabel(p.status)}</Text>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => navigation.navigate('Penalties', { initialTab: 'penalties' })}
            style={styles.penaltyLink}
          >
            <Text style={styles.penaltyLinkText}>Voir dans Remboursements & pénalités</Text>
            <Ionicons name="open-outline" size={16} color="#2563eb" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 4, paddingHorizontal: 20, paddingTop: 4 },
  commissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  bannerTextCol: { flex: 1 },
  commissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
    marginBottom: 4,
  },
  commissionSub: { fontSize: 13, color: '#7f1d1d', lineHeight: 18 },
  penaltyBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
  },
  penaltyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  penaltyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  penaltyAmount: { fontSize: 15, fontWeight: '700', color: '#78350f' },
  penaltyMeta: { fontSize: 13, color: '#a16207' },
  penaltyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  penaltyLinkText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
});

export type HostFinancialOverview = {
  commissionDueByBookingId: Record<string, number>;
  penaltiesByBookingId: Record<
    string,
    { id: string; penalty_amount: number; status: string }[]
  >;
};

/** Chargement groupé pour les cartes overview (liste des résas hôte / propriétaire). */
export async function fetchHostFinancialOverviewForBookings(
  userId: string,
  bookingIds: string[],
  bookingType: 'property' | 'vehicle'
): Promise<HostFinancialOverview> {
  const commissionDueByBookingId: Record<string, number> = {};
  const penaltiesByBookingId: HostFinancialOverview['penaltiesByBookingId'] = {};

  if (!userId || bookingIds.length === 0) {
    return { commissionDueByBookingId, penaltiesByBookingId };
  }

  const { data: commRows } = await supabase
    .from('platform_commission_due')
    .select('booking_id, amount_due, status')
    .eq('host_id', userId)
    .eq('booking_type', bookingType)
    .in('booking_id', bookingIds);

  (commRows || []).forEach(
    (r: { booking_id: string; amount_due: unknown; status: string }) => {
      if (r.status !== 'paid') {
        commissionDueByBookingId[r.booking_id] = Number(r.amount_due || 0);
      }
    }
  );

  let penQuery = supabase
    .from('penalty_tracking')
    .select('id, booking_id, vehicle_booking_id, penalty_amount, status')
    .eq('host_id', userId);

  if (bookingType === 'property') {
    penQuery = penQuery.in('booking_id', bookingIds).is('vehicle_booking_id', null);
  } else {
    penQuery = penQuery.in('vehicle_booking_id', bookingIds);
  }

  const { data: penRows } = await penQuery;

  const relevant = (s: string) =>
    s === 'pending' ||
    s === 'deducted' ||
    s === 'collected_manually';

  (penRows || []).forEach(
    (r: {
      id: string;
      booking_id: string | null;
      vehicle_booking_id: string | null;
      penalty_amount: number;
      status: string;
    }) => {
      if (!relevant(r.status)) return;
      const key =
        bookingType === 'property' ? r.booking_id : r.vehicle_booking_id;
      if (!key) return;
      if (!penaltiesByBookingId[key]) penaltiesByBookingId[key] = [];
      penaltiesByBookingId[key].push({
        id: r.id,
        penalty_amount: Number(r.penalty_amount || 0),
        status: r.status,
      });
    }
  );

  return { commissionDueByBookingId, penaltiesByBookingId };
}

export default HostBookingFinancialAlerts;
