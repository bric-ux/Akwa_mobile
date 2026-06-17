import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { HotelEstablishment, HotelRoomType, RootStackParamList } from '../types';
import { useHotels } from '../hooks/useHotels';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../services/AuthContext';
import { HOTEL_COLORS } from '../constants/colors';
import HotelMediaGallery from '../components/HotelMediaGallery';
import MediaThumb from '../components/MediaThumb';
import { getRoomCategoryLabel } from '../constants/hotelListingForm';
import { safeGoBack } from '../utils/navigation';
import { sanitizePublicDescription } from '../utils/sanitizePublicDescription';
import HotelBookingModal from '../components/HotelBookingModal';

type Route = RouteProp<RootStackParamList, 'HotelRoomDetail'>;

const PLACEHOLDER = 'https://via.placeholder.com/800x500?text=Chambre';

const HotelRoomDetailScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { establishmentId, roomTypeId, checkIn, checkOut, guests, openBooking } = route.params;
  const { getEstablishmentById } = useHotels();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();

  const [establishment, setEstablishment] = useState<HotelEstablishment | null>(null);
  const [room, setRoom] = useState<HotelRoomType | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const est = await getEstablishmentById(establishmentId);
    const found = est?.hotel_room_types?.find((rt) => rt.id === roomTypeId) ?? null;
    setEstablishment(est);
    setRoom(found);
    setLoading(false);
  }, [establishmentId, roomTypeId, getEstablishmentById]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (openBooking && room && user) {
      setBookingOpen(true);
    }
  }, [openBooking, room, user]);

  const handleBook = () => {
    if (!user) {
      navigation.navigate('Auth', {
        returnTo: 'HotelRoomDetail',
        returnParams: { establishmentId, roomTypeId },
      });
      return;
    }
    setBookingOpen(true);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={HOTEL_COLORS.primary} />
      </View>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack(navigation)}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.notFound}>Chambre introuvable</Text>
      </SafeAreaView>
    );
  }

  const gallery =
    room.images && room.images.length > 0 ? room.images.filter(Boolean) : [PLACEHOLDER];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <HotelMediaGallery
          urls={gallery}
          height={300}
          activeIndex={imageIndex}
          onIndexChange={setImageIndex}
          overlay={
            <SafeAreaView style={styles.galleryOverlay} edges={['top']}>
              <TouchableOpacity style={styles.backBtnFloating} onPress={() => safeGoBack(navigation)}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            </SafeAreaView>
          }
        />

        {gallery.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbRow}
          >
            {gallery.map((uri, i) => (
              <TouchableOpacity key={`${uri}-${i}`} onPress={() => setImageIndex(i)}>
                <MediaThumb
                  uri={uri}
                  style={[styles.thumb, i === imageIndex && styles.thumbActive]}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.content}>
          {room.room_category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>
                {getRoomCategoryLabel(room.room_category)}
              </Text>
            </View>
          ) : null}

          <Text style={styles.title}>{room.name}</Text>
          {establishment?.title ? (
            <Text style={styles.establishmentName}>{establishment.title}</Text>
          ) : null}

          <Text style={styles.price}>
            {formatPrice(room.price_per_night)}
            <Text style={styles.priceSuffix}>/nuit</Text>
          </Text>

          {(room.discount_enabled &&
            room.discount_percentage &&
            room.discount_min_nights) ||
          (room.long_stay_discount_enabled &&
            room.long_stay_discount_percentage &&
            room.long_stay_discount_min_nights) ? (
            <View style={styles.discountBox}>
              {room.discount_enabled &&
              room.discount_percentage &&
              room.discount_min_nights ? (
                <Text style={styles.discountText}>
                  Réduction {room.discount_percentage}% à partir de {room.discount_min_nights}{' '}
                  nuit{room.discount_min_nights > 1 ? 's' : ''}
                </Text>
              ) : null}
              {room.long_stay_discount_enabled &&
              room.long_stay_discount_percentage &&
              room.long_stay_discount_min_nights ? (
                <Text style={styles.discountText}>
                  Long séjour : {room.long_stay_discount_percentage}% à partir de{' '}
                  {room.long_stay_discount_min_nights} nuit
                  {room.long_stay_discount_min_nights > 1 ? 's' : ''}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.metaGrid}>
            <MetaItem icon="people-outline" label={`${room.max_guests} pers.`} />
            <MetaItem icon="bed-outline" label={`${room.bedrooms} ch.`} />
            <MetaItem icon="water-outline" label={`${room.bathrooms} sdb`} />
            <MetaItem icon="layers-outline" label={`${room.inventory_count} dispo`} />
          </View>

          {room.description ? (
            <>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {sanitizePublicDescription(room.description)}
              </Text>
            </>
          ) : null}

          {(room.amenities?.length ?? 0) > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Équipements de la chambre</Text>
              <View style={styles.amenitiesWrap}>
                {room.amenities!.map((a) => (
                  <View key={a} style={styles.amenityChip}>
                    <Ionicons name="checkmark-circle" size={14} color={HOTEL_COLORS.primary} />
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.infoBox}>
            {room.cleaning_fee ? (
              <Text style={styles.infoLine}>
                Frais de ménage : {formatPrice(room.cleaning_fee)}
              </Text>
            ) : null}
            {room.minimum_nights && room.minimum_nights > 1 ? (
              <Text style={styles.infoLine}>Séjour minimum : {room.minimum_nights} nuits</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBook}>
          <Text style={styles.bookBtnText}>Réserver cette chambre</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {establishment && room ? (
        <HotelBookingModal
          visible={bookingOpen}
          onClose={() => setBookingOpen(false)}
          establishment={establishment}
          roomType={room}
          initialCheckIn={checkIn}
          initialCheckOut={checkOut}
          initialGuests={guests}
        />
      ) : null}
    </View>
  );
};

function MetaItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={18} color={HOTEL_COLORS.primary} />
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#64748b' },
  backBtn: { margin: 16 },
  galleryWrap: { height: 300, backgroundColor: '#e2e8f0' },
  galleryImage: { width: '100%', height: '100%' },
  galleryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backBtnFloating: {
    margin: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    margin: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowLeft: { left: 10 },
  navArrowRight: { right: 10 },
  dots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  thumbRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  thumb: {
    width: 72,
    height: 54,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: HOTEL_COLORS.primary },
  content: { padding: 16, paddingBottom: 100 },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: HOTEL_COLORS.light,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  categoryPillText: { color: HOTEL_COLORS.primary, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  establishmentName: { fontSize: 14, color: '#64748b', marginTop: 4 },
  price: { fontSize: 22, fontWeight: '800', color: HOTEL_COLORS.primary, marginTop: 10 },
  priceSuffix: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  discountBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    gap: 4,
  },
  discountText: { fontSize: 13, color: '#047857', fontWeight: '600' },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  metaLabel: { fontSize: 13, color: '#475569', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 20, marginBottom: 10 },
  description: { fontSize: 15, color: '#475569', lineHeight: 22 },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  amenityText: { fontSize: 13, color: '#475569' },
  infoBox: {
    marginTop: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  infoLine: { fontSize: 14, color: '#64748b' },
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
  bookBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default HotelRoomDetailScreen;
