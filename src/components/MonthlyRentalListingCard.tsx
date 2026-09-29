import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import type { MonthlyRentalListing } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useMonthlyFavorites } from '../hooks/useMonthlyFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import MediaThumb from './MediaThumb';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  LIST_CARD_IMAGE_HEIGHT,
  formatExploreShelfHeadline,
  formatListCardTitle,
} from '../constants/exploreShelfCard';

interface MonthlyRentalListingCardProps {
  listing: MonthlyRentalListing;
  onPress: (listing: MonthlyRentalListing) => void;
  variant?: 'grid' | 'list' | 'shelf';
}

function coverUri(listing: MonthlyRentalListing): string {
  if (Array.isArray(listing.images) && listing.images.length > 0) {
    return listing.images[0];
  }
  const cp = listing.categorized_photos as Array<{ url?: string }> | undefined;
  if (Array.isArray(cp) && cp[0]?.url) return cp[0].url;
  return 'https://via.placeholder.com/300x200';
}

const MonthlyRentalListingCard: React.FC<MonthlyRentalListingCardProps> = ({
  listing,
  onPress,
  variant = 'list',
}) => {
  const { formatPrice } = useCurrency();
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading, cacheVersion, refreshCache } =
    useMonthlyFavorites();
  const [isFavorited, setIsFavorited] = useState(() => isFavoriteSync(listing.id));

  useEffect(() => {
    setIsFavorited(isFavoriteSync(listing.id));
  }, [listing.id, cacheVersion, isFavoriteSync]);

  const handleFavoritePress = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    requireAuthForFavorites(async () => {
      try {
        const next = await toggleFavorite(listing.id);
        setIsFavorited(next);
        await refreshCache();
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Impossible de modifier les favoris');
      }
    });
  };

  const imageUri = coverUri(listing);
  const typeLabel = 'Bail longue durée';
  const priceLabel = `${formatPrice(listing.monthly_rent_price)}/mois`;
  const location = listing.location?.trim() || undefined;
  const detailBits = [
    listing.surface_m2 ? `${listing.surface_m2} m²` : null,
    listing.number_of_rooms
      ? `${listing.number_of_rooms} pièce${listing.number_of_rooms > 1 ? 's' : ''}`
      : null,
    listing.is_furnished ? 'Meublé' : 'Non meublé',
  ].filter(Boolean);
  const detailLine = detailBits.length > 0 ? detailBits.join(' · ') : undefined;

  if (variant === 'shelf') {
    return (
      <View style={styles.shelfOuter}>
        <ExploreShelfPhotoCard
          onPress={() => onPress(listing)}
          title={formatExploreShelfHeadline({
            title: listing.title,
            typeLabel,
          })}
          detailLine={detailLine}
          location={location}
          priceLabel={priceLabel}
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
              recyclingKey={`${listing.id}-shelf-cover`}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.listOuter}>
      <ExploreShelfPhotoCard
        onPress={() => onPress(listing)}
        imageAspect="list"
        imageHeight={LIST_CARD_IMAGE_HEIGHT}
        title={formatListCardTitle({
          title: listing.title,
          typeLabel,
        })}
        detailLine={detailLine}
        location={location}
        priceLabel={priceLabel}
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
            recyclingKey={`${listing.id}-list-cover`}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  shelfOuter: {
    width: '100%',
  },
  listOuter: {
    marginBottom: 14,
  },
});

export default MonthlyRentalListingCard;
