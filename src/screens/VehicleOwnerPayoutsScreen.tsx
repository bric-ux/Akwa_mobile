import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useCurrency } from '../hooks/useCurrency';
import { VEHICLE_COLORS } from '../constants/colors';

interface PayoutRow {
  id: string;
  owner_amount: number;
  admin_payment_status: string;
  admin_paid_at: string | null;
  scheduled_for: string;
  booking: {
    start_date: string;
    end_date: string;
    vehicles: { brand: string; model: string; title?: string } | null;
  } | null;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const VehicleOwnerPayoutsScreen: React.FC = () => {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayouts = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('vehicle_payouts')
        .select(`
          id,
          owner_amount,
          admin_payment_status,
          admin_paid_at,
          scheduled_for,
          booking:vehicle_bookings(
            start_date,
            end_date,
            vehicles:vehicles(brand, model, title)
          )
        `)
        .eq('owner_id', user.id)
        .order('scheduled_for', { ascending: false });

      if (error) throw error;
      setPayouts((data as PayoutRow[]) || []);
    } catch (e) {
      console.error('Erreur chargement paiements propriétaire:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPayouts();
  };

  const pendingCount = payouts.filter((p) => p.admin_payment_status !== 'paid').length;
  const paidCount = payouts.filter((p) => p.admin_payment_status === 'paid').length;
  const totalPending = payouts
    .filter((p) => p.admin_payment_status !== 'paid')
    .reduce((s, p) => s + p.owner_amount, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="wallet" size={28} color={VEHICLE_COLORS.primary} />
        <Text style={styles.title}>Mes paiements</Text>
        <Text style={styles.subtitle}>
          Suivez le versement de vos gains par AkwaHome
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[VEHICLE_COLORS.primary]} />
        }
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statPending]}>
            <Ionicons name="time-outline" size={24} color="#b45309" />
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={styles.statAmount}>{formatPrice(totalPending)}</Text>
          </View>
          <View style={[styles.statCard, styles.statPaid]}>
            <Ionicons name="checkmark-circle" size={24} color="#15803d" />
            <Text style={styles.statValue}>{paidCount}</Text>
            <Text style={styles.statLabel}>Versés</Text>
          </View>
        </View>

        {payouts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyTitle}>Aucun paiement</Text>
            <Text style={styles.emptyText}>
              Vos paiements apparaîtront ici une fois les locations payées par les locataires.
            </Text>
          </View>
        ) : (
          payouts.map((p) => {
            const v = p.booking?.vehicles;
            const title = v ? `${v.brand} ${v.model}` : (v?.title ?? 'Véhicule');
            const adminPaid = p.admin_payment_status === 'paid';
            const dates =
              p.booking?.start_date && p.booking?.end_date
                ? `${formatDate(p.booking.start_date)} - ${formatDate(p.booking.end_date)}`
                : '–';

            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="car" size={22} color={VEHICLE_COLORS.primary} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardDates}>{dates}</Text>
                    <View style={styles.badges}>
                      <View style={[styles.badge, adminPaid ? styles.badgeSuccess : styles.badgeOutline]}>
                        <Text style={[styles.badgeText, adminPaid && styles.badgeTextSuccess]}>
                          {adminPaid ? 'Versé par AkwaHome' : 'En attente de versement'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.amount}>{formatPrice(p.owner_amount)}</Text>
                    {adminPaid && p.admin_paid_at && (
                      <Text style={styles.paidAt}>Versé le {formatDate(p.admin_paid_at)}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  statPending: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  statPaid: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: VEHICLE_COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  cardDates: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: VEHICLE_COLORS.light,
  },
  badgeOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  badgeText: {
    fontSize: 11,
    color: '#475569',
  },
  badgeTextSuccess: {
    color: VEHICLE_COLORS.primary,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 17,
    fontWeight: '700',
    color: VEHICLE_COLORS.primary,
  },
  paidAt: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
});

export default VehicleOwnerPayoutsScreen;
