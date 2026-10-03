import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useApprovedMonthlyRentalListings } from '../../hooks/useApprovedMonthlyRentalListings';
import { useApprovedHotelEstablishments } from '../../hooks/useApprovedHotelEstablishments';
import MonthlyRentalListingCard from '../MonthlyRentalListingCard';
import HotelEstablishmentCard from '../HotelEstablishmentCard';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../../constants/homeExploreLayout';
import { EXPLORE_SHELF_CARD_WIDTH } from '../../constants/exploreShelfCard';
import { MONTHLY_RENTAL_COLORS, HOTEL_COLORS } from '../../constants/colors';
import type { MonthlyRentalListing } from '../../types';

const SHELF_LIMIT = 8;

type Props = {
  /** Par défaut les deux. Sur l’accueil : hôtel avant résidences, bail longue durée en bas. */
  mode?: 'hotel' | 'monthly' | 'all';
  /** Incrémenté au pull-to-refresh pour forcer un rechargement. */
  refreshKey?: number;
};

/** Rayons accueil : hôtels et/ou bail longue durée — masqués s’il n’y a aucune annonce publiée. */
export default function HomeStayTypeShelves({ mode = 'all', refreshKey = 0 }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { monthlyRental, hotel, loading: flagsLoading } = useFeatureFlags();
  const flagHotel = (mode === 'hotel' || mode === 'all') && hotel;
  const flagMonthly = (mode === 'monthly' || mode === 'all') && monthlyRental;

  const { fetchListings } = useApprovedMonthlyRentalListings();
  const { fetchEstablishments } = useApprovedHotelEstablishments();
  const [monthly, setMonthly] = useState<MonthlyRentalListing[]>([]);
  const [hotels, setHotels] = useState<Awaited<ReturnType<typeof fetchEstablishments>>>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [monthlyReady, setMonthlyReady] = useState(false);
  const [hotelsReady, setHotelsReady] = useState(false);

  const load = useCallback(async () => {
    if (flagsLoading) return;

    if (flagMonthly) {
      setLoadingMonthly(true);
      const list = await fetchListings({});
      setMonthly(list.slice(0, SHELF_LIMIT));
      setLoadingMonthly(false);
      setMonthlyReady(true);
    } else {
      setMonthly([]);
      setMonthlyReady(true);
    }
    if (flagHotel) {
      setLoadingHotels(true);
      const list = await fetchEstablishments({ forHome: true });
      setHotels(list.slice(0, SHELF_LIMIT));
      setLoadingHotels(false);
      setHotelsReady(true);
    } else {
      setHotels([]);
      setHotelsReady(true);
    }
  }, [flagMonthly, flagHotel, flagsLoading, fetchListings, fetchEstablishments]);

  // Recharge à chaque retour sur l’accueil (ex. après approbation admin)
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (refreshKey > 0) void load();
  }, [refreshKey, load]);

  const showHotel = flagHotel && hotelsReady && hotels.length > 0;
  const showMonthly = flagMonthly && monthlyReady && monthly.length > 0;
  const showHotelLoading = flagHotel && !hotelsReady && loadingHotels;
  const showMonthlyLoading = flagMonthly && !monthlyReady && loadingMonthly;

  if (flagsLoading && !flagHotel && !flagMonthly) return null;
  if (!flagHotel && !flagMonthly) return null;
  if (!showHotel && !showMonthly && !showHotelLoading && !showMonthlyLoading) return null;

  return (
    <View style={styles.wrap}>
      {showHotelLoading ? (
        <ActivityIndicator color={HOTEL_COLORS.primary} style={{ marginVertical: 12 }} />
      ) : null}

      {showHotel ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('category.hotels')}</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Search', { initialRentalType: 'hotel' })
              }
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: HOTEL_COLORS.primary }]}>
                {t('common.seeAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelf}
          >
            {hotels.map((item) => (
              <View key={item.id} style={styles.shelfCardWrap}>
                <HotelEstablishmentCard
                  establishment={item}
                  variant="shelf"
                  onPress={(e) =>
                    navigation.navigate('HotelEstablishmentDetail', {
                      establishmentId: e.id,
                    })
                  }
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {showMonthlyLoading ? (
        <ActivityIndicator
          color={MONTHLY_RENTAL_COLORS.primary}
          style={{ marginVertical: 12 }}
        />
      ) : null}

      {showMonthly ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('category.monthly')}</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Search', { initialRentalType: 'monthly' })
              }
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: MONTHLY_RENTAL_COLORS.primary }]}>
                {t('common.seeAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelf}
          >
            {monthly.map((item) => (
              <View key={item.id} style={styles.shelfCardWrap}>
                <MonthlyRentalListingCard
                  listing={item}
                  variant="shelf"
                  onPress={(l) =>
                    navigation.navigate('MonthlyRentalListingDetail', { listingId: l.id })
                  }
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 4 },
  section: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  shelf: {
    paddingHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    paddingRight: HOME_EXPLORE_HORIZONTAL_GUTTER + 16,
    paddingBottom: 4,
  },
  shelfCardWrap: {
    width: EXPLORE_SHELF_CARD_WIDTH,
    marginRight: 12,
  },
});
