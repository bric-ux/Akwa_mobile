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
  promoLabel?: string;
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
  subtitle,
  imageHeight = EXPLORE_SHELF_IMAGE_HEIGHT,
  image,
  onFavoritePress,
  isFavorited = false,
  favoriteLoading = false,
  style,
}) => (
  <TouchableOpacity
    style={[styles.shell, style]}
    onPress={onPress}
    activeOpacity={0.92}
  >
    <View style={[styles.frame, { height: imageHeight }]}>
      {image}

      {priceLabel || promoLabel ? (
        <View style={styles.topRightStack} pointerEvents="none">
          <View
            style={[
              styles.pricePromoGroup,
              !(priceLabel && promoLabel) && styles.pricePromoGroupSolo,
            ]}
          >
            {priceLabel ? (
              <View
                style={[
                  styles.pricePill,
                  priceLabel && promoLabel && styles.pricePillWithPromo,
                ]}
              >
                <Text style={styles.priceText}>{priceLabel}</Text>
              </View>
            ) : null}
            {promoLabel ? (
              <View
                style={[
                  styles.promoPill,
                  priceLabel && promoLabel && styles.promoPillAttached,
                ]}
              >
                <Text style={styles.promoText}>{promoLabel}</Text>
              </View>
            ) : null}
          </View>
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
          hitSlop={8}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorited ? '#e74c3c' : '#fff'}
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
    </View>
  </TouchableOpacity>
);

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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 9,
  },
  topRightStack: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'center',
    maxWidth: '72%',
  },
  pricePromoGroup: {
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 14,
  },
  pricePromoGroupSolo: {
    borderRadius: 999,
  },
  pricePill: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
  },
  pricePillWithPromo: {
    borderRadius: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignSelf: 'stretch',
  },
  priceText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  promoPill: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'center',
  },
  promoPillAttached: {
    borderRadius: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    alignSelf: 'stretch',
    marginTop: 0,
  },
  promoText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  favorite: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    paddingTop: 9,
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
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  metaSubtitle: {
    flexShrink: 0,
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaLocation: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ExploreShelfPhotoCard;
