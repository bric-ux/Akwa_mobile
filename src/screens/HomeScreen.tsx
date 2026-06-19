import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExploreCityHome, ExploreCitySection } from '../hooks/useExploreCityHome';
import { useExploreHotelsHome } from '../hooks/useExploreHotelsHome';
import { Property, HotelEstablishment } from '../types';
import PropertyCard from '../components/PropertyCard';
import HotelCard from '../components/HotelCard';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { InfoBanner } from '../components/InfoBanner';
import ImageCarousel from '../components/ImageCarousel';
import WeatherDateTimeWidget from '../components/WeatherDateTimeWidget';
import ZipDailyCard from '../components/zip/ZipDailyCard';
import MatchPredictionBanner from '../components/MatchPredictionBanner';
import TeddyExploreFab from '../components/TeddyExploreFab';
import HomeCategoryPills from '../components/HomeCategoryPills';
import type { HomeCategoryId } from '../types/homeCategory';
import SearchCatalogWarmer from '../components/SearchCatalogWarmer';
import { useLanguage } from '../contexts/LanguageContext';
import { useNetwork } from '../contexts/NetworkContext';
import LoadErrorCard from '../components/LoadErrorCard';
import type { LoadFailureKind } from '../utils/loadError';
import {
  HOME_EXPLORE_HORIZONTAL_GUTTER,
  HOME_EXPLORE_CAROUSEL_LEFT_INSET,
} from '../constants/homeExploreLayout';
import { HOTEL_COLORS, MONTHLY_RENTAL_COLORS } from '../constants/colors';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';
import { useApprovedMonthlyRentalListings } from '../hooks/useApprovedMonthlyRentalListings';
import MonthlyRentalListingCard from '../components/MonthlyRentalListingCard';
import type { MonthlyRentalListing } from '../types';
import { EXPLORE_SHELF_CARD_WIDTH, EXPLORE_SHELF_IMAGE_HEIGHT } from '../constants/exploreShelfCard';

/** Titres explore + première carte : alignés sur le carrousel « trésors CI » ; carte suivante visible */
const EXPLORE_GUTTER = HOME_EXPLORE_HORIZONTAL_GUTTER;
const NEXT_CARD_PEEK = 48;

const EXPLORE_CARD_WIDTH = EXPLORE_SHELF_CARD_WIDTH;

const KEYBOX_WHATSAPP_URL =
  'https://wa.me/33667672022?text=' +
  encodeURIComponent(
    "Bonjour, je suis propriétaire d'une résidence meublée et je souhaite des informations sur l'installation de boîtes à clés AkwaHome.",
  );

// Données du carrousel en dehors du composant pour éviter re-création à chaque rendu
const CAROUSEL_IMAGES = [
  { id: '1', source: require('../../assets/images/pont.jpg'), title: 'Pont Ado', description: 'Pont emblématique d\'Abidjan, symbole de modernité' },
  { id: '2', source: require('../../assets/images/basilique-yamoussoukro.jpg'), title: 'Basilique Notre-Dame de la Paix', description: 'Plus grande basilique au monde, chef-d\'œuvre de Yamoussoukro' },
  { id: '3', source: require('../../assets/images/elephants.jpg'), title: 'Parc National de la Comoé', description: 'Réserve de biosphère UNESCO, sanctuaire de la faune africaine' },
  { id: '4', source: require('../../assets/images/culture.jpg'), title: 'Masques Baoulé', description: 'Patrimoine culturel immatériel de l\'UNESCO' },
  { id: '5', source: require('../../assets/images/abidjan.jpg'), title: 'Abidjan by Night', description: 'La perle des lagunes illuminée' },
  { id: '6', source: require('../../assets/images/plages-assinie.jpg'), title: 'Côte d\'Assinie', description: 'Plages paradisiaques et villages de pêcheurs traditionnels' },
];

