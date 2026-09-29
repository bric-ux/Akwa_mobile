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
import { useAuth } from '../services/AuthContext';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import type { MonthlyRentalCandidature } from '../types';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Dossier envoyé',
  viewed: 'Vu par le propriétaire',
  accepted: 'Accepté — visite à organiser',
  rejected: 'Refusé',
};

const STATUS_COLOR: Record<string, string> = {
  sent: '#2563eb',
  viewed: '#7c3aed',
  accepted: '#16a34a',
  rejected: '#dc2626',
};

type Row = MonthlyRentalCandidature & { listing_title?: string; listing_location?: string };

export default function MyMonthlyRentalCandidaturesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { getByTenantId, loading } = useMonthlyRentalCandidatures();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getByTenantId();
    setRows(data);
  }, [getByTenantId]);

  useFocusEffect(
    useCallback(() => {
      if (user) void load();
    }, [user, load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Row }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate('MonthlyRentalListingDetail', { listingId: item.listing_id })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.listing_title || 'Logement'}
        </Text>
        <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[item.status] || '#6b7280'}18` }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || '#6b7280' }]}>
            {STATUS_LABEL[item.status] || item.status}
          </Text>
        </View>
      </View>
      {item.listing_location ? (
        <Text style={styles.location} numberOfLines={1}>
          <Ionicons name="location-outline" size={13} color="#64748b" /> {item.listing_location}
        </Text>
      ) : null}
      <Text style={styles.meta}>
        Envoyé le {new Date(item.created_at).toLocaleDateString('fr-FR')}
        {item.desired_move_in_date
          ? ` · Entrée souhaitée ${new Date(item.desired_move_in_date).toLocaleDateString('fr-FR')}`
          : ''}
      </Text>
      {item.status === 'accepted' ? (
        <Text style={styles.hintSuccess}>
          Le propriétaire a accepté votre dossier. Organisez la visite via la messagerie.
        </Text>
      ) : null}
      {item.status === 'rejected' ? (
        <Text style={styles.hintMuted}>Vous pouvez consulter d'autres annonces sur AkwaHome.</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes candidatures</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={MONTHLY_RENTAL_COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MONTHLY_RENTAL_COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Aucune candidature</Text>
              <Text style={styles.emptyText}>
                Postulez depuis une annonce en bail longue durée pour suivre l'avancement de votre dossier ici.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('Search', { initialRentalType: 'monthly' })}
              >
                <Text style={styles.ctaText}>Rechercher un logement</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  list: { padding: 16, gap: 12 },
  emptyWrap: { flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { marginTop: 8, fontSize: 13, color: '#64748b' },
  meta: { marginTop: 6, fontSize: 12, color: '#94a3b8' },
  hintSuccess: { marginTop: 10, fontSize: 13, color: '#166534', lineHeight: 18 },
  hintMuted: { marginTop: 10, fontSize: 13, color: '#64748b', lineHeight: 18 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 48,
  },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: 20,
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
