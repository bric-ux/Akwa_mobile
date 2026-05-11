import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  Dimensions,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
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
import TeddyExploreFab from '../components/TeddyExploreFab';
import { useLanguage } from '../contexts/LanguageContext';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../constants/homeExploreLayout';

const SCREEN_W = Dimensions.get('window').width;
/** Titres explore + première carte : alignés sur le carrousel « trésors CI » ; carte suivante visible */
const EXPLORE_GUTTER = HOME_EXPLORE_HORIZONTAL_GUTTER;
const NEXT_CARD_PEEK = 46;

const KEYBOX_WHATSAPP_URL =
  'https://wa.me/33667672022?text=' +
  encodeURIComponent(
    "Bonjour, je suis propriétaire d'une résidence meublée et je souhaite des informations sur l'installation de boîtes à clés AkwaHome.",
  );

const EXPLORE_CARD_WIDTH = Math.max(
  244,
  Math.round(SCREEN_W - EXPLORE_GUTTER - NEXT_CARD_PEEK),
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
  const {
    layoutSections: exploreSections,
    loading: exploreLoading,
    error: exploreError,
    refreshExploreCityHome,
  } = useExploreCityHome();

  const [refreshing, setRefreshing] = useState(false);
  const lastScrollY = useRef(0);
  const [teddyFabVisibleFromScroll, setTeddyFabVisibleFromScroll] = useState(true);

  const onExploreScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const prev = lastScrollY.current;
    if (y < 120) {
      setTeddyFabVisibleFromScroll(true);
    } else if (y > prev + 8) {
      setTeddyFabVisibleFromScroll(false);
    } else if (y < prev - 8) {
      setTeddyFabVisibleFromScroll(true);
    }
    lastScrollY.current = y;
  }, []);

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exploreRowContent}
            >
              {g.properties.map((p) => (
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.exploreRowContent}
          >
            {flat.map((p) => (
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
        </View>
      );
    },
    [handlePropertyPress, navigateSearchCity, navigation],
  );

  const listHeader = useMemo(() => (
    <>
      <HeroSection onSearchPress={handleSearchPress} />

      <WeatherDateTimeWidget />

      <ImageCarousel
        images={CAROUSEL_IMAGES}
        onImagePress={() => {}}
      />

      <View style={styles.section}>
        <View style={styles.exploreIntroHeader}>
          <Text style={styles.sectionTitle}>Explorez par ville</Text>
        </View>
      </View>
    </>
  ), [handleSearchPress]);

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
              contentFit={vehiclesPromoNarrow ? 'contain' : 'cover'}
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
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={[styles.emptySubtitle, { marginTop: 16 }]}>
            Chargement des annonces…
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{emptyMessageShort}</Text>
        <Text style={styles.emptySubtitle}>{t('property.noPropertiesDesc')}</Text>
        <Text style={styles.emptySubtitle}>{t('property.noPropertiesSubtext')}</Text>
      </View>
    );
  }, [emptyMessageShort, t, listLoadingEmpty]);

  const showError = exploreError;

  if (showError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Erreur: {showError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Header />
        <InfoBanner />
        
        <FlatList
          style={styles.content}
          data={exploreSections}
          renderItem={renderExploreSection}
          keyExtractor={exploreKeyExtractor}
          showsVerticalScrollIndicator={false}
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
          scrollEventThrottle={16}
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
    paddingRight: NEXT_CARD_PEEK,
    paddingBottom: 4,
  },
  exploreCardWrap: {
    marginRight: 10,
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
  /** Plus de hauteur + image en « contain » : moins de recadrage agressif sur petits écrans. */
  vehiclesPromoBackgroundNarrow: {
    minHeight: 260,
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