import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  useAdmin,
  DashboardStats,
  AdminStatsPeriod,
  ADMIN_STATS_PERIODS,
} from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import AdminRecentBookingsSection from '../components/admin/AdminRecentBookingsSection';

type StatRow = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warn' | 'ok';
};

const AdminStatsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getDashboardStats } = useAdmin();
  const getDashboardStatsRef = useRef(getDashboardStats);
  getDashboardStatsRef.current = getDashboardStats;

  const [period, setPeriod] = useState<AdminStatsPeriod>('month');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const loadStats = useCallback(async (nextPeriod: AdminStatsPeriod) => {
    const requestId = ++requestIdRef.current;
    const keepContent = hasLoadedRef.current;
    try {
      if (keepContent) {
        setRefreshing(true);
      } else {
        setLoadingStats(true);
      }
      const data = await getDashboardStatsRef.current(nextPeriod);
      if (requestId !== requestIdRef.current) return;
      setStats(data);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Erreur stats admin:', error);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingStats(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void loadStats(period);
    }, [user, period, loadStats]),
  );

  const onSelectPeriod = (next: AdminStatsPeriod) => {
    if (next === period) return;
    setPeriod(next);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
        </View>
      </SafeAreaView>
    );
  }

  const periodHint =
    period === 'all'
      ? 'depuis le début'
      : (stats?.periodLabel || ADMIN_STATS_PERIODS.find((p) => p.value === period)?.label || '')
          .toLowerCase();

  const inventory: StatRow[] = [
    {
      label: period === 'all' ? 'Utilisateurs inscrits' : 'Nouveaux utilisateurs',
      value: stats?.totalUsers ?? 0,
      hint: period === 'all' ? 'Comptes créés sur AkwaHome' : `Inscrits ${periodHint}`,
    },
    {
      label: period === 'all' ? 'Véhicules' : 'Nouveaux véhicules',
      value: stats?.totalVehicles ?? 0,
      hint: period === 'all' ? 'Annonces véhicules' : `Ajoutés ${periodHint}`,
    },
    {
      label: period === 'all' ? 'Résidences meublées' : 'Nouvelles résidences',
      value: stats?.totalProperties ?? 0,
      hint: period === 'all' ? 'Logements courte durée' : `Ajoutées ${periodHint}`,
    },
    {
      label: period === 'all' ? 'Hôtels' : 'Nouveaux hôtels',
      value: stats?.hotelEstablishmentsTotal ?? 0,
      hint:
        period === 'all'
          ? `${stats?.hotelEstablishmentsActive ?? 0} visibles · ${stats?.queueHotelPending ?? 0} en attente`
          : `Créés ${periodHint}`,
    },
    {
      label: period === 'all' ? 'Bail longue durée' : 'Nouveaux baux longue durée',
      value: stats?.monthlyListingsTotal ?? 0,
      hint:
        period === 'all'
          ? `${stats?.monthlyListingsApproved ?? 0} publiés · ${stats?.queueMonthlyPending ?? 0} en attente`
          : `Créés ${periodHint}`,
    },
  ];

  const activity: StatRow[] = [
    {
      label: 'Réservations résidences',
      value: stats?.totalBookings ?? 0,
      hint: `Créées ${periodHint}`,
    },
    {
      label: 'Réservations hôtels',
      value: stats?.hotelBookingsTotal ?? 0,
      hint: `Créées ${periodHint}`,
    },
    {
      label: 'Revenus confirmés',
      value: formatPrice(stats?.totalRevenue ?? 0),
      hint: `Réservations confirmées ${periodHint}`,
      tone: 'ok',
    },
    {
      label: 'Note moyenne voyageurs',
      value: `${stats?.averageRating ?? 0}/5`,
      hint: period === 'all' ? 'Toutes les notes' : `Avis laissés ${periodHint}`,
    },
  ];

  const toDo: StatRow[] = [
    {
      label: 'Candidatures hôtes à traiter',
      value: stats?.pendingApplications ?? 0,
      hint: 'En attente maintenant',
      tone: (stats?.pendingApplications ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      label: 'Hôtels à modérer',
      value: stats?.queueHotelPending ?? 0,
      hint: 'En attente maintenant',
      tone: (stats?.queueHotelPending ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      label: 'Annonces bail à modérer',
      value: stats?.queueMonthlyPending ?? 0,
      hint: 'En attente maintenant',
      tone: (stats?.queueMonthlyPending ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      label: 'Candidatures locataires (bail)',
      value: stats?.queueMonthlyVisitPending ?? 0,
      hint: 'En attente de réponse maintenant',
      tone: (stats?.queueMonthlyVisitPending ?? 0) > 0 ? 'warn' : 'default',
    },
  ];

  const monthlyFunnel: StatRow[] = [
    {
      label: 'Dossiers envoyés',
      value: stats?.monthlyVisitRequestsTotal ?? 0,
      hint: `Créés ${periodHint}`,
    },
    {
      label: 'Acceptés',
      value: stats?.monthlyVisitRequestsAccepted ?? 0,
      tone: 'ok',
    },
    {
      label: 'Refusés',
      value: stats?.monthlyVisitRequestsRejected ?? 0,
    },
    {
      label: 'En attente de réponse',
      value: stats?.monthlyVisitRequestsPending ?? 0,
      hint: `Sur la période`,
      tone: (stats?.monthlyVisitRequestsPending ?? 0) > 0 ? 'warn' : 'default',
    },
  ];

  const renderBlock = (title: string, subtitle: string, rows: StatRow[]) => (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockSubtitle}>{subtitle}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
          </View>
          <Text
            style={[
              styles.rowValue,
              row.tone === 'warn' && styles.rowValueWarn,
              row.tone === 'ok' && styles.rowValueOk,
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Statistiques</Text>
          <Text style={styles.headerSub}>Suivi d’activité AkwaHome</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => loadStats(period)}
          disabled={loadingStats || refreshing}
        >
          {loadingStats || refreshing ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Ionicons name="refresh" size={20} color="#0f172a" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.periodBar}>
        <Text style={styles.periodLabel}>Période</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodChips}
        >
          {ADMIN_STATS_PERIODS.map((item) => {
            const active = period === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => onSelectPeriod(item.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loadingStats && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {stats?.periodLabel || periodLabelFallback(period)}
            </Text>
            <Text style={styles.summaryText}>
              {stats?.totalUsers ?? 0} utilisateurs · {stats?.totalVehicles ?? 0} véhicules ·{' '}
              {stats?.totalProperties ?? 0} résidences · {stats?.hotelEstablishmentsTotal ?? 0}{' '}
              hôtels · {stats?.monthlyListingsTotal ?? 0} baux ·{' '}
              {formatPrice(stats?.totalRevenue ?? 0)} de revenus
            </Text>
          </View>

          {renderBlock(
            'Inventaire',
            period === 'all'
              ? 'Ce que la plateforme contient'
              : `Créations ${periodHint}`,
            inventory,
          )}
          {renderBlock(
            'Activité & revenus',
            `Réservations et argent générés ${periodHint}`,
            activity,
          )}
          {renderBlock(
            'À traiter',
            'Actions qui attendent l’équipe maintenant (hors filtre)',
            toDo,
          )}
          {renderBlock(
            'Bail longue durée — candidatures',
            `Demandes créées ${periodHint}`,
            monthlyFunnel,
          )}

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Réservations récentes</Text>
            <Text style={styles.blockSubtitle}>
              {period === 'all'
                ? 'Dernières résidences et véhicules'
                : `Sur la période sélectionnée`}
            </Text>
            <AdminRecentBookingsSection items={stats?.recentBookings || []} limit={6} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function periodLabelFallback(period: AdminStatsPeriod): string {
  return ADMIN_STATS_PERIODS.find((p) => p.value === period)?.label || 'Période';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#64748b' },
  loadingText: { marginTop: 10, color: '#64748b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 1 },
  periodBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  periodChips: { gap: 8, paddingRight: 8 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  periodChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  periodChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  periodChipTextActive: { color: '#fff' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40, gap: 14 },
  summaryCard: {
    backgroundColor: '#0f766e',
    borderRadius: 14,
    padding: 16,
  },
  summaryTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  summaryText: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20 },
  block: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  blockTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  blockSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  rowHint: { fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 16 },
  rowValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  rowValueWarn: { color: '#c2410c' },
  rowValueOk: { color: '#15803d' },
});

export default AdminStatsScreen;
