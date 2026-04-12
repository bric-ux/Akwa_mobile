import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../services/AuthContext';
import { useProperties } from '../hooks/useProperties';
import { useCities } from '../hooks/useCities';
import { Property } from '../types';
import PropertyCard from '../components/PropertyCard';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { InfoBanner } from '../components/InfoBanner';
import { PopularDestinations } from '../components/PopularDestinations';
import ImageCarousel from '../components/ImageCarousel';
import WeatherDateTimeWidget from '../components/WeatherDateTimeWidget';
import { useLanguage } from '../contexts/LanguageContext';
import { getPublicPropertyListVersion } from '../utils/publicPropertyListVersion';

// Données du carrousel en dehors du composant pour éviter re-création à chaque rendu
const CAROUSEL_IMAGES = [
  { id: '1', source: require('../../assets/images/pont.jpg'), title: 'Pont Ado', description: 'Pont emblématique d\'Abidjan, symbole de modernité' },
  { id: '2', source: require('../../assets/images/basilique-yamoussoukro.jpg'), title: 'Basilique Notre-Dame de la Paix', description: 'Plus grande basilique au monde, chef-d\'œuvre de Yamoussoukro' },
  { id: '3', source: require('../../assets/images/elephants.jpg'), title: 'Parc National de la Comoé', description: 'Réserve de biosphère UNESCO, sanctuaire de la faune africaine' },
  { id: '4', source: require('../../assets/images/culture.jpg'), title: 'Masques Baoulé', description: 'Patrimoine culturel immatériel de l\'UNESCO' },
  { id: '5', source: require('../../assets/images/abidjan.jpg'), title: 'Abidjan by Night', description: 'La perle des lagunes illuminée' },
  { id: '6', source: require('../../assets/images/plages-assinie.jpg'), title: 'Côte d\'Assinie', description: 'Plages paradisiaques et villages de pêcheurs traditionnels' },
];

