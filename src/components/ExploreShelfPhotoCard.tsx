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

      <View style={styles.caption} pointerEvents="none">
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {location ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="#fff" />
            <Text style={styles.location} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: EXPLORE_SHELF_IMAGE_RADIUS,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 9,
  },
  frame: {
    width: '100%',
    borderRadius: EXPLORE_SHELF_IMAGE_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#cbd5e1',
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
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  location: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  subtitle: {
    marginTop: 4,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});

export default ExploreShelfPhotoCard;
