import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../../constants/homeExploreLayout';
import { FEATURE_MONTHLY_RENTAL } from '../../constants/features';

export type HomeCategoryId = 'residence' | 'monthly' | 'vehicle';

type CategoryDef = {
  id: HomeCategoryId;
  label: string;
  image: number;
};

const BASE_CATEGORIES: CategoryDef[] = [
  {
    id: 'residence',
    label: 'Résidences',
    image: require('../../../assets/images/category-residences.jpg'),
  },
  {
    id: 'vehicle',
    label: 'Véhicules',
    image: require('../../../assets/images/category-vehicles.jpg'),
  },
];

const MONTHLY_CATEGORY: CategoryDef = {
  id: 'monthly',
  label: 'Location',
  image: require('../../../assets/images/abidjan.jpg'),
};

type Props = {
  showMonthlyCategory?: boolean;
};

export default function HomeCategoryPills({ showMonthlyCategory = true }: Props) {
  const navigation = useNavigation();

  const categories = [...BASE_CATEGORIES];
  if (FEATURE_MONTHLY_RENTAL && showMonthlyCategory) {
    categories.splice(1, 0, MONTHLY_CATEGORY);
  }

  const onPress = (id: HomeCategoryId) => {
    switch (id) {
      case 'residence':
        (navigation as any).navigate('Search');
        break;
      case 'monthly':
        (navigation as any).navigate('Search', { rentalType: 'monthly' });
        break;
      case 'vehicle':
        (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' });
        break;
      default:
        break;
    }
  };

  return (
    <View
      style={styles.nav}
      accessibilityRole="summary"
      accessibilityLabel="Parcourir par catégorie"
    >
      {categories.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.pill}
          activeOpacity={0.92}
          onPress={() => onPress(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <ImageBackground
            source={item.image}
            style={styles.image}
            resizeMode="cover"
          >
            <View style={styles.scrim} />
            <View style={styles.labelRow}>
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
              <View style={styles.chevron}>
                <Ionicons name="chevron-forward" size={12} color="#fff" />
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    height: 72,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#0f172a',
  },
  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 10,
    zIndex: 1,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  chevron: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
