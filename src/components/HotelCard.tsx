import React, { useEffect, useState } from 'react';
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
import { useHotelFavorites } from '../hooks/useHotelFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { EXPLORE_SHELF_IMAGE_HEIGHT } from '../constants/exploreShelfCard';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';

interface HotelCardProps {
  establishment: HotelEstablishment;
  onPress: (establishment: HotelEstablishment) => void;
  /** Carrousel horizontal sur l'accueil (sans marges latérales). */
  horizontalShelf?: boolean;
}

const HotelCard: React.FC<HotelCardProps> = ({
  establishment,
  onPress,
  horizontalShelf = false,
}) => {
  const { formatPrice } = useCurrency();
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading } = useHotelFavorites();
  const [isFavorited, setIsFavorited] = useState(false);
  const coverUrl = getHotelCoverUrl(establishment);
  const minPrice = establishment.min_price_per_night ?? getMinRoomPrice(establishment);
  const location = getEstablishmentLocationLabel(establishment);
  const roomCount = establishment.hotel_room_types?.length ?? 0;

  useEffect(() => {
    setIsFavorited(isFavoriteSync(establishment.id));
  }, [establishment.id, isFavoriteSync]);

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    requireAuthForFavorites(async () => {
      try {
        await toggleFavorite(establishment.id);
      } catch (error) {
        console.error('Erreur favoris hôtel:', error);
      }
    });
  };

  if (horizontalShelf) {
    return (
      <ExploreShelfPhotoCard
        onPress={() => onPress(establishment)}
        title={establishment.title}
        location={location || undefined}
        priceLabel={
          minPrice != null ? `${formatPrice(minPrice)}/nuit` : undefined
        }
        subtitle={
          establishment.star_rating != null && establishment.star_rating > 0
            ? `★ ${establishment.star_rating} étoiles`
            : undefined
        }
        onFavoritePress={handleFavoritePress}
        isFavorited={isFavorited}
        favoriteLoading={favoriteLoading}
        image={
          <Image
            source={{ uri: coverUrl }}
            style={styles.shelfImage}
            contentFit="cover"
            contentPosition="top"
            transition={200}
          />
        }
      />
    );
  }

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
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
          disabled={favoriteLoading}
          hitSlop={8}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorited ? '#e74c3c' : '#fff'}
          />
        </TouchableOpacity>
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
  shelfImage: {
    width: '100%',
    height: EXPLORE_SHELF_IMAGE_HEIGHT,
  },
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
  favoriteButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
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
