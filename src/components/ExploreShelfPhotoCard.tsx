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
  /** Accueil carrousel portrait ; liste recherche (prix sur l’image). */
  imageAspect?: 'shelf' | 'list';
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
  imageAspect = 'shelf',
  image,
  onFavoritePress,
  isFavorited = false,
  favoriteLoading = false,
  style,
}) => {
  const isList = imageAspect === 'list';
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
    <View
      style={[
        styles.frameWrap,
        isList && styles.frameWrapList,
        { height: imageHeight },
      ]}
    >
      <View style={[styles.frame, { height: imageHeight }]}>
        {image}

        {!isList && hasStructuredPromo ? (
          <View style={styles.promoBadge} pointerEvents="none">
            <Text style={styles.promoText}>
              −{promoPercent}% dès {promoMinNights} nuit{promoMinNights > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        {!isList && !hasStructuredPromo && promoLabel ? (
          <View style={styles.promoBadge} pointerEvents="none">
            <Text style={styles.promoText} numberOfLines={1}>
              {promoLabel}
            </Text>
          </View>
        ) : null}

        {isList && (priceLabel || promoLabel) ? (
          <View style={styles.listPriceStack} pointerEvents="none">
            {priceLabel ? (
              <View style={styles.listPricePill}>
                <Text style={styles.listPriceText}>{priceLabel}</Text>
              </View>
            ) : null}
            {promoLabel ? (
              <View style={styles.listPromoPill}>
                <Text style={styles.listPromoText} numberOfLines={1}>
                  {promoLabel}
                </Text>
              </View>
            ) : null}
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
    </View>

    <View style={styles.meta} pointerEvents="none">
      <View style={styles.titleRow}>
        <Text
          style={[styles.metaTitle, isList && styles.metaTitleList]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
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
      {!isList && priceLabel ? (
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
  frameWrap: {
    width: '100%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: 'transparent',
  },
  frameWrapList: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  frame: {
    width: '100%',
    borderRadius: EXPLORE_SHELF_IMAGE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
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
  listPriceStack: {
    position: 'absolute',
    top: 12,
    right: 12,
    maxWidth: '72%',
    overflow: 'hidden',
  },
  listPricePill: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  listPriceText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  listPromoPill: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  listPromoText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
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
  metaTitleList: {
    fontSize: 15,
    lineHeight: 20,
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