const HOST_FAB_EXTRA_SCROLL_PADDING = 72;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { properties, loading, error, refreshProperties } = useProperties();
  const { cities, loading: citiesLoading, error: citiesError, getPopularDestinations } = useCities();

  const [popularDestinations, setPopularDestinations] = useState<any[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const destinationsFetchedRef = useRef(false);
  const lastHandledCatalogVersionRef = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hostFabCompact, setHostFabCompact] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setHostFabCompact(false);
      const timer = setTimeout(() => setHostFabCompact(true), 10000);
      return () => clearTimeout(timer);
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      const v = getPublicPropertyListVersion();
      if (lastHandledCatalogVersionRef.current === null) {
        lastHandledCatalogVersionRef.current = v;
        return;
      }
      if (v > lastHandledCatalogVersionRef.current) {
        lastHandledCatalogVersionRef.current = v;
        refreshProperties(undefined);
      }
    }, [refreshProperties])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProperties(undefined);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProperties]);

  useEffect(() => {
    if (destinationsFetchedRef.current) return;
    destinationsFetchedRef.current = true;

    const loadPopularDestinations = async () => {
      try {
        setDestinationsLoading(true);
        const destinations = await getPopularDestinations(8);
        setPopularDestinations(destinations);
      } catch (err) {
        if (__DEV__) console.error('[HomeScreen] Erreur destinations:', err);
      } finally {
        setDestinationsLoading(false);
      }
    };
    loadPopularDestinations();
  }, [getPopularDestinations]);

  const handlePropertyPress = useCallback((property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    (navigation as any).navigate('Search');
  }, [navigation]);

  const handleDestinationPress = useCallback((destination: any) => {
    (navigation as any).navigate('Search', { destination: destination.name });
  }, [navigation]);

  const handleBecomeHostFabPress = useCallback(() => {
    if (user) {
      navigation.navigate('BecomeHost' as never);
    } else {
      navigation.navigate('Auth', { returnTo: 'BecomeHost' });
    }
  }, [navigation, user]);

  const renderPropertyCard = useCallback(({ item }: { item: Property }) => (
    <PropertyCard property={item} onPress={handlePropertyPress} variant="list" />
  ), [handlePropertyPress]);

  const listHeader = useMemo(() => (
    <>
      <HeroSection onSearchPress={handleSearchPress} />

      <WeatherDateTimeWidget />

      {/* Section Promotionnelle Location de véhicules */}
      <View style={styles.vehiclesPromoSection}>
        <View style={styles.vehiclesPromoBackground}>
          <Image
            source={require('../../assets/images/vehicles-suv.jpg')}
            style={styles.vehiclesPromoBgImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={200}
          />
          <View style={styles.vehiclesPromoOverlay}>
            <View style={styles.vehiclesPromoContent}>
              <View style={styles.vehiclesPromoLeft}>
            <View style={styles.vehiclesPromoBadge}>
              <Ionicons name="flash" size={16} color="#FFD700" />
              <Text style={styles.vehiclesPromoBadgeText}>NOUVEAU</Text>
            </View>
            <Text style={styles.vehiclesPromoTitle}>
              Location de véhicules
            </Text>
            <Text style={styles.vehiclesPromoSubtitle}>
              Explorez la Côte d'Ivoire à votre rythme
            </Text>
            <Text style={styles.vehiclesPromoDescription}>
              Trouvez le véhicule parfait pour votre voyage. Des voitures, SUV, motos et plus encore disponibles à la location.
            </Text>
            <TouchableOpacity
              style={styles.vehiclesPromoButton}
              onPress={() => (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' })}
            >
              <Text style={styles.vehiclesPromoButtonText}>Découvrir les véhicules</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
              </View>
              <View style={styles.vehiclesPromoRight}>
            <View style={styles.vehiclesPromoIconContainer}>
              <Ionicons name="car-sport" size={64} color="#2E7D32" />
            </View>
            <View style={styles.vehiclesPromoFeatures}>
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

      {/* Section Promotionnelle Conciergerie */}
      <View style={styles.conciergeriePromoSection}>
        <TouchableOpacity
          style={styles.conciergeriePromoCard}
          onPress={() => navigation.navigate('Conciergerie' as never)}
          activeOpacity={0.9}
        >
          {/* Effets d'arrière-plan */}
          <View style={styles.conciergeriePromoBackground}>
            <View style={styles.conciergeriePromoGradient} />
            <View style={styles.conciergeriePromoCircle1} />
            <View style={styles.conciergeriePromoCircle2} />
          </View>
          
          {/* Contenu */}
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
                <Text style={styles.conciergeriePromoTitle}>
                  Service de Conciergerie AkwaHome
                </Text>
                <Text style={styles.conciergeriePromoDescription}>
                  Maximisez vos revenus de <Text style={styles.conciergeriePromoHighlight}>+65%</Text> sans effort • Support <Text style={styles.conciergeriePromoHighlight}>24h/7j</Text> • Satisfaction <Text style={styles.conciergeriePromoHighlight}>98%</Text>
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

      <PopularDestinations
        destinations={popularDestinations}
        onDestinationPress={handleDestinationPress}
        loading={destinationsLoading}
      />

      <ImageCarousel
        images={CAROUSEL_IMAGES}
        onImagePress={() => {}}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nos propriétés disponibles</Text>
          <Text style={styles.propertyCount}>
            {properties.length} propriété{properties.length > 1 ? 's' : ''} trouvée{properties.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </>
  ), [properties.length, popularDestinations, destinationsLoading, handleSearchPress, handleDestinationPress, navigation]);
  const scrollContentStyle = useMemo(
    () => [styles.scrollContent, { paddingBottom: 20 + HOST_FAB_EXTRA_SCROLL_PADDING }],
    []
  );

  const keyExtractor = useCallback((item: Property) => item.id, []);
  const emptyMessageShort = t('property.noProperties');
  const listLoadingEmpty = loading && properties.length === 0;
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

  const showError = error;

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
          data={properties}
          renderItem={renderPropertyCard}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scrollContentStyle}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e67e22"
            />
          }
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={6}
          windowSize={9}
          initialNumToRender={5}
          updateCellsBatchingPeriod={50}
        />

        <View
          style={[
            styles.hostFabContainer,
            { bottom: Math.max(insets.bottom, 6) + 10 },
          ]}
        >
          <TouchableOpacity
            style={hostFabCompact ? styles.hostFabCompact : styles.hostFab}
            onPress={handleBecomeHostFabPress}
            activeOpacity={0.88}
          >
            {hostFabCompact ? (
              <Ionicons name="add" size={28} color="#fff" />
            ) : (
              <>
                <View style={styles.hostFabIconCircle}>
                  <Ionicons name="add" size={22} color="#fff" />
                </View>
                <View style={styles.hostFabTextCol}>
                  <Text style={styles.hostFabTitle}>Ajouter une résidence</Text>
                  <Text style={styles.hostFabHint}>Devenir hôte</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </>
            )}
          </TouchableOpacity>
        </View>
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
  propertyCount: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  hostFabContainer: {
    position: 'absolute',
    right: 12,
    left: 12,
    zIndex: 20,
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
  hostFab: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 10,
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 10,
  },
  hostFabIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostFabTextCol: {
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  hostFabTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  hostFabHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  hostFabCompact: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
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
  vehiclesPromoContent: {
    flexDirection: 'row',
  },
  vehiclesPromoLeft: {
    flex: 1,
    paddingRight: 12,
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
  vehiclesPromoIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  vehiclesPromoFeatures: {
    gap: 8,
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