import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MonthlyRentalListing } from '../types';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';

interface MonthlyRentalListingCardProps {
  listing: MonthlyRentalListing;
  onPress: (listing: MonthlyRentalListing) => void;
  variant?: 'grid' | 'list';
}

const MonthlyRentalListingCard: React.FC<MonthlyRentalListingCardProps> = ({
  listing,
  onPress,
  variant = 'list',
}) => {
  const { formatPrice } = useCurrency();
  const imageUri = Array.isArray(listing.images) && listing.images.length > 0
    ? listing.images[0]
    : 'https://via.placeholder.com/300x200';

  return (
    <TouchableOpacity
      style={[styles.container, variant === 'list' && styles.listContainer]}
      onPress={() => onPress(listing)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLayout}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
          <View style={styles.priceOverlay}>
            <Text style={styles.priceText}>
              {formatPrice(listing.monthly_rent_price)}/mois
            </Text>
          </View>
          <View style={styles.badgeLongueDuree}>
            <Text style={styles.badgeText}>Longue durée</Text>
          </View>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            📍 {listing.location}
          </Text>
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
  container: { marginHorizontal: 20, marginBottom: 16 },
  listContainer: {},
  cardLayout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  priceOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  badgeLongueDuree: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardContent: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  cardLocation: { fontSize: 13, color: '#666', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#888' },
  metaDot: { fontSize: 12, color: '#ccc', marginHorizontal: 4 },
});

export default MonthlyRentalListingCard;
