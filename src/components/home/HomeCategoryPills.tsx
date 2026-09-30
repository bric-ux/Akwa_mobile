import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../../constants/homeExploreLayout';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useApprovedHotelEstablishments } from '../../hooks/useApprovedHotelEstablishments';
import { useApprovedMonthlyRentalListings } from '../../hooks/useApprovedMonthlyRentalListings';

export type HomeCategoryId = 'residence' | 'monthly' | 'vehicle' | 'hotel';

type CategoryDef = {
  id: HomeCategoryId;
  label: string;
  image: number;
};

const PILL_WIDTH = 148;
const PILL_GAP = 8;

const RESIDENCE_CATEGORY: CategoryDef = {
  id: 'residence',
  label: 'Résidences',
  image: require('../../../assets/images/category-residences.jpg'),
};

const VEHICLE_CATEGORY: CategoryDef = {
  id: 'vehicle',
  label: 'Véhicules',
  image: require('../../../assets/images/category-vehicles.jpg'),
};

const MONTHLY_CATEGORY: CategoryDef = {
  id: 'monthly',
  label: 'Bail longue durée',
  image: require('../../../assets/IMG_9552.jpeg'),
};

const HOTEL_CATEGORY: CategoryDef = {
  id: 'hotel',
  label: 'Hôtels',
  image: require('../../../assets/IMG_9553.jpeg'),
};

/** Pills catégories — hôtel / bail uniquement s’il existe au moins une annonce publiée. */
export default function HomeCategoryPills({ refreshKey = 0 }: { refreshKey?: number }) {
  const navigation = useNavigation();
  const { monthlyRental, hotel, loading: flagsLoading } = useFeatureFlags();
  const { fetchEstablishments } = useApprovedHotelEstablishments();
  const { fetchListings } = useApprovedMonthlyRentalListings();
  const [hasHotels, setHasHotels] = useState(false);
  const [hasMonthly, setHasMonthly] = useState(false);

  const loadPresence = useCallback(async () => {
    if (flagsLoading) return;

    if (hotel) {
      const list = await fetchEstablishments({ forHome: true });
      setHasHotels(list.length > 0);
    } else {
      setHasHotels(false);
    }

    if (monthlyRental) {
      const list = await fetchListings({});
      setHasMonthly(list.length > 0);
    } else {
      setHasMonthly(false);
    }
  }, [flagsLoading, hotel, monthlyRental, fetchEstablishments, fetchListings]);

  useFocusEffect(
    useCallback(() => {
      void loadPresence();
    }, [loadPresence]),
  );

  useEffect(() => {
    if (refreshKey > 0) void loadPresence();
  }, [refreshKey, loadPresence]);

  // Ordre : Hôtels → Résidences → Véhicules → Bail longue durée (en dernier)
  const categories = useMemo(() => {
    const list: CategoryDef[] = [];
    if (hotel && hasHotels) list.push(HOTEL_CATEGORY);
    list.push(RESIDENCE_CATEGORY, VEHICLE_CATEGORY);
    if (monthlyRental && hasMonthly) list.push(MONTHLY_CATEGORY);
    return list;
  }, [monthlyRental, hotel, hasHotels, hasMonthly]);

  const onPress = (id: HomeCategoryId) => {
    switch (id) {
      case 'residence':
        (navigation as any).navigate('Search', { initialRentalType: 'short_term' });
        break;
      case 'monthly':
        (navigation as any).navigate('Search', { initialRentalType: 'monthly' });
        break;
      case 'hotel':
        (navigation as any).navigate('Search', { initialRentalType: 'hotel' });
        break;
      case 'vehicle':
        (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' });
        break;
      default:
        break;
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.nav}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginTop: 12,
    marginBottom: 4,
    flexGrow: 0,
  },
  nav: {
    paddingHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    flexDirection: 'row',
    gap: PILL_GAP,
  },
  pill: {
    width: PILL_WIDTH,
    height: 80,
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
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  chevron: {
    width: 18,
    height: 18,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
