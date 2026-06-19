import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';
import { prefetchHomeCategory } from '../services/searchCatalogPrefetch';
import {
  HOST_COLORS,
  HOTEL_COLORS,
  MONTHLY_RENTAL_COLORS,
  VEHICLE_COLORS,
} from '../constants/colors';
import type { HomeCategoryId } from '../types/homeCategory';

export type { HomeCategoryId };

type CategoryDef = {
  id: HomeCategoryId;
  label: string;
  fallbackImage: number;
  color: string;
};

const PILL_IMAGES: Record<HomeCategoryId, number> = {
  residence: require('../../assets/images/pill-residence.jpg'),
  hotel: require('../../assets/images/pill-hotel.jpg'),
  monthly: require('../../assets/images/pill-monthly.jpg'),
  vehicle: require('../../assets/images/pill-vehicle.jpg'),
};

const BASE_CATEGORIES: CategoryDef[] = [
  {
    id: 'residence',
    label: 'Résidences meublées',
    fallbackImage: PILL_IMAGES.residence,
    color: HOST_COLORS.primary,
  },
  {
    id: 'hotel',
    label: 'Hôtels',
    fallbackImage: PILL_IMAGES.hotel,
    color: HOTEL_COLORS.primary,
  },
  {
    id: 'vehicle',
    label: 'Véhicules',
    fallbackImage: PILL_IMAGES.vehicle,
    color: VEHICLE_COLORS.primary,
  },
];

const MONTHLY_CATEGORY: CategoryDef = {
  id: 'monthly',
  label: 'Location',
  fallbackImage: PILL_IMAGES.monthly,
  color: MONTHLY_RENTAL_COLORS.primary,
};

type Props = {
  onCategoryPress: (id: HomeCategoryId) => void;
};

function CategoryPill({
  item,
  onPress,
}: {
  item: CategoryDef;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={() => {
          prefetchHomeCategory(item.id);
          Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
        }}
        onPress={onPress}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={[styles.pill, { borderColor: `${item.color}44` }]}
      >
        <View style={[styles.thumbRing, { borderColor: `${item.color}33` }]}>
          <Image
            source={item.fallbackImage}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
        <Text style={[styles.pillLabel, { color: item.color }]}>{item.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const HomeCategoryPills: React.FC<Props> = ({ onCategoryPress }) => {
  const categories = useMemo(() => {
    const list = [...BASE_CATEGORIES];
    if (FEATURE_MONTHLY_RENTAL) {
      list.splice(2, 0, MONTHLY_CATEGORY);
    }
    return list;
  }, []);

  const handlePress = useCallback(
    (id: HomeCategoryId) => {
      onCategoryPress(id);
    },
    [onCategoryPress],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
    >
      {categories.map((item) => (
        <CategoryPill
          key={item.id}
          item={item}
          onPress={() => handlePress(item.id)}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    marginTop: 8,
    marginBottom: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
    paddingRight: 12,
    paddingLeft: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#fff',
    minHeight: 36,
  },
  thumbRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HomeCategoryPills;
