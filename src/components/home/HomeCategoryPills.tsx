import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../../constants/homeExploreLayout';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useApprovedHotelEstablishments } from '../../hooks/useApprovedHotelEstablishments';
import { useApprovedMonthlyRentalListings } from '../../hooks/useApprovedMonthlyRentalListings';

export type HomeCategoryId = 'residence' | 'monthly' | 'vehicle' | 'hotel';

type CategoryDef = {
  id: HomeCategoryId;
  labelKey: string;
};

const RESIDENCE_CATEGORY: CategoryDef = {
  id: 'residence',
  labelKey: 'category.residences',
};

const VEHICLE_CATEGORY: CategoryDef = {
  id: 'vehicle',
  labelKey: 'category.vehicles',
};

const MONTHLY_CATEGORY: CategoryDef = {
  id: 'monthly',
  labelKey: 'category.monthly',
};

const HOTEL_CATEGORY: CategoryDef = {
  id: 'hotel',
  labelKey: 'category.hotels',
};

/** Pills catégories — hôtel / bail uniquement s’il existe au moins une annonce publiée. */
export default function HomeCategoryPills({ refreshKey = 0 }: { refreshKey?: number }) {
  const navigation = useNavigation();
  const { t } = useLanguage();
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
    <View style={styles.wrap} accessibilityLabel={t('home.browseCategories')}>
      {categories.map((item) => {
        const label = t(item.labelKey);
        const current = item.id === 'residence';
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => onPress(item.id)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: current }}
          >
            <Text style={[styles.label, current && styles.labelCurrent]} numberOfLines={1}>
              {label}
            </Text>
            <View style={[styles.rule, current && styles.ruleCurrent]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 22,
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  item: {
    paddingBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
  },
  labelCurrent: {
    fontWeight: '600',
    color: '#0f172a',
  },
  rule: {
    height: 2,
    marginTop: 8,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  ruleCurrent: {
    backgroundColor: '#0f172a',
  },
});
