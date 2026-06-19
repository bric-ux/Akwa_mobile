import React, { useCallback, useRef } from 'react';
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
import {
  HOST_COLORS,
  HOTEL_COLORS,
  MONTHLY_RENTAL_COLORS,
  VEHICLE_COLORS,
} from '../constants/colors';

export type HomeCategoryId = 'residence' | 'hotel' | 'monthly' | 'vehicle';

type CategoryDef = {
  id: HomeCategoryId;
  label: string;
  image: number;
  color: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    id: 'residence',
    label: 'Résidences meublées',
    image: require('../../assets/images/plages-assinie.jpg'),
    color: HOST_COLORS.primary,
  },
  {
    id: 'hotel',
    label: 'Hôtels',
    image: require('../../assets/images/abidjan.jpg'),
    color: HOTEL_COLORS.primary,
  },
  ...(FEATURE_MONTHLY_RENTAL
    ? [
        {
          id: 'monthly' as const,
          label: 'Location',
          image: require('../../assets/images/culture.jpg'),
          color: MONTHLY_RENTAL_COLORS.primary,
        },
      ]
    : []),
  {
    id: 'vehicle',
    label: 'Véhicules',
    image: require('../../assets/images/vehicles-suv.jpg'),
    color: VEHICLE_COLORS.primary,
  },
];

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
        onPress={onPress}
        onPressIn={() => {
          Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
        }}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        style={[styles.pill, { borderColor: `${item.color}44` }]}
      >
        <View style={[styles.thumbRing, { borderColor: `${item.color}33` }]}>
          <Image
            source={item.image}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        </View>
        <Text style={[styles.pillLabel, { color: item.color }]}>{item.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const HomeCategoryPills: React.FC<Props> = ({ onCategoryPress }) => {
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
      {CATEGORIES.map((item) => (
        <CategoryPill key={item.id} item={item} onPress={() => handlePress(item.id)} />
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
