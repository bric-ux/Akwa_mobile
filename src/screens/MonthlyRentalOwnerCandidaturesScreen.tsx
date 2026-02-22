import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import type { MonthlyRentalCandidature } from '../types';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';

type CandidatureWithListing = MonthlyRentalCandidature & { listing_title?: string };

const statusLabel = (s: string) => {
  if (s === 'sent') return 'Envoyée';
  if (s === 'viewed') return 'Vue';
  if (s === 'accepted') return 'Acceptée';
  return 'Refusée';
};

const statusColor = (s: string) => {
  if (s === 'sent') return '#f59e0b';
  if (s === 'viewed') return '#1976d2';
  if (s === 'accepted') return '#2E7D32';
  return '#c62828';
};

const MonthlyRentalOwnerCandidaturesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { getByOwnerId, loading } = useMonthlyRentalCandidatures();
  const [candidatures, setCandidatures] = useState<CandidatureWithListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getByOwnerId();
    setCandidatures(data);
  }, [getByOwnerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openListingCandidatures = (listingId: string) => {
    navigation.navigate('MonthlyRentalCandidatures' as never, { listingId });
  };

  const renderItem = ({ item }: { item: CandidatureWithListing }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openListingCandidatures(item.listing_id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.full_name}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      </View>
      {item.listing_title ? (
        <Text style={styles.listingTitle}>{item.listing_title}</Text>
      ) : null}
      <Text style={styles.email}>{item.email}</Text>
      <Text style={styles.date}>
        Candidature du {new Date(item.created_at).toLocaleDateString('fr-FR')}
      </Text>
      <View style={styles.voirRow}>
        <Text style={styles.voirText}>Voir les détails</Text>
        <Ionicons name="chevron-forward" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Candidatures</Text>
        <Text style={styles.headerSubtitle}>
          {candidatures.length} candidature{candidatures.length !== 1 ? 's' : ''} au total
        </Text>
      </View>
      {loading && candidatures.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={MONTHLY_RENTAL_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={candidatures}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={candidatures.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[MONTHLY_RENTAL_COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucune candidature</Text>
              <Text style={styles.emptySubtitle}>
                Les demandes sur vos logements apparaîtront ici.
              </Text>
            </View>
          }
        />
      )}
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  listingTitle: {
    fontSize: 13,
    color: MONTHLY_RENTAL_COLORS.primary,
    marginBottom: 4,
  },
  email: { fontSize: 14, color: '#555', marginBottom: 4 },
  date: { fontSize: 12, color: '#888', marginBottom: 8 },
  voirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  voirText: {
    fontSize: 14,
    color: MONTHLY_RENTAL_COLORS.primary,
    fontWeight: '500',
    marginRight: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
});

export default MonthlyRentalOwnerCandidaturesScreen;
