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
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useHostHotels } from '../hooks/useHostHotels';
import { HOTEL_COLORS } from '../constants/colors';
import { getRoomCategoryLabel } from '../constants/hotelListingForm';
import { useCurrency } from '../hooks/useCurrency';
import type { HotelRoomType, RootStackParamList } from '../types';
import MediaThumb from '../components/MediaThumb';

type Route = RouteProp<RootStackParamList, 'HotelRoomTypes'>;

const HotelRoomTypesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { establishmentId } = route.params;
  const { formatPrice } = useCurrency();
  const { getEstablishmentById, loading } = useHostHotels();
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [establishmentTitle, setEstablishmentTitle] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const est = await getEstablishmentById(establishmentId);
    setEstablishmentTitle(est?.title || '');
    setRoomTypes(est?.hotel_room_types ?? []);
  }, [establishmentId, getEstablishmentById]);

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

  const renderItem = ({ item }: { item: HotelRoomType }) => {
    const cover = item.images?.[0] || 'https://via.placeholder.com/80?text=Chambre';
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() =>
            navigation.navigate('EditHotelRoomType', {
              establishmentId,
              roomTypeId: item.id,
            })
          }
        >
          <MediaThumb uri={cover} style={styles.cover} resizeMode="cover" />
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {getRoomCategoryLabel(item.room_category)} • {item.max_guests} pers. •{' '}
              {item.inventory_count} unité{item.inventory_count !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.price}>{formatPrice(item.price_per_night)}/nuit</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: item.status === 'active' ? '#dcfce7' : '#f1f5f9' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: item.status === 'active' ? '#16a34a' : '#64748b' },
                ]}
              >
                {item.status === 'active' ? 'Actif' : 'Masqué'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={() =>
            navigation.navigate('HotelRoomTypeCalendar', {
              roomTypeId: item.id,
              establishmentId,
              roomTypeName: item.name,
            })
          }
        >
          <Ionicons name="calendar-outline" size={22} color={HOTEL_COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Types de chambres</Text>
          {establishmentTitle ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {establishmentTitle}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddHotelRoomType', { establishmentId })}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && roomTypes.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={HOTEL_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={roomTypes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={roomTypes.length === 0 ? styles.listEmpty : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bed-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Aucune chambre</Text>
              <Text style={styles.emptySubtitle}>
                Ajoutez vos types de chambres (ex. Standard, Suite) avec prix et inventaire.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('AddHotelRoomType', { establishmentId })}
              >
                <Text style={styles.emptyCtaText}>Ajouter un type de chambre</Text>
              </TouchableOpacity>
            </View>
          }
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 13, color: '#64748b' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  listEmpty: { flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  calendarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover: { width: 64, height: 64, borderRadius: 8 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  meta: { fontSize: 13, color: '#64748b' },
  price: { fontSize: 14, fontWeight: '600', color: HOTEL_COLORS.primary },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155' },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  emptyCta: {
    marginTop: 12,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: { color: '#fff', fontWeight: '700' },
});

export default HotelRoomTypesScreen;
