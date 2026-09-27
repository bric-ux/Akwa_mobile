import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
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
  /** Par défaut les deux. Sur l’accueil : hôtel avant résidences, longue durée en bas. */
  mode?: 'hotel' | 'monthly' | 'all';
};

/** Rayons accueil : hôtels et/ou longue durée (si flags actifs). */
export default function HomeStayTypeShelves({ mode = 'all' }: Props) {
  const navigation = useNavigation<any>();
  const { monthlyRental, hotel, loading: flagsLoading } = useFeatureFlags();
  const showHotel = (mode === 'hotel' || mode === 'all') && hotel;
  const showMonthly = (mode === 'monthly' || mode === 'all') && monthlyRental;

  const { fetchListings } = useApprovedMonthlyRentalListings();
  const { fetchEstablishments } = useApprovedHotelEstablishments();
  const [monthly, setMonthly] = useState<MonthlyRentalListing[]>([]);
  const [hotels, setHotels] = useState<Awaited<ReturnType<typeof fetchEstablishments>>>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingHotels, setLoadingHotels] = useState(false);

  const load = useCallback(async () => {
    // Pendant le chargement des flags (reload), ne pas vider les rayons
    if (flagsLoading) return;

    if (showMonthly) {
      setLoadingMonthly(true);
      const list = await fetchListings({});
      setMonthly(list.slice(0, SHELF_LIMIT));
      setLoadingMonthly(false);
    } else {
      setMonthly([]);
    }
    if (showHotel) {
      setLoadingHotels(true);
      const list = await fetchEstablishments({ forHome: true });
      setHotels(list.slice(0, SHELF_LIMIT));
      setLoadingHotels(false);
    } else {
      setHotels([]);
    }
  }, [showMonthly, showHotel, flagsLoading, fetchListings, fetchEstablishments]);

  useEffect(() => {
    void load();
  }, [load]);

  // Flags encore en cours + pas encore de data : ne rien afficher (évite flash disparition)
  if (flagsLoading && !showHotel && !showMonthly) return null;
  if (!showHotel && !showMonthly) return null;

  return (
    <View style={styles.wrap}>
      {showHotel ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hôtels</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Search', { initialRentalType: 'hotel' })
              }
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: HOTEL_COLORS.primary }]}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {loadingHotels ? (
            <ActivityIndicator color={HOTEL_COLORS.primary} style={{ marginVertical: 16 }} />
          ) : hotels.length === 0 ? (
            <Text style={styles.empty}>Aucun hôtel publié pour le moment.</Text>
          ) : (
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
          )}
        </View>
      ) : null}

      {showMonthly ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Location longue durée</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Search', { initialRentalType: 'monthly' })
              }
              hitSlop={8}
            >
              <Text style={[styles.seeAll, { color: MONTHLY_RENTAL_COLORS.primary }]}>
                Voir tout
              </Text>
            </TouchableOpacity>
          </View>
          {loadingMonthly ? (
            <ActivityIndicator
              color={MONTHLY_RENTAL_COLORS.primary}
              style={{ marginVertical: 16 }}
            />
          ) : monthly.length === 0 ? (
            <Text style={styles.empty}>Aucune annonce longue durée pour le moment.</Text>
          ) : (
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
          )}
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
  empty: {
    paddingHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    fontSize: 13,
    color: '#888',
  },
});
