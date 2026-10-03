import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import type { HotelEstablishmentPublic } from '../hooks/useApprovedHotelEstablishments';
import { useHotelFavorites } from '../hooks/useHotelFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import MediaThumb from './MediaThumb';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';
import { useLanguage } from '../contexts/LanguageContext';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  LIST_CARD_IMAGE_HEIGHT,
  formatExploreShelfHeadline,
  formatExploreShelfRatingSubtitle,
  formatListCardTitle,
} from '../constants/exploreShelfCard';

type Props = {
  establishment: HotelEstablishmentPublic;
  onPress: (item: HotelEstablishmentPublic) => void;
  variant?: 'list' | 'shelf';
};

export default function HotelEstablishmentCard({
  establishment,
  onPress,
  variant = 'list',
}: Props) {
  const { t } = useLanguage();
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading, cacheVersion, refreshCache } =
    useHotelFavorites();
  const [isFavorited, setIsFavorited] = useState(() => isFavoriteSync(establishment.id));

  useEffect(() => {
    setIsFavorited(isFavoriteSync(establishment.id));
  }, [establishment.id, cacheVersion, isFavoriteSync]);

  const handleFavoritePress = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    requireAuthForFavorites(async () => {
      try {
        const next = await toggleFavorite(establishment.id);
        setIsFavorited(next);
        await refreshCache();
      } catch (error: any) {
        Alert.alert(t('common.error'), error.message || t('hotelEstablishment.favoriteError'));
      }
    });
  };

  const typeMap: Record<string, string> = {
    hotel: t('hotelEstablishment.typeHotel'),
    guesthouse: t('hotelEstablishment.typeGuesthouse'),
    residence: t('hotelEstablishment.typeResidence'),
    aparthotel: t('hotelEstablishment.typeAparthotel'),
  };
  const typeLabel = typeMap[establishment.establishment_type] || t('hotelEstablishment.typeHotel');

  const imageUri =
    Array.isArray(establishment.images) && establishment.images.length > 0
      ? establishment.images[0]
      : 'https://via.placeholder.com/300x200';

  const location =
    establishment.address?.trim() ||
    (establishment.star_rating ? `${establishment.star_rating}★` : undefined);

  const subtitle = formatExploreShelfRatingSubtitle(
    establishment.rating,
    establishment.review_count,
  );

  if (variant === 'shelf') {
    return (
      <View style={styles.shelfOuter}>
        <ExploreShelfPhotoCard
          onPress={() => onPress(establishment)}
          title={formatExploreShelfHeadline({
            title: establishment.title,
            typeLabel,
          })}
          location={location}
          subtitle={subtitle}
          imageHeight={EXPLORE_SHELF_IMAGE_HEIGHT}
          onFavoritePress={handleFavoritePress}
          isFavorited={isFavorited}
          favoriteLoading={favoriteLoading}
          image={
            <MediaThumb
              uri={imageUri}
              style={{ width: '100%', height: EXPLORE_SHELF_IMAGE_HEIGHT }}
              resizeMode="cover"
              contentPosition="center"
              fitWholeImage
              priority="high"
              recyclingKey={`${establishment.id}-shelf-cover`}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.listOuter}>
      <ExploreShelfPhotoCard
        onPress={() => onPress(establishment)}
        imageAspect="list"
        imageHeight={LIST_CARD_IMAGE_HEIGHT}
        title={formatListCardTitle({
          title: establishment.title,
          typeLabel,
        })}
        location={location}
        subtitle={subtitle}
        priceLabel={typeLabel}
        onFavoritePress={handleFavoritePress}
        isFavorited={isFavorited}
        favoriteLoading={favoriteLoading}
        image={
          <MediaThumb
            uri={imageUri}
            style={{ width: '100%', height: LIST_CARD_IMAGE_HEIGHT }}
            resizeMode="cover"
            contentPosition="center"
            fitWholeImage
            priority="high"
            recyclingKey={`${establishment.id}-list-cover`}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shelfOuter: {
    width: '100%',
  },
  listOuter: {
    marginBottom: 14,
  },
});
