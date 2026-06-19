import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { MonthlyRentalListing } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { formatCardLocationLabel } from '../utils/locationLabel';
import { getPropertyTypeLabel } from '../utils/propertyTypeLabel';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  formatExploreShelfHeadline,
  LIST_CARD_IMAGE_HEIGHT,
} from '../constants/exploreShelfCard';
import ExploreShelfPhotoCard from './ExploreShelfPhotoCard';
import MediaThumb from './MediaThumb';
import { isVideoUrl } from '../utils/media';

interface MonthlyRentalListingCardProps {
  listing: MonthlyRentalListing;
  onPress: (listing: MonthlyRentalListing) => void;
  variant?: 'grid' | 'list';
  horizontalShelf?: boolean;
}

const MonthlyRentalListingCard: React.FC<MonthlyRentalListingCardProps> = ({
  listing,
  onPress,
  variant = 'list',
  horizontalShelf = false,
}) => {
  const { formatPrice } = useCurrency();
  const imageUri = Array.isArray(listing.images) && listing.images.length > 0
    ? listing.images[0]
    : 'https://via.placeholder.com/300x200';
  const locationLabel = listing.locations
    ? formatCardLocationLabel(listing.locations)
    : formatCardLocationLabel(listing.location);

  if (horizontalShelf) {
    return (
      <ExploreShelfPhotoCard
        onPress={() => onPress(listing)}
        title={formatExploreShelfHeadline({
          title: listing.title,
          typeLabel: getPropertyTypeLabel(listing.property_type),
        })}
        location={locationLabel || undefined}
        priceLabel={`${formatPrice(listing.monthly_rent_price)}/mois`}
        image={
          <Image
            source={{ uri: imageUri }}
            style={styles.shelfImage}
            contentFit="cover"
            contentPosition="top"
            transition={200}
          />
        }
      />
    );
  }

  if (variant === 'list') {
    const metaSubtitle = [
      `${listing.surface_m2} m²`,
      `${listing.number_of_rooms} pièces`,
      `${listing.bedrooms} ch.`,
      listing.is_furnished ? 'Meublé' : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <View style={styles.listContainer}>
        <ExploreShelfPhotoCard
          onPress={() => onPress(listing)}
          title={formatExploreShelfHeadline({
            title: listing.title,
            typeLabel: getPropertyTypeLabel(listing.property_type),
          })}
          location={locationLabel || undefined}
          subtitle={metaSubtitle}
          priceLabel={`${formatPrice(listing.monthly_rent_price)}/mois`}
          imageHeight={LIST_CARD_IMAGE_HEIGHT}
          image={
            <MediaThumb
              uri={imageUri}
              style={{ width: '100%', height: LIST_CARD_IMAGE_HEIGHT }}
              resizeMode="cover"
              fitWholeImage
              contentPosition="center"
              isVideo={isVideoUrl(imageUri)}
              priority="low"
              recyclingKey={`${listing.id}-list-cover`}
            />
          }
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(listing)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLayout}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.cardImage} contentFit="cover" contentPosition="top" />
          <View style={styles.priceOverlay}>
            <Text style={styles.priceText}>
              {formatPrice(listing.monthly_rent_price)}/mois
            </Text>
          </View>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          {locationLabel ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.cardLocation} numberOfLines={1}>
                {locationLabel}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{listing.surface_m2} m²</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{listing.number_of_rooms} pièces</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{listing.bedrooms} ch.</Text>
            {listing.is_furnished && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>Meublé</Text>
              </>
            )}
          </View>
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
  container: { marginHorizontal: 20, marginBottom: 16 },
  listContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cardLayout: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
    backgroundColor: '#e2e8f0',
  },
  cardImage: { width: '100%', height: '100%' },
  priceOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  priceText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardContent: {
    marginTop: -14,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  cardLocation: { fontSize: 13, color: '#666' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#888' },
  metaDot: { fontSize: 12, color: '#ccc', marginHorizontal: 4 },
});

export default MonthlyRentalListingCard;
