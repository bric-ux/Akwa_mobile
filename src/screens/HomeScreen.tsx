import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  InteractionManager,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExploreCityHome, ExploreCitySection } from '../hooks/useExploreCityHome';
import { Property } from '../types';
import PropertyCard from '../components/PropertyCard';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { InfoBanner } from '../components/InfoBanner';
import ImageCarousel from '../components/ImageCarousel';
import WeatherDateTimeWidget from '../components/WeatherDateTimeWidget';
import ZipDailyCard from '../components/zip/ZipDailyCard';
import MatchPredictionBanner from '../components/MatchPredictionBanner';
import TeddyExploreFab from '../components/TeddyExploreFab';
import { useLanguage } from '../contexts/LanguageContext';
import { useNetwork } from '../contexts/NetworkContext';
import LoadErrorCard from '../components/LoadErrorCard';
import type { LoadFailureKind } from '../utils/loadError';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../constants/homeExploreLayout';
import { EXPLORE_SHELF_CARD_WIDTH } from '../constants/exploreShelfCard';
import { VEHICLE_COLORS } from '../constants/colors';

/** Titres explore + première carte : alignés sur le carrousel « trésors CI » */
const EXPLORE_GUTTER = HOME_EXPLORE_HORIZONTAL_GUTTER;

const KEYBOX_WHATSAPP_URL =
  'https://wa.me/33667672022?text=' +
  encodeURIComponent(
    "Bonjour, je suis propriétaire d'une résidence meublée et je souhaite des informations sur l'installation de boîtes à clés AkwaHome.",
  );

