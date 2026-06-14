import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { HotelEstablishment } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { HOTEL_COLORS } from '../constants/colors';
import {
  getEstablishmentLocationLabel,
  getEstablishmentTypeLabel,
  getHotelCoverUrl,
  getMinRoomPrice,
} from '../lib/hotelUtils';

interface HotelCardProps {
  establishment: HotelEstablishment;
  onPress: (establishment: HotelEstablishment) => void;
}

const HotelCard: React.FC<HotelCardProps> = ({ establishment, onPress }) => {
  const { formatPrice } = useCurrency();
  const coverUrl = getHotelCoverUrl(establishment);
  const minPrice = establishment.min_price_per_night ?? getMinRoomPrice(establishment);
  const location = getEstablishmentLocationLabel(establishment);
  const roomCount = establishment.hotel_room_types?.length ?? 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => onPress(establishment)}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {getEstablishmentTypeLabel(establishment.establishment_type)}
          </Text>
        </View>
        {minPrice != null && (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>
              {formatPrice(minPrice)}
              <Text style={styles.priceSuffix}>/nuit</Text>
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {establishment.title}
        </Text>

        {location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          {establishment.star_rating != null && establishment.star_rating > 0 ? (
            <View style={styles.metaRow}>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.metaText}>{establishment.star_rating} étoiles</Text>
            </View>
          ) : null}
          {roomCount > 0 ? (
            <Text style={styles.roomCount}>
              {roomCount} type{roomCount > 1 ? 's' : ''} de chambre
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageWrap: {
    height: 200,
    backgroundColor: '#f1f5f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  priceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  priceSuffix: {
    fontSize: 11,
    fontWeight: '500',
  },
  body: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  roomCount: {
    fontSize: 12,
    color: HOTEL_COLORS.primary,
    fontWeight: '600',
  },
});

export default HotelCard;
