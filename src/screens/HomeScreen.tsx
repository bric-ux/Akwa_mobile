import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';

// Données du carrousel en dehors du composant pour éviter re-création à chaque rendu
const CAROUSEL_IMAGES = [
  { id: '1', source: require('../../assets/images/pont.jpg'), title: 'Pont Ado', description: 'Pont emblématique d\'Abidjan, symbole de modernité' },
  { id: '2', source: require('../../assets/images/basilique-yamoussoukro.jpg'), title: 'Basilique Notre-Dame de la Paix', description: 'Plus grande basilique au monde, chef-d\'œuvre de Yamoussoukro' },
  { id: '3', source: require('../../assets/images/elephants.jpg'), title: 'Parc National de la Comoé', description: 'Réserve de biosphère UNESCO, sanctuaire de la faune africaine' },
  { id: '4', source: require('../../assets/images/culture.jpg'), title: 'Masques Baoulé', description: 'Patrimoine culturel immatériel de l\'UNESCO' },
  { id: '5', source: require('../../assets/images/abidjan.jpg'), title: 'Abidjan by Night', description: 'La perle des lagunes illuminée' },
  { id: '6', source: require('../../assets/images/plages-assinie.jpg'), title: 'Côte d\'Assinie', description: 'Plages paradisiaques et villages de pêcheurs traditionnels' },
];

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { properties, loading, error, fetchProperties } = useProperties();
  const { cities, loading: citiesLoading, error: citiesError, getPopularDestinations } = useCities();

  const [popularDestinations, setPopularDestinations] = useState<any[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);
  const propertiesFetchedRef = useRef(false);
  const destinationsFetchedRef = useRef(false);

  useEffect(() => {
    if (propertiesFetchedRef.current) return;
    propertiesFetchedRef.current = true;
    fetchProperties();
  }, [fetchProperties]);

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

  const handleLongTermPress = useCallback(() => {
    (navigation as any).navigate('Search', { destination: '', initialRentalType: 'monthly' });
  }, [navigation]);


  const handlePropertyPress = useCallback((property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    (navigation as any).navigate('Search');
  }, [navigation]);

  const handleDestinationPress = useCallback((destination: any) => {
    (navigation as any).navigate('Search', { destination: destination.name });
  }, [navigation]);

  const renderPropertyCard = useCallback(({ item }: { item: Property }) => (
    <PropertyCard property={item} onPress={handlePropertyPress} variant="list" />
  ), [handlePropertyPress]);

  const listHeader = useMemo(() => (
    <>
      <HeroSection onSearchPress={handleSearchPress} />

      <WeatherDateTimeWidget />

      {/* Section dédiée Location longue durée (séparée des résidences meublées) */}
      <TouchableOpacity style={styles.longTermSection} onPress={handleLongTermPress} activeOpacity={0.9}>
        <View style={styles.longTermGradient} />
        <View style={styles.longTermContent}>
          <View style={styles.longTermBadge}>
            <Ionicons name="business" size={18} color="#fff" />
            <Text style={styles.longTermBadgeText}>LONGUE DURÉE</Text>
          </View>
          <Text style={styles.longTermTitle}>Logements en location mensuelle</Text>
          <Text style={styles.longTermSubtitle}>Louez pour des mois, pas des nuits. Appartements et maisons pour séjours longue durée.</Text>
          <View style={styles.longTermRow}>
            <Text style={styles.longTermCta}>Voir les logements</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Section Promotionnelle Location de véhicules */}
      <View style={styles.vehiclesPromoSection}>
        <ImageBackground
          source={require('../../assets/images/vehicles-suv.jpg')}
          style={styles.vehiclesPromoBackground}
          imageStyle={styles.vehiclesPromoImageStyle}
          resizeMode="cover"
        >
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
        </ImageBackground>
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
  ), [properties.length, popularDestinations, destinationsLoading, handleSearchPress, handleDestinationPress, handleLongTermPress]);
  const scrollContentStyle = useMemo(() => styles.scrollContent, []);

  const keyExtractor = useCallback((item: Property) => item.id, []);
  const emptyMessageShort = t('property.noProperties');
  const listEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>{emptyMessageShort}</Text>
      <Text style={styles.emptySubtitle}>{t('property.noPropertiesDesc')}</Text>
      <Text style={styles.emptySubtitle}>{t('property.noPropertiesSubtext')}</Text>
    </View>
  ), [emptyMessageShort, t]);

  const showError = error;
  const waitingForData = loading && properties.length === 0;

  if (waitingForData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

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
          removeClippedSubviews={false}
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={4}
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
  propertyCount: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
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
  longTermSection: {
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  longTermGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    opacity: 0.95,
  },
  longTermContent: {
    padding: 24,
  },
  longTermBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  longTermBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  longTermTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  longTermSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  longTermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  longTermCta: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
  },
  vehiclesPromoImageStyle: {
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