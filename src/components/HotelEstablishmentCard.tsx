import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { HotelEstablishmentPublic } from '../hooks/useApprovedHotelEstablishments';
import MediaThumb from './MediaThumb';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  LIST_CARD_IMAGE_HEIGHT,
  formatExploreShelfHeadline,
  formatExploreShelfRatingSubtitle,
  formatListCardTitle,
} from '../constants/exploreShelfCard';

const TYPE_LABEL: Record<string, string> = {
  hotel: 'Hôtel',
  guesthouse: 'Maison d’hôtes',
  residence: 'Résidence',
  aparthotel: 'Aparthotel',
};

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
  const typeLabel = TYPE_LABEL[establishment.establishment_type] || 'Hôtel';
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
