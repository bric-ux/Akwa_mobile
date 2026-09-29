import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMonthlyRentalListings } from '../hooks/useMonthlyRentalListings';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';

const MonthlyRentalStatsScreen: React.FC = () => {
  const { user } = useAuth();
  const { getMyListings } = useMonthlyRentalListings(user?.id);
  const { getByOwnerId } = useMonthlyRentalCandidatures();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalListings, setTotalListings] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [candidaturesTotal, setCandidaturesTotal] = useState(0);
  const [candidaturesSent, setCandidaturesSent] = useState(0);
  const [candidaturesViewed, setCandidaturesViewed] = useState(0);
  const [candidaturesAccepted, setCandidaturesAccepted] = useState(0);
  const [candidaturesRejected, setCandidaturesRejected] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const [listings, candidatures] = await Promise.all([
      getMyListings(),
      getByOwnerId(),
    ]);
    setTotalListings(listings.length);
    const views = listings.reduce((sum, l) => sum + ((l as { view_count?: number }).view_count ?? 0), 0);
    setTotalViews(views);
    setCandidaturesTotal(candidatures.length);
    setCandidaturesSent(candidatures.filter((c) => c.status === 'sent').length);
    setCandidaturesViewed(candidatures.filter((c) => c.status === 'viewed').length);
    setCandidaturesAccepted(candidatures.filter((c) => c.status === 'accepted').length);
    setCandidaturesRejected(candidatures.filter((c) => c.status === 'rejected').length);
  }, [user, getMyListings, getByOwnerId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const StatCard = ({
    icon,
    label,
    value,
    color = MONTHLY_RENTAL_COLORS.primary,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: number | string;
    color?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (loading && totalListings === 0 && candidaturesTotal === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistiques</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={MONTHLY_RENTAL_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistiques</Text>
        <Text style={styles.headerSubtitle}>Vues et candidatures sur vos logements</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[MONTHLY_RENTAL_COLORS.primary]}
          />
        }
      >
        <Text style={styles.sectionTitle}>Vues sur les annonces</Text>
        <View style={styles.row}>
          <StatCard
            icon="eye"
            label="Total vues"
            value={totalViews}
          />
          <StatCard
            icon="business"
            label="Logements"
            value={totalListings}
          />
        </View>

        <Text style={styles.sectionTitle}>Candidatures</Text>
        <View style={styles.row}>
          <StatCard
            icon="people"
            label="Total"
            value={candidaturesTotal}
          />
          <StatCard
            icon="mail-unread"
            label="En attente"
            value={candidaturesSent}
            color="#f59e0b"
          />
        </View>
        <View style={styles.row}>
          <StatCard
            icon="eye"
            label="Vues par vous"
            value={candidaturesViewed}
            color="#1976d2"
          />
          <StatCard
            icon="checkmark-circle"
            label="Acceptées"
            value={candidaturesAccepted}
            color="#2E7D32"
          />
          <StatCard
            icon="close-circle"
            label="Refusées"
            value={candidaturesRejected}
            color="#c62828"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    width: '50%',
    padding: 6,
    marginBottom: 8,
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 2 },
});

export default MonthlyRentalStatsScreen;
