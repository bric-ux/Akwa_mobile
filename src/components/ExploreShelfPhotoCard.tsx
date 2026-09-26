import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EXPLORE_SHELF_IMAGE_HEIGHT,
  EXPLORE_SHELF_IMAGE_RADIUS,
} from '../constants/exploreShelfCard';

type ExploreShelfPhotoCardProps = {
  onPress: () => void;
  title: string;
  location?: string;
  priceLabel?: string;
  /** Texte libre (legacy) — préférer promoPercent + promoMinNights. */
  promoLabel?: string;
  promoPercent?: number;
  promoMinNights?: number;
  /** Sous le titre (ex. étoiles hôtel). */
  subtitle?: string;
  imageHeight?: number;
  image: React.ReactNode;
  onFavoritePress?: (e: { stopPropagation: () => void }) => void;
  isFavorited?: boolean;
  favoriteLoading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const ExploreShelfPhotoCard: React.FC<ExploreShelfPhotoCardProps> = ({
  onPress,
  title,
  location,
  priceLabel,
  promoLabel,
  promoPercent,
  promoMinNights,
  subtitle,
  imageHeight = EXPLORE_SHELF_IMAGE_HEIGHT,
  image,
  onFavoritePress,
  isFavorited = false,
  favoriteLoading = false,
  style,
}) => {
  const hasStructuredPromo =
    typeof promoPercent === 'number' &&
    promoPercent > 0 &&
    typeof promoMinNights === 'number' &&
    promoMinNights > 0;

  return (
  <TouchableOpacity
    style={[styles.shell, style]}
    onPress={onPress}
    activeOpacity={0.92}
  >
    <View style={[styles.frame, { height: imageHeight }]}>
      {image}

      {hasStructuredPromo ? (
        <View style={styles.promoBadge} pointerEvents="none">
          <Text style={styles.promoText}>
            −{promoPercent}% dès {promoMinNights}n
          </Text>
        </View>
      ) : promoLabel ? (
        <View style={styles.promoBadge} pointerEvents="none">
          <Text style={styles.promoText} numberOfLines={1}>
            {promoLabel}
          </Text>
        </View>
      ) : null}

      {onFavoritePress ? (
        <Pressable
          style={styles.favorite}
          onPress={(e) => {
            e.stopPropagation();
            onFavoritePress(e);
          }}
          disabled={favoriteLoading}
          hitSlop={12}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={22}
            color={isFavorited ? '#e11d48' : '#fff'}
            style={styles.favoriteIcon}
          />
        </Pressable>
      ) : null}
    </View>

    <View style={styles.meta} pointerEvents="none">
      <View style={styles.titleRow}>
        <Text style={styles.metaTitle} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.metaSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color="#64748b" />
          <Text style={styles.metaLocation} numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}
      {priceLabel ? (
        <Text style={styles.metaPrice} numberOfLines={1}>
          {priceLabel}
        </Text>
      ) : null}
    </View>
  </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
  frame: {
    width: '100%',
    borderRadius: EXPLORE_SHELF_IMAGE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  promoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  promoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  favorite: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  favoriteIcon: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  meta: {
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  metaTitle: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  metaSubtitle: {
    flexShrink: 0,
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaLocation: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  metaPrice: {
    marginTop: 4,
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ExploreShelfPhotoCard;
