import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HotelEstablishmentPublic } from '../hooks/useApprovedHotelEstablishments';
import { HOTEL_COLORS } from '../constants/colors';

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
  const imageUri =
    Array.isArray(establishment.images) && establishment.images.length > 0
      ? establishment.images[0]
      : 'https://via.placeholder.com/300x200';

  const stars =
    establishment.star_rating && establishment.star_rating > 0
      ? `${establishment.star_rating}★`
      : null;

  return (
    <TouchableOpacity
      style={[styles.container, variant === 'shelf' && styles.shelfContainer]}
      onPress={() => onPress(establishment)}
      activeOpacity={0.85}
    >
      <View style={[styles.card, variant === 'shelf' && styles.shelfCard]}>
        <View style={[styles.imageWrap, variant === 'shelf' && styles.shelfImage]}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Hôtel</Text>
          </View>
          {stars ? (
            <View style={styles.stars}>
              <Text style={styles.starsText}>{stars}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {establishment.title}
          </Text>
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={13} color="#666" />
            <Text style={styles.loc} numberOfLines={1}>
              {establishment.address || 'Côte d’Ivoire'}
            </Text>
          </View>
          {establishment.rating > 0 ? (
            <Text style={styles.rating}>
              ★ {establishment.rating.toFixed(1)}
              {establishment.review_count > 0
                ? ` · ${establishment.review_count} avis`
                : ''}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 20, marginBottom: 16 },
  shelfContainer: { marginHorizontal: 0, marginBottom: 0, width: 160 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  shelfCard: { borderRadius: 10 },
  imageWrap: { width: '100%', height: 160, position: 'relative' },
  shelfImage: { height: 120 },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stars: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  starsText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  body: { padding: 10, gap: 4 },
  title: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loc: { flex: 1, fontSize: 12, color: '#666' },
  rating: { fontSize: 12, color: '#444', fontWeight: '500' },
});
