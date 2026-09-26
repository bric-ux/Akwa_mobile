import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { Vehicle } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useVehicleFavorites } from '../hooks/useVehicleFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import MediaThumb from './MediaThumb';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';
import { getVehicleCoverUrl, getVehicleGalleryUrls, isVideoUrl } from '../utils/media';
import { formatCardLocationLabel } from '../utils/locationLabel';
import {
  formatExploreShelfHeadline,
  formatExploreShelfRatingSubtitle,
} from '../constants/exploreShelfCard';

/** Marge liste VehiclesScreen (paddingHorizontal 16). */
const LIST_PAD = 16;
/** Ratio 4:3 un peu plus compact que plein écran — largeur utile = écran − paddings liste. */
const IMAGE_HEIGHT = Math.round(
  (Dimensions.get('window').width - LIST_PAD * 2) * (3 / 5),
);

interface VehicleCardProps {
  vehicle: Vehicle;
  onPress: (vehicle: Vehicle) => void;
  variant?: 'grid' | 'list';
}

const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  onPress,
  variant = 'list',
}) => {
  const { formatPrice } = useCurrency();
  const { requireAuthForFavorites } = useAuthRedirect();
  const {
    toggleFavorite,
    isFavoriteSync,
    loading: favoriteLoading,
    cacheVersion,
    refreshCache,
  } = useVehicleFavorites();
  const [isFavorited, setIsFavorited] = useState(() => isFavoriteSync(vehicle.id));

  useEffect(() => {
    setIsFavorited(isFavoriteSync(vehicle.id));
  }, [vehicle.id, cacheVersion, isFavoriteSync]);

  const handleFavoritePress = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();

    requireAuthForFavorites(async () => {
      try {
        const newFavoriteState = await toggleFavorite(vehicle.id);
        setIsFavorited(newFavoriteState);
        await refreshCache();
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Impossible de modifier les favoris');
      }
    });
  };

  const vehicleImages = getVehicleGalleryUrls(vehicle);
  const coverUri =
    getVehicleCoverUrl(vehicle) || vehicleImages[0] || 'https://via.placeholder.com/300x200';

  const vehicleTitle =
    [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ').trim() ||
    vehicle.title ||
    'Véhicule';

  const locationLabel = (() => {
    if (vehicle.location) {
      return formatCardLocationLabel(vehicle.location as any) || undefined;
    }
    const locationName = (vehicle as any).location_name as string | undefined;
    if (locationName?.trim()) {
      return formatCardLocationLabel(locationName) || undefined;
    }
    return undefined;
  })();

  return (
    <View style={[styles.outer, variant === 'list' && styles.listOuter]}>
      <ExploreShelfPhotoCard
        onPress={() => onPress(vehicle)}
        imageAspect="list"
        imageHeight={IMAGE_HEIGHT}
        title={formatExploreShelfHeadline({
          title: vehicleTitle,
          typeLabel: 'Véhicule',
        })}
        location={locationLabel}
        subtitle={formatExploreShelfRatingSubtitle(vehicle.rating, vehicle.review_count)}
        priceLabel={`${formatPrice(vehicle.price_per_day || 0)}/jour`}
        onFavoritePress={handleFavoritePress}
        isFavorited={isFavorited}
        favoriteLoading={favoriteLoading}
        image={
          <MediaThumb
            uri={coverUri}
            style={{ width: '100%', height: IMAGE_HEIGHT }}
            resizeMode="cover"
            contentPosition="center"
            fitWholeImage
            isVideo={isVideoUrl(coverUri)}
            priority="low"
            recyclingKey={`${vehicle.id}-list-cover`}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'stretch',
  },
  listOuter: {
    marginBottom: 14,
  },
});

export default VehicleCard;