/** Espace sous la liste pour le FAB Teddy (remplace l’ancien bouton +) */
const TEDDY_FAB_SCROLL_PADDING = 72;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const vehiclesPromoNarrow = windowWidth < 400;
  const { t } = useLanguage();
  const { isOffline } = useNetwork();
  const {
    layoutSections: exploreSections,
    loading: exploreLoading,
    error: exploreError,
    refreshExploreCityHome,
  } = useExploreCityHome();
  const {
    hotels: exploreHotels,
    loading: exploreHotelsLoading,
    refreshExploreHotelsHome,
  } = useExploreHotelsHome();
  const {
    listings: exploreMonthlyListings,
    loading: exploreMonthlyLoading,
    fetchListings: fetchExploreMonthlyListings,
  } = useApprovedMonthlyRentalListings();

  const [refreshing, setRefreshing] = useState(false);
  const lastScrollY = useRef(0);
  const [teddyFabVisibleFromScroll, setTeddyFabVisibleFromScroll] = useState(true);
  const teddyFabVisibleRef = useRef(true);
  const [carouselBannerVisible, setCarouselBannerVisible] = useState(true);
  const carouselBannerVisibleRef = useRef(true);
  const [showDeferredHeaderContent, setShowDeferredHeaderContent] = useState(false);

  useEffect(() => {
    if (FEATURE_MONTHLY_RENTAL) {
      void fetchExploreMonthlyListings();
    }
  }, [fetchExploreMonthlyListings]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setShowDeferredHeaderContent(true);
    });
    return () => {
      task.cancel();
    };
  }, []);

  const setFabVisibleIfNeeded = useCallback((next: boolean) => {
    if (teddyFabVisibleRef.current === next) return;
    teddyFabVisibleRef.current = next;
    setTeddyFabVisibleFromScroll(next);
  }, []);

  const setCarouselBannerVisibleIfNeeded = useCallback((next: boolean) => {
    if (carouselBannerVisibleRef.current === next) return;
    carouselBannerVisibleRef.current = next;
    setCarouselBannerVisible(next);
  }, []);

  const onExploreScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const prev = lastScrollY.current;
    if (y < 120) {
      setFabVisibleIfNeeded(true);
      setCarouselBannerVisibleIfNeeded(true);
    } else if (y > prev + 8) {
      setFabVisibleIfNeeded(false);
      setCarouselBannerVisibleIfNeeded(false);
    } else if (y < prev - 8) {
      setFabVisibleIfNeeded(true);
      setCarouselBannerVisibleIfNeeded(true);
    }
    lastScrollY.current = y;
  }, [setFabVisibleIfNeeded, setCarouselBannerVisibleIfNeeded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshExploreCityHome(),
        refreshExploreHotelsHome(),
        FEATURE_MONTHLY_RENTAL ? fetchExploreMonthlyListings() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshExploreCityHome, refreshExploreHotelsHome, fetchExploreMonthlyListings]);

  const handlePropertyPress = useCallback((property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  }, [navigation]);

  const handleHotelPress = useCallback((establishment: HotelEstablishment) => {
    navigation.navigate('HotelDetails', { establishmentId: establishment.id });
  }, [navigation]);

  const navigateSearch = useCallback(
    (
      rentalType: 'short_term' | 'monthly' = 'short_term',
      destination?: string,
      options?: { openResults?: boolean; accommodationType?: 'all' | 'property' | 'hotel' },
    ) => {
      (navigation as any).navigate('Search', {
        destination,
        initialRentalType: rentalType,
        initialAccommodationType: options?.accommodationType,
        openResults: options?.openResults ?? false,
      });
    },
    [navigation],
  );

  const navigateSearchHotels = useCallback(() => {
    navigateSearch('short_term', undefined, { openResults: true, accommodationType: 'hotel' });
  }, [navigateSearch]);

  const explorePropertiesTotal = useMemo(() => {
    return exploreSections.reduce((sum, section) => {
      if (section.kind === 'large') return sum + section.group.totalCount;
      return sum + section.groups.reduce((s, g) => s + g.totalCount, 0);
    }, 0);
  }, [exploreSections]);

  const handleSearchPress = useCallback(() => {
    navigateSearch('short_term');
  }, [navigateSearch]);

  const handleCategoryPress = useCallback(
    (category: HomeCategoryId) => {
      switch (category) {
        case 'residence':
          navigateSearch('short_term', undefined, {
            openResults: true,
            accommodationType: 'property',
          });
          break;
        case 'hotel':
          navigateSearch('short_term', undefined, {
            openResults: true,
            accommodationType: 'hotel',
          });
          break;
        case 'monthly':
          navigateSearch('monthly', undefined, { openResults: true });
          break;
        case 'vehicle':
          (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' });
          break;
        default:
          break;
      }
    },
    [navigateSearch, navigation],
  );

  const handleMonthlyListingPress = useCallback(
    (listing: MonthlyRentalListing) => {
      navigation.navigate('MonthlyRentalListingDetail' as never, { listingId: listing.id });
    },
    [navigation],
  );

  const navigateSearchMonthly = useCallback(() => {
    navigateSearch('monthly', undefined, { openResults: true });
  }, [navigateSearch]);

  const navigateSearchCity = useCallback(
    (cityName: string) => {
      navigateSearch('short_term', cityName, { openResults: true, accommodationType: 'property' });
    },
    [navigateSearch],
  );

  const openKeyboxWhatsApp = useCallback(() => {
    Linking.openURL(KEYBOX_WHATSAPP_URL).catch(() => {});
  }, []);

  const renderExplorePropertyRow = useCallback(
    (properties: Property[]) => {
      return (
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.exploreRowScroll}
          contentContainerStyle={styles.exploreRowContent}
        >
          {properties.map((p) => (
            <View key={p.id} style={[styles.exploreCardWrap, { width: EXPLORE_CARD_WIDTH }]}>
              <PropertyCard
                property={p}
                onPress={handlePropertyPress}
                variant="list"
                horizontalShelf
              />
            </View>
          ))}
        </ScrollView>
      );
    },
    [handlePropertyPress],
  );

  const renderExploreHotelRow = useCallback(
    (hotels: HotelEstablishment[]) => (
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.exploreRowScroll}
        contentContainerStyle={styles.exploreRowContent}
      >
        {hotels.map((hotel) => (
          <View key={hotel.id} style={[styles.exploreCardWrap, { width: EXPLORE_CARD_WIDTH }]}>
            <HotelCard
              establishment={hotel}
              onPress={handleHotelPress}
              horizontalShelf
            />
          </View>
        ))}
      </ScrollView>
    ),
    [handleHotelPress],
  );

  const renderExploreMonthlyRow = useCallback(
    (listings: MonthlyRentalListing[]) => (
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.exploreRowScroll}
        contentContainerStyle={styles.exploreRowContent}
      >
        {listings.map((listing) => (
          <View key={listing.id} style={[styles.exploreCardWrap, { width: EXPLORE_CARD_WIDTH }]}>
            <MonthlyRentalListingCard
              listing={listing}
              onPress={handleMonthlyListingPress}
              variant="list"
              horizontalShelf
            />
          </View>
        ))}
      </ScrollView>
    ),
    [handleMonthlyListingPress],
  );

  const exploreMonthlySection = useMemo(() => {
    if (!FEATURE_MONTHLY_RENTAL) return null;
    if (exploreMonthlyLoading && exploreMonthlyListings.length === 0) {
      return (
        <View style={styles.exploreHotelsWarmup}>
          <View style={styles.exploreHotelsWarmupCard} />
          <View style={styles.exploreHotelsWarmupCard} />
        </View>
      );
    }
    if (exploreMonthlyListings.length === 0) return null;

    const count = exploreMonthlyListings.length;
    const subtitle = `${count} location${count > 1 ? 's' : ''} au mois disponible${count > 1 ? 's' : ''}`;

    return (
      <View style={styles.exploreSection}>
        <View style={styles.exploreSectionHeader}>
          <View style={styles.exploreSectionTitles}>
            <View style={styles.exploreHotelsTitleRow}>
              <Ionicons name="calendar" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
              <Text style={styles.exploreCityTitle}>Locations mensuelles</Text>
            </View>
            <Text style={styles.exploreCitySubtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.exploreVoirTout}
            onPress={navigateSearchMonthly}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.exploreVoirToutText}>Voir tout</Text>
            <Ionicons name="chevron-forward" size={16} color="#475569" />
          </TouchableOpacity>
        </View>
        {renderExploreMonthlyRow(exploreMonthlyListings.slice(0, 8))}
      </View>
    );
  }, [
    exploreMonthlyListings,
    exploreMonthlyLoading,
    navigateSearchMonthly,
    renderExploreMonthlyRow,
  ]);

  const exploreHotelsSection = useMemo(() => {
    if (exploreHotelsLoading && exploreHotels.length === 0) {
      return (
        <View style={styles.exploreHotelsWarmup}>
          <View style={styles.exploreHotelsWarmupCard} />
          <View style={styles.exploreHotelsWarmupCard} />
        </View>
      );
    }
    if (exploreHotels.length === 0) return null;

    const count = exploreHotels.length;
    const subtitle = `${count} établissement${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`;

    return (
      <View style={styles.exploreSection}>
        <View style={styles.exploreSectionHeader}>
          <View style={styles.exploreSectionTitles}>
            <View style={styles.exploreHotelsTitleRow}>
              <Ionicons name="bed" size={18} color={HOTEL_COLORS.primary} />
              <Text style={styles.exploreCityTitle}>Hôtels & Appart&apos;hôtel</Text>
            </View>
            <Text style={styles.exploreCitySubtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.exploreVoirTout}
            onPress={navigateSearchHotels}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.exploreVoirToutText}>Voir tout</Text>
            <Ionicons name="chevron-forward" size={16} color="#475569" />
          </TouchableOpacity>
        </View>
        {renderExploreHotelRow(exploreHotels)}
      </View>
    );
  }, [
    exploreHotels,
    exploreHotelsLoading,
    navigateSearchHotels,
    renderExploreHotelRow,
  ]);

  const renderExploreSection = useCallback(
    ({ item }: { item: ExploreCitySection }) => {
      if (item.kind === 'large') {
        const g = item.group;
        const count = g.totalCount;
        const subtitle = `${count} logement${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`;
        return (
          <View style={styles.exploreSection}>
            <View style={styles.exploreSectionHeader}>
              <View style={styles.exploreSectionTitles}>
                <Text style={styles.exploreCityTitle}>{g.cityName}</Text>
                <Text style={styles.exploreCitySubtitle}>{subtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.exploreVoirTout}
                onPress={() => navigateSearchCity(g.cityName)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.exploreVoirToutText}>Voir tout</Text>
                <Ionicons name="chevron-forward" size={16} color="#475569" />
              </TouchableOpacity>
            </View>
            {renderExplorePropertyRow(g.properties)}
          </View>
        );
      }

      const chunk = item.groups;
      const clusterTotal = chunk.reduce((sum, cg) => sum + cg.totalCount, 0);
      const title = chunk.map((cg) => cg.cityName).join(' & ');
      const subtitle = `${clusterTotal} logement${clusterTotal > 1 ? 's' : ''} disponible${clusterTotal > 1 ? 's' : ''}`;
      const flat = chunk.flatMap((cg) => cg.properties);

      return (
        <View style={styles.exploreSection}>
          <View style={styles.exploreSectionHeader}>
            <View style={styles.exploreSectionTitles}>
              <Text style={styles.exploreCityTitle}>{title}</Text>
              <Text style={styles.exploreCitySubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity
              style={styles.exploreVoirTout}
              onPress={() => (navigation as any).navigate('Search')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.exploreVoirToutText}>Voir plus</Text>
              <Ionicons name="chevron-forward" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
          {renderExplorePropertyRow(flat)}
        </View>
      );
    },
    [handlePropertyPress, navigateSearchCity, navigation, renderExplorePropertyRow],
  );

  const exploreFailureKind: LoadFailureKind | null = exploreError
    ? isOffline
      ? 'offline'
      : 'network'
    : null;

  const exploreErrorCard = useMemo(() => {
    if (!exploreFailureKind) return null;
    const title = isOffline ? t('home.exploreLoadErrorOffline') : t('home.exploreLoadError');
    const message = isOffline ? t('common.offlineHint') : t('common.checkConnection');
    return (
      <LoadErrorCard
        kind={exploreFailureKind}
        title={title}
        message={message}
        retryLabel={t('common.retry')}
        onRetry={() => void refreshExploreCityHome()}
        compact
      />
    );
  }, [exploreFailureKind, isOffline, t, refreshExploreCityHome]);

  const listHeader = useMemo(() => (
    <>
      <HeroSection onSearchPress={handleSearchPress} />

      <HomeCategoryPills onCategoryPress={handleCategoryPress} />

      {showDeferredHeaderContent ? (
        <>
          <WeatherDateTimeWidget />
          <MatchPredictionBanner />
          <ZipDailyCard />
          <ImageCarousel
            images={CAROUSEL_IMAGES}
            onImagePress={() => {}}
          />
        </>
      ) : (
        <View style={styles.headerDeferredPlaceholder} />
      )}

      <View>
        {exploreErrorCard}
        {exploreMonthlySection}
        {exploreHotelsSection}
        {explorePropertiesTotal > 0 || exploreLoading ? (
          <View style={styles.explorePropertiesIntro}>
            <View style={styles.exploreHotelsTitleRow}>
              <Ionicons name="home" size={18} color="#2E7D32" />
              <Text style={styles.exploreCityTitle}>Résidences meublées</Text>
            </View>
          </View>
        ) : null}
      </View>
    </>
  ), [handleSearchPress, handleCategoryPress, showDeferredHeaderContent, exploreErrorCard, exploreMonthlySection, exploreHotelsSection, explorePropertiesTotal, exploreLoading]);

  const listFooter = useMemo(
    () => (
      <>
        {/* Location de véhicules — après les résidences par ville */}
        <View style={styles.vehiclesPromoSection}>
          <View
            style={[
              styles.vehiclesPromoBackground,
              vehiclesPromoNarrow && styles.vehiclesPromoBackgroundNarrow,
            ]}
          >
            <Image
              source={require('../../assets/images/vehicles-suv.jpg')}
              style={styles.vehiclesPromoBgImage}
              contentFit="cover"
              contentPosition="center"
              cachePolicy="memory-disk"
              priority="high"
              transition={200}
            />
            <View
              style={[
                styles.vehiclesPromoOverlay,
                vehiclesPromoNarrow && styles.vehiclesPromoOverlayNarrow,
              ]}
            >
              <View
                style={[
                  styles.vehiclesPromoContent,
                  vehiclesPromoNarrow && styles.vehiclesPromoContentNarrow,
                ]}
              >
                <View style={[styles.vehiclesPromoLeft, vehiclesPromoNarrow && styles.vehiclesPromoLeftNarrow]}>
                  <View style={styles.vehiclesPromoBadge}>
                    <Ionicons name="flash" size={16} color="#FFD700" />
                    <Text style={styles.vehiclesPromoBadgeText}>NOUVEAU</Text>
                  </View>
                  {vehiclesPromoNarrow ? (
                    <View>
                      <Text style={[styles.vehiclesPromoTitle, styles.vehiclesPromoTitleNarrow]}>
                        Location de
                      </Text>
                      <Text style={[styles.vehiclesPromoTitle, styles.vehiclesPromoTitleSecondLine]}>
                        véhicules
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.vehiclesPromoTitle}>Location de véhicules</Text>
                  )}
                  <Text
                    style={[
                      styles.vehiclesPromoSubtitle,
                      vehiclesPromoNarrow && styles.vehiclesPromoSubtitleNarrow,
                    ]}
                  >
                    Explorez la Côte d&apos;Ivoire à votre rythme
                  </Text>
                  <Text
                    style={[
                      styles.vehiclesPromoDescription,
                      vehiclesPromoNarrow && styles.vehiclesPromoDescriptionNarrow,
                    ]}
                  >
                    Trouvez le véhicule parfait pour votre voyage. Des voitures, SUV, motos et plus
                    encore disponibles à la location.
                  </Text>
                  <TouchableOpacity
                    style={[styles.vehiclesPromoButton, vehiclesPromoNarrow && styles.vehiclesPromoButtonNarrow]}
                    onPress={() => (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' })}
                  >
                    <Text style={styles.vehiclesPromoButtonText}>Découvrir les véhicules</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.vehiclesPromoRight, vehiclesPromoNarrow && styles.vehiclesPromoRightNarrow]}>
                  <View
                    style={[
                      styles.vehiclesPromoIconContainer,
                      vehiclesPromoNarrow && styles.vehiclesPromoIconContainerNarrow,
                    ]}
                  >
                    <Ionicons name="car-sport" size={vehiclesPromoNarrow ? 40 : 64} color="#2E7D32" />
                  </View>
                  <View
                    style={[styles.vehiclesPromoFeatures, vehiclesPromoNarrow && styles.vehiclesPromoFeaturesNarrow]}
                  >
                    <View style={styles.vehiclesPromoFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                      <Text style={styles.vehiclesPromoFeatureText}>Large choix</Text>
                    </View>
                    <View style={styles.vehiclesPromoFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                      <Text style={styles.vehiclesPromoFeatureText}>Prix compétitifs</Text>
                    </View>
                    <View style={styles.vehiclesPromoFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                      <Text style={styles.vehiclesPromoFeatureText}>Réservation facile</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Boîtes à clés — propriétaires (aligné site Index.tsx) */}
        <View style={styles.keyboxSection}>
          <View style={styles.keyboxCard}>
            <View style={styles.keyboxVisualWrap}>
              <View style={styles.keyboxMainImgWrap}>
                <Image
                  source={require('../../assets/images/keybox-wall.jpg')}
                  style={styles.keyboxMainImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </View>
              <View style={styles.keyboxInsetWrap}>
                <View style={styles.keyboxInsetImgWrap}>
                  <Image
                    source={require('../../assets/images/keybox-open.jpg')}
                    style={styles.keyboxInsetImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
                <View style={styles.keyboxInsetBadge}>
                  <Ionicons name="key" size={14} color="#fff" />
                </View>
              </View>
            </View>

            <Text style={styles.keyboxKicker}>Propriétaires</Text>
            <Text style={styles.keyboxTitle}>
              Résidences meublées :{' '}
              <Text style={styles.keyboxTitleAccent}>simplifiez votre quotidien</Text>
            </Text>
            <Text style={styles.keyboxBody}>
              Installation de <Text style={styles.keyboxBodyStrong}>boîtes à clés</Text> pour faciliter
              arrivées et départs, sans surcharger votre planning.
            </Text>
            <Text style={styles.keyboxHint}>Arrivée autonome · Moins de trajets · Discret et sécurisé</Text>

            <TouchableOpacity
              style={styles.keyboxWaBtn}
              onPress={openKeyboxWhatsApp}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel="Écrire sur WhatsApp pour les boîtes à clés"
            >
              <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              <Text style={styles.keyboxWaBtnText}>Écrire sur WhatsApp</Text>
            </TouchableOpacity>
            <Text style={styles.keyboxWaFoot}>Réponse sous 24h · sans engagement</Text>
          </View>
        </View>

        <View style={styles.conciergeriePromoSection}>
          <TouchableOpacity
            style={styles.conciergeriePromoCard}
            onPress={() => navigation.navigate('Conciergerie' as never)}
            activeOpacity={0.9}
          >
            <View style={styles.conciergeriePromoBackground}>
              <View style={styles.conciergeriePromoGradient} />
              <View style={styles.conciergeriePromoCircle1} />
              <View style={styles.conciergeriePromoCircle2} />
            </View>

            <View style={styles.conciergeriePromoContent}>
              <View style={styles.conciergeriePromoLeft}>
                <View style={styles.conciergeriePromoIconContainer}>
                  <Ionicons name="sparkles" size={32} color="#FFFFFF" />
                </View>
                <View style={styles.conciergeriePromoTextContainer}>
                  <View style={styles.conciergeriePromoBadgeRow}>
                    <View style={styles.conciergeriePromoBadge}>
                      <Text style={styles.conciergeriePromoBadgeText}>✨ NOUVEAUTÉ</Text>
                    </View>
                  </View>
                  <Text style={styles.conciergeriePromoTitle}>Service de Conciergerie AkwaHome</Text>
                  <Text style={styles.conciergeriePromoDescription}>
                    Maximisez vos revenus de <Text style={styles.conciergeriePromoHighlight}>+65%</Text>{' '}
                    sans effort • Support{' '}
                    <Text style={styles.conciergeriePromoHighlight}>24h/7j</Text> • Satisfaction{' '}
                    <Text style={styles.conciergeriePromoHighlight}>98%</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.conciergeriePromoRight}>
                <View style={styles.conciergeriePromoArrowContainer}>
                  <Ionicons name="arrow-forward" size={24} color="#e67e22" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </>
    ),
    [navigation, openKeyboxWhatsApp, vehiclesPromoNarrow],
  );
  const scrollContentStyle = useMemo(
    () => [styles.scrollContent, { paddingBottom: 20 + TEDDY_FAB_SCROLL_PADDING }],
    []
  );

  const exploreKeyExtractor = useCallback((item: ExploreCitySection) => {
    if (item.kind === 'large') return `city-${item.group.citySlug}`;
    const slugs = [...item.groups.map((g) => g.citySlug)].sort().join('-');
    return `pair-${slugs}`;
  }, []);
  const emptyMessageShort = t('property.noProperties');
  const listLoadingEmpty = exploreLoading && exploreSections.length === 0;
  const listEmptyComponent = useMemo(() => {
    if (listLoadingEmpty) {
      return (
        <View style={styles.warmupContainer}>
          <View style={styles.warmupRow}>
            <View style={styles.warmupCard} />
            <View style={styles.warmupCard} />
            <View style={styles.warmupCard} />
          </View>
        </View>
      );
    }
    if (exploreFailureKind && exploreSections.length === 0) {
      return (
        <LoadErrorCard
          kind={exploreFailureKind}
          title={isOffline ? t('home.exploreLoadErrorOffline') : t('home.exploreLoadError')}
          message={isOffline ? t('common.offlineHint') : t('common.checkConnection')}
          retryLabel={t('common.retry')}
          onRetry={() => void refreshExploreCityHome()}
        />
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{emptyMessageShort}</Text>
        <Text style={styles.emptySubtitle}>{t('property.noPropertiesDesc')}</Text>
        <Text style={styles.emptySubtitle}>{t('property.noPropertiesSubtext')}</Text>
      </View>
    );
  }, [
    emptyMessageShort,
    t,
    listLoadingEmpty,
    exploreFailureKind,
    exploreSections.length,
    isOffline,
    refreshExploreCityHome,
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SearchCatalogWarmer />
      <View style={styles.container}>
        <Header />
        <InfoBanner showCarousel={carouselBannerVisible} />
        
        <FlatList
          style={styles.content}
          data={exploreSections}
          renderItem={renderExploreSection}
          keyExtractor={exploreKeyExtractor}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          contentContainerStyle={scrollContentStyle}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e67e22"
            />
          }
          onScroll={onExploreScroll}
          scrollEventThrottle={32}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={6}
          windowSize={9}
          initialNumToRender={5}
          updateCellsBatchingPeriod={50}
        />

        <TeddyExploreFab
          bottomOffset={Math.max(insets.bottom, 6) + 10}
          fabVisibleFromScroll={teddyFabVisibleFromScroll}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 0,
    paddingBottom: 0,
    marginLeft: 0,
    paddingLeft: 0,
    marginRight: 0,
    paddingRight: 0,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 0,
    marginTop: 0,
    flexGrow: 1,
    paddingLeft: 0,
    paddingRight: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  headerDeferredPlaceholder: {
    height: 16,
  },
  warmupContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  warmupRow: {
    flexDirection: 'row',
    gap: 12,
  },
  warmupCard: {
    height: 216,
    flex: 1,
    minWidth: 170,
    borderRadius: 14,
    backgroundColor: '#eef2f7',
  },
  section: {
    marginVertical: 20,
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  exploreSection: {
    marginBottom: 22,
    backgroundColor: 'transparent',
  },
  exploreIntroHeader: {
    paddingHorizontal: EXPLORE_GUTTER,
    marginBottom: 15,
  },
  exploreSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: EXPLORE_GUTTER,
    marginBottom: 10,
    gap: 10,
  },
  exploreSectionTitles: {
    flex: 1,
    minWidth: 0,
  },
  exploreCityTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
  },
  exploreCitySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  exploreVoirTout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  exploreVoirToutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  exploreRowScroll: {
    flexGrow: 0,
    marginLeft: 0,
    marginRight: -EXPLORE_GUTTER,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  exploreRowContent: {
    paddingLeft: EXPLORE_GUTTER + HOME_EXPLORE_CAROUSEL_LEFT_INSET,
    paddingRight: NEXT_CARD_PEEK,
    paddingBottom: 6,
    paddingTop: 2,
    alignItems: 'flex-start',
  },
  exploreCardWrap: {
    marginRight: 12,
  },
  exploreHotelsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explorePropertiesIntro: {
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: EXPLORE_GUTTER,
  },
  exploreHotelsWarmup: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: EXPLORE_GUTTER,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  exploreHotelsWarmupCard: {
    width: EXPLORE_CARD_WIDTH,
    height: EXPLORE_SHELF_IMAGE_HEIGHT,
    borderRadius: 26,
    backgroundColor: '#e9ecef',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 5,
  },
  propertiesGrid: {
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#6c757d',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
  },
  vehiclesPromoSection: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  vehiclesPromoBackground: {
    width: '100%',
    minHeight: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1e293b',
  },
  vehiclesPromoBackgroundNarrow: {
    minHeight: 280,
  },
  vehiclesPromoBgImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  vehiclesPromoOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 20,
    borderRadius: 16,
    minHeight: 220,
  },
  vehiclesPromoOverlayNarrow: {
    minHeight: 260,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  vehiclesPromoContent: {
    flexDirection: 'row',
  },
  vehiclesPromoContentNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  vehiclesPromoLeft: {
    flex: 1,
    paddingRight: 12,
  },
  vehiclesPromoLeftNarrow: {
    paddingRight: 0,
    width: '100%',
  },
  vehiclesPromoTitleNarrow: {
    fontSize: 22,
    marginBottom: 0,
    lineHeight: 26,
  },
  vehiclesPromoTitleSecondLine: {
    fontSize: 22,
    marginBottom: 8,
    lineHeight: 26,
  },
  vehiclesPromoSubtitleNarrow: {
    fontSize: 14,
    marginBottom: 8,
  },
  vehiclesPromoDescriptionNarrow: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  vehiclesPromoButtonNarrow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  vehiclesPromoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 4,
  },
  vehiclesPromoBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FF8C00',
    letterSpacing: 0.5,
  },
  vehiclesPromoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  vehiclesPromoSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  vehiclesPromoDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  vehiclesPromoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#2E7D32',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  vehiclesPromoButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  vehiclesPromoRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  vehiclesPromoRightNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 0,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
    width: '100%',
  },
  vehiclesPromoIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  vehiclesPromoIconContainerNarrow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 0,
    marginRight: 8,
  },
  vehiclesPromoFeatures: {
    gap: 8,
  },
  vehiclesPromoFeaturesNarrow: {
    flex: 1,
    minWidth: 0,
  },
  vehiclesPromoFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehiclesPromoFeatureText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  keyboxSection: {
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 4,
    marginBottom: 4,
  },
  keyboxCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  keyboxVisualWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 240,
    alignSelf: 'center',
    marginBottom: 16,
    paddingBottom: 36,
  },
  keyboxMainImgWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e7e5e4',
    backgroundColor: '#f8fafc',
  },
  keyboxMainImg: {
    width: '100%',
    height: 152,
  },
  keyboxInsetWrap: {
    position: 'absolute',
    bottom: 6,
    right: -4,
    width: '56%',
    maxWidth: 132,
  },
  keyboxInsetImgWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(46, 125, 50, 0.35)',
    backgroundColor: '#fff',
  },
  keyboxInsetImg: {
    width: '100%',
    height: 88,
  },
  keyboxInsetBadge: {
    position: 'absolute',
    left: -8,
    top: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  keyboxKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#2E7D32',
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  keyboxTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  keyboxTitleAccent: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  keyboxBody: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 21,
    textAlign: 'center',
  },
  keyboxBodyStrong: {
    fontWeight: '600',
    color: '#0f172a',
  },
  keyboxHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  keyboxWaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginTop: 14,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  keyboxWaBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  keyboxWaFoot: {
    marginTop: 10,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  conciergeriePromoSection: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  conciergeriePromoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ff9800',
  },
  conciergeriePromoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  conciergeriePromoGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#e67e22',
  },
  conciergeriePromoCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.3,
  },
  conciergeriePromoCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 235, 59, 0.2)',
    opacity: 0.3,
  },
  conciergeriePromoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    minHeight: 140,
  },
  conciergeriePromoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  conciergeriePromoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  conciergeriePromoTextContainer: {
    flex: 1,
  },
  conciergeriePromoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  conciergeriePromoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  conciergeriePromoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  conciergeriePromoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 26,
  },
  conciergeriePromoDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 20,
    fontWeight: '500',
  },
  conciergeriePromoHighlight: {
    fontWeight: 'bold',
    color: '#FFD700',
  },
  conciergeriePromoRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  conciergeriePromoArrowContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default HomeScreen;