import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useHostHotels } from '../hooks/useHostHotels';
import { HOTEL_COLORS } from '../constants/colors';
import { getEstablishmentTypeLabel, getHotelCoverUrl } from '../lib/hotelUtils';
import type { HotelEstablishment } from '../types';
import MediaThumb from '../components/MediaThumb';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: '#f59e0b' },
  active: { label: 'Publié', color: '#16a34a' },
  hidden: { label: 'Masqué', color: '#94a3b8' },
};

const MyHotelEstablishmentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { getMyEstablishments, loading } = useHostHotels();
  const [establishments, setEstablishments] = useState<HotelEstablishment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getMyEstablishments();
    setEstablishments(data);
  }, [getMyEstablishments]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: HotelEstablishment }) => {
    const cover = getHotelCoverUrl(item);
    const status = STATUS_LABELS[item.status] ?? STATUS_LABELS.draft;
    const roomCount = item.hotel_room_types?.length ?? 0;
    const location = item.locations?.name || item.address || '';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('HotelEstablishmentManagement', { establishmentId: item.id })
        }
        activeOpacity={0.8}
      >
        <MediaThumb uri={cover} style={styles.cover} resizeMode="cover" />
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.meta}>
            {getEstablishmentTypeLabel(item.establishment_type)}
            {location ? ` • ${location}` : ''}
          </Text>
          <Text style={styles.rooms}>
            {roomCount} type{roomCount !== 1 ? 's' : ''} de chambre
          </Text>
          <View style={[styles.badge, { backgroundColor: status.color }]}>
            <Text style={styles.badgeText}>{status.label}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Ionicons name="bed-outline" size={56} color="#cbd5e1" />
        <Text style={styles.emptyTitle}>Aucun établissement</Text>
        <Text style={styles.emptySubtitle}>
          Créez votre premier hôtel ou appart&apos;hôtel pour commencer à recevoir des réservations.
        </Text>
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => navigation.navigate('AddHotelEstablishment')}
        >
          <Text style={styles.emptyCtaText}>Ajouter un établissement</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes hôtels</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddHotelEstablishment')}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && establishments.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={HOTEL_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={establishments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={establishments.length === 0 ? styles.listEmpty : styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={HOTEL_COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  listEmpty: { flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cover: { width: 72, height: 72, borderRadius: 10 },
  cardBody: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  meta: { fontSize: 13, color: '#64748b' },
  rooms: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#334155' },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    marginTop: 12,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: { color: '#fff', fontWeight: '700' },
});

export default MyHotelEstablishmentsScreen;
