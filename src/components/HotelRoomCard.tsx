import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import type { HotelRoomSearchResult } from '../hooks/useApprovedHotelRooms';
import { useCurrency } from '../hooks/useCurrency';
import { useHotelFavorites } from '../hooks/useHotelFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import MediaThumb from './MediaThumb';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';
import {
  LIST_CARD_IMAGE_HEIGHT,
  formatExploreShelfHeadline,
  formatExploreShelfRatingSubtitle,
  formatListCardTitle,
} from '../constants/exploreShelfCard';

type Props = {
  room: HotelRoomSearchResult;
  onPress: (room: HotelRoomSearchResult) => void;
};

/** Carte résultat recherche hôtel — centrée sur le type de chambre. */
export default function HotelRoomCard({ room, onPress }: Props) {
  const { formatPrice } = useCurrency();
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading, cacheVersion, refreshCache } =
    useHotelFavorites();
  const establishmentId = room.establishment.id;
  const [isFavorited, setIsFavorited] = useState(() => isFavoriteSync(establishmentId));

  useEffect(() => {
    setIsFavorited(isFavoriteSync(establishmentId));
  }, [establishmentId, cacheVersion, isFavoriteSync]);

  const handleFavoritePress = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    requireAuthForFavorites(async () => {
      try {
        const next = await toggleFavorite(establishmentId);
        setIsFavorited(next);
        await refreshCache();
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Impossible de modifier les favoris');
      }
    });
  };

  const cover =
    room.images[0] ||
    room.establishment.images[0] ||
    'https://via.placeholder.com/300x200';

  const title = formatListCardTitle({
    title: room.name,
    typeLabel: room.establishment.title,
  });
  const headline = formatExploreShelfHeadline({
    title: room.name,
    typeLabel: 'Chambre',
  });

  const location =
    room.establishment.address?.trim() ||
    room.establishment.title ||
    undefined;

  const detailBits = [
    room.establishment.title,
    `${room.max_guests} pers.`,
    room.available_units != null ? `${room.available_units} dispo.` : null,
  ].filter(Boolean);

  return (
    <View style={styles.listOuter}>
      <ExploreShelfPhotoCard
        onPress={() => onPress(room)}
        imageAspect="list"
        imageHeight={LIST_CARD_IMAGE_HEIGHT}
        title={title || headline}
        detailLine={detailBits.join(' · ')}
        location={location}
        subtitle={formatExploreShelfRatingSubtitle(
          room.establishment.rating,
          room.establishment.review_count,
        )}
        priceLabel={`${formatPrice(room.price_per_night)}/nuit`}
        onFavoritePress={handleFavoritePress}
        isFavorited={isFavorited}
        favoriteLoading={favoriteLoading}
        image={
          <MediaThumb
            uri={cover}
            style={{ width: '100%', height: LIST_CARD_IMAGE_HEIGHT }}
            resizeMode="cover"
            contentPosition="center"
            fitWholeImage
            priority="high"
            recyclingKey={`${room.id}-list-cover`}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listOuter: {
    marginBottom: 14,
  },
});