/** Largeur portrait des cartes carrousel (format ExploreShelf). */
const EXPLORE_CARD_WIDTH = EXPLORE_SHELF_CARD_WIDTH;

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
  const { t } = useLanguage();
  const { isOffline } = useNetwork();
  const bottomServiceCardSize =
    (windowWidth - HOME_EXPLORE_HORIZONTAL_GUTTER * 2 - 12) / 2;
  const {
    layoutSections: exploreSections,
    loading: exploreLoading,
    error: exploreError,
    refreshExploreCityHome,
  } = useExploreCityHome();

  const [refreshing, setRefreshing] = useState(false);
  const lastScrollY = useRef(0);
  const [teddyFabVisibleFromScroll, setTeddyFabVisibleFromScroll] = useState(true);
  const teddyFabVisibleRef = useRef(true);
  const [carouselBannerVisible, setCarouselBannerVisible] = useState(true);
  const carouselBannerVisibleRef = useRef(true);
  const [showDeferredHeaderContent, setShowDeferredHeaderContent] = useState(false);

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
      await refreshExploreCityHome();
    } finally {
      setRefreshing(false);
    }
  }, [refreshExploreCityHome]);

  const handlePropertyPress = useCallback((property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    (navigation as any).navigate('Search');
  }, [navigation]);

  const navigateSearchCity = useCallback(
    (cityName: string) => {
      (navigation as any).navigate('Search', { destination: cityName });
    },
    [navigation],
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

      <View style={styles.section}>
        <View style={styles.exploreIntroHeader}>
          <Text style={styles.sectionTitle}>Explorez par ville</Text>
        </View>
        {exploreErrorCard}
      </View>
    </>
  ), [handleSearchPress, showDeferredHeaderContent, exploreErrorCard]);

  const listFooter = useMemo(
    () => (
      <>
        {/* Location de véhicules — aligné site HomeVehiclesPromoBanner (mobile) */}
        <View style={styles.vehiclesPromoSection}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' })}
            style={styles.vehiclesPromoCard}
            accessibilityRole="button"
            accessibilityLabel="Location de véhicules"
          >
            <ImageBackground
              source={require('../../assets/images/vehicles-suv.jpg')}
              style={styles.vehiclesPromoBgImage}
              resizeMode="cover"
            >
              <View style={styles.vehiclesPromoScrim} />
              <View style={styles.vehiclesPromoContent}>
                <Text style={styles.vehiclesPromoEyebrow}>Location de véhicules</Text>
                <Text style={styles.vehiclesPromoTitle}>
                  Abidjan & partout en Côte d'Ivoire
                </Text>
                <Text style={styles.vehiclesPromoDescription}>
                  À la journée ou à l'heure, avec ou sans chauffeur.
                </Text>
                <View style={styles.vehiclesPromoButton}>
                  <Text style={styles.vehiclesPromoButtonText}>Voir les véhicules</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Services propriétaires — deux encarts carrés */}
        <View style={styles.ownerServicesSection}>
          <Text style={styles.ownerServicesTitle}>Services propriétaires</Text>
          <Text style={styles.ownerServicesSubtitle}>Conciergerie et équipements pour hôtes</Text>

          <View style={styles.ownerServicesGrid}>
            <TouchableOpacity
              style={[styles.ownerServiceSquare, { width: bottomServiceCardSize, height: bottomServiceCardSize }]}
              onPress={() => navigation.navigate('Conciergerie' as never)}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Conciergerie — Gestion locative"
            >
              <ImageBackground
                source={require('../../assets/images/property-1.jpg')}
                style={styles.ownerServiceSquareBg}
                resizeMode="cover"
              >
                <View style={styles.ownerServiceSquareScrim} />
                <View style={styles.ownerServiceSquareContent}>
                  <View style={styles.ownerServiceSquareIcon}>
                    <Ionicons name="business-outline" size={22} color="#fff" />
                  </View>
                  <Text style={styles.ownerServiceSquareLabel}>Conciergerie</Text>
                  <Text style={styles.ownerServiceSquareTitle}>Gestion locative</Text>
                  <Text style={styles.ownerServiceSquareDesc}>
                    Accueil, ménage et suivi pour propriétaires.
                  </Text>
                  <View style={styles.ownerServiceSquareCta}>
                    <Text style={styles.ownerServiceSquareCtaText}>Découvrir</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ownerServiceSquare, { width: bottomServiceCardSize, height: bottomServiceCardSize }]}
              onPress={openKeyboxWhatsApp}
              activeOpacity={0.9}
              accessibilityRole="link"
              accessibilityLabel="Boîtes à clés — Contact WhatsApp"
            >
              <ImageBackground
                source={require('../../assets/images/keybox-wall.jpg')}
                style={styles.ownerServiceSquareBg}
                resizeMode="cover"
              >
                <View style={styles.ownerServiceSquareScrim} />
                <View style={styles.ownerServiceSquareContent}>
                  <View style={styles.ownerServiceSquareIcon}>
                    <Ionicons name="key-outline" size={22} color="#fff" />
                  </View>
                  <Text style={styles.ownerServiceSquareLabel}>Propriétaires</Text>
                  <Text style={styles.ownerServiceSquareTitle}>Boîtes à clés</Text>
                  <Text style={styles.ownerServiceSquareDesc}>
                    Check-in autonome, installation discrète.
                  </Text>
                  <View style={styles.ownerServiceSquareWaBtn}>
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text style={styles.ownerServiceSquareWaBtnText}>WhatsApp</Text>
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </View>
        </View>
      </>
    ),
    [navigation, openKeyboxWhatsApp, bottomServiceCardSize],
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
          removeClippedSubviews={false}
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
  rentalTypePills: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  pillActive: {
    backgroundColor: '#e67e22',
  },
  pillActiveMonthly: {
    backgroundColor: '#0d9488',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillTextActiveMonthly: {
    color: '#fff',
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
    marginBottom: 14,
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
  exploreRowContent: {
    paddingLeft: EXPLORE_GUTTER,
    paddingRight: EXPLORE_GUTTER,
    paddingBottom: 4,
  },
  exploreCardWrap: {
    marginRight: 12,
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
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 8,
    marginBottom: 16,
  },
  vehiclesPromoCard: {
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  vehiclesPromoBgImage: {
    width: '100%',
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  vehiclesPromoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  vehiclesPromoContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 18,
    gap: 6,
  },
  vehiclesPromoEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  vehiclesPromoTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  vehiclesPromoDescription: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
  },
  vehiclesPromoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: VEHICLE_COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    marginTop: 4,
  },
  vehiclesPromoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ownerServicesSection: {
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 4,
    marginBottom: 8,
  },
  ownerServicesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  ownerServicesSubtitle: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 14,
    color: '#64748b',
  },
  ownerServicesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  ownerServiceSquare: {
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  ownerServiceSquareBg: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  ownerServiceSquareScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  ownerServiceSquareContent: {
    padding: 12,
    zIndex: 1,
  },
  ownerServiceSquareIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 8,
  },
  ownerServiceSquareLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  ownerServiceSquareTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  ownerServiceSquareDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 10,
  },
  ownerServiceSquareCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ownerServiceSquareCtaText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  ownerServiceSquareWaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ownerServiceSquareWaBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default HomeScreen;