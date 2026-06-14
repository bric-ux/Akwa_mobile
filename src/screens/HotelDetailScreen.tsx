import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { HotelEstablishment, HotelRoomType, RootStackParamList } from '../types';
import { useHotels } from '../hooks/useHotels';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../services/AuthContext';
import { HOTEL_COLORS } from '../constants/colors';
import {
  getEstablishmentLocationLabel,
  getEstablishmentTypeLabel,
  getHotelGalleryUrls,
  getActiveRoomTypes,
} from '../lib/hotelUtils';
import { getRoomCategoryLabel } from '../constants/hotelListingForm';
import { safeGoBack } from '../utils/navigation';
import { sanitizePublicDescription } from '../utils/sanitizePublicDescription';

type HotelDetailsRoute = RouteProp<RootStackParamList, 'HotelDetails'>;
const { width } = Dimensions.get('window');

const HotelDetailScreen: React.FC = () => {
  const route = useRoute<HotelDetailsRoute>();
  const navigation = useNavigation<any>();
  const { establishmentId } = route.params;
  const { getEstablishmentById } = useHotels();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();

  const [establishment, setEstablishment] = useState<HotelEstablishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getEstablishmentById(establishmentId);
    setEstablishment(data);
    setLoading(false);
  }, [establishmentId, getEstablishmentById]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBook = () => {
    if (!establishment) return;
    if (!user) {
      navigation.navigate('Auth', {
        returnTo: 'HotelDetails',
        returnParams: { establishmentId: establishment.id },
      });
      return;
    }

    const activeRooms = getActiveRoomTypes(establishment.hotel_room_types);
    if (activeRooms.length === 0) {
      Alert.alert('Indisponible', 'Aucune chambre n\'est disponible à la réservation pour le moment.');
      return;
    }

    const goToRoom = (roomTypeId: string) => {
      navigation.navigate('HotelRoomDetail', {
        establishmentId: establishment.id,
        roomTypeId,
        openBooking: true,
      });
    };

    if (activeRooms.length === 1) {
      goToRoom(activeRooms[0].id);
      return;
    }

    Alert.alert(
      'Choisir une chambre',
      'Sélectionnez le type de chambre que vous souhaitez réserver.',
      [
        ...activeRooms.map((room) => ({
          text: room.name,
          onPress: () => goToRoom(room.id),
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={HOTEL_COLORS.primary} />
      </View>
    );
  }

  if (!establishment) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack(navigation)}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.notFound}>Établissement introuvable</Text>
      </SafeAreaView>
    );
  }

  const gallery = getHotelGalleryUrls(establishment);
  const location = getEstablishmentLocationLabel(establishment);
  const activeRooms = getActiveRoomTypes(establishment.hotel_room_types);
  const bookLabel =
    activeRooms.length > 1 ? 'Choisir une chambre' : activeRooms.length === 1 ? 'Réserver' : 'Indisponible';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.galleryWrap}>
          <Image source={{ uri: gallery[imageIndex] }} style={styles.galleryImage} contentFit="cover" />
          <SafeAreaView style={styles.galleryOverlay} edges={['top']}>
            <TouchableOpacity style={styles.backBtnFloating} onPress={() => safeGoBack(navigation)}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
          {gallery.length > 1 ? (
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setImageIndex(i)}>
                  <View style={[styles.dot, i === imageIndex && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>
              {getEstablishmentTypeLabel(establishment.establishment_type)}
            </Text>
          </View>
          <Text style={styles.title}>{establishment.title}</Text>
          {location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color="#64748b" />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          ) : null}

          {establishment.description ? (
            <Text style={styles.description}>
              {sanitizePublicDescription(establishment.description)}
            </Text>
          ) : null}

          <Text style={styles.sectionTitle}>Types de chambres</Text>
          <Text style={styles.sectionHint}>Appuyez sur une chambre pour voir photos et équipements</Text>
          {(establishment.hotel_room_types ?? []).map((room) => (
            <RoomTypeCard
              key={room.id}
              room={room}
              formatPrice={formatPrice}
              onPress={() =>
                navigation.navigate('HotelRoomDetail', {
                  establishmentId: establishment.id,
                  roomTypeId: room.id,
                })
              }
            />
          ))}

          {(establishment.amenities?.length ?? 0) > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Équipements</Text>
              <View style={styles.amenitiesWrap}>
                {establishment.amenities!.slice(0, 8).map((a) => (
                  <View key={a} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, activeRooms.length === 0 && styles.bookBtnDisabled]}
          onPress={handleBook}
          disabled={activeRooms.length === 0}
        >
          <Text style={styles.bookBtnText}>{bookLabel}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

function RoomTypeCard({
  room,
  formatPrice,
  onPress,
}: {
  room: HotelRoomType;
  formatPrice: (n: number) => string;
  onPress: () => void;
}) {
  const cover = room.images?.[0];
  const photoCount = room.images?.filter(Boolean).length ?? 0;
  return (
    <TouchableOpacity style={styles.roomCard} onPress={onPress} activeOpacity={0.85}>
      {cover ? (
        <View>
          <Image source={{ uri: cover }} style={styles.roomImage} contentFit="cover" />
          {photoCount > 1 ? (
            <View style={styles.photoCountBadge}>
              <Ionicons name="images-outline" size={10} color="#fff" />
              <Text style={styles.photoCountText}>{photoCount}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.roomImage, styles.roomImagePlaceholder]}>
          <Ionicons name="bed-outline" size={28} color="#94a3b8" />
        </View>
      )}
      <View style={styles.roomBody}>
        {room.room_category ? (
          <Text style={styles.roomCategory}>{getRoomCategoryLabel(room.room_category)}</Text>
        ) : null}
        <Text style={styles.roomName}>{room.name}</Text>
        <Text style={styles.roomMeta}>
          {room.max_guests} pers. · {room.bedrooms} ch. · {room.bathrooms} sdb
        </Text>
        {(room.amenities?.length ?? 0) > 0 ? (
          <Text style={styles.roomAmenitiesPreview} numberOfLines={1}>
            {room.amenities!.slice(0, 3).join(' · ')}
            {(room.amenities?.length ?? 0) > 3 ? '…' : ''}
          </Text>
        ) : null}
        <Text style={styles.roomPrice}>
          {formatPrice(room.price_per_night)}
          <Text style={styles.roomPriceSuffix}>/nuit</Text>
        </Text>
        <Text style={styles.roomStock}>{room.inventory_count} disponible(s)</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={styles.roomChevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#64748b' },
  backBtn: { margin: 16 },
  galleryWrap: { height: 280, backgroundColor: '#e2e8f0' },
  galleryImage: { width: '100%', height: '100%' },
  galleryOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  backBtnFloating: {
    margin: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  content: { padding: 16, paddingBottom: 100 },
  typePill: {
    alignSelf: 'flex-start',
    backgroundColor: HOTEL_COLORS.light,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  typePillText: { color: HOTEL_COLORS.primary, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 14, color: '#64748b' },
  description: { fontSize: 15, color: '#475569', lineHeight: 22, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 20, marginBottom: 10 },
  sectionHint: { fontSize: 13, color: '#94a3b8', marginTop: -6, marginBottom: 10 },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  roomImage: { width: 96, height: 110 },
  roomImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  photoCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  roomBody: { flex: 1, padding: 10, justifyContent: 'center' },
  roomCategory: { fontSize: 11, fontWeight: '700', color: HOTEL_COLORS.primary, marginBottom: 2 },
  roomName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  roomMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  roomAmenitiesPreview: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  roomPrice: { fontSize: 16, fontWeight: '800', color: HOTEL_COLORS.primary, marginTop: 4 },
  roomPriceSuffix: { fontSize: 12, fontWeight: '500' },
  roomStock: { fontSize: 11, color: '#64748b', marginTop: 2 },
  roomChevron: { marginRight: 10 },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  amenityText: { fontSize: 12, color: '#475569' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  bookBtn: {
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookBtnDisabled: { backgroundColor: '#cbd5e1' },
  bookBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default HotelDetailScreen;
