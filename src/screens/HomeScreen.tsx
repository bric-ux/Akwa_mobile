import React, { useState, useEffect } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { properties, loading, error, fetchProperties, refreshProperties } = useProperties();
  const { cities, loading: citiesLoading, error: citiesError, getPopularDestinations } = useCities();
  
  const [popularDestinations, setPopularDestinations] = useState<any[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(true);

  // Affichage vertical uniquement


  // Données pour le carrousel d'images - Monuments et singularités de la Côte d'Ivoire
  const carouselImages = [
    {
      id: '1',
      source: require('../../assets/images/pont.jpg'),
      title: 'Pont Ado',
      description: 'Pont emblématique d\'Abidjan, symbole de modernité',
    },
    {
      id: '2',
      source: require('../../assets/images/basilique-yamoussoukro.jpg'),
      title: 'Basilique Notre-Dame de la Paix',
      description: 'Plus grande basilique au monde, chef-d\'œuvre de Yamoussoukro',
    },
    {
      id: '3',
      source: require('../../assets/images/elephants.jpg'),
      title: 'Parc National de la Comoé',
      description: 'Réserve de biosphère UNESCO, sanctuaire de la faune africaine',
    },
    {
      id: '4',
      source: require('../../assets/images/culture.jpg'),
      title: 'Masques Baoulé',
      description: 'Patrimoine culturel immatériel de l\'UNESCO',
    },
    {
      id: '5',
      source: require('../../assets/images/abidjan.jpg'),
      title: 'Abidjan by Night',
      description: 'La perle des lagunes illuminée',
    },
    {
      id: '6',
      source: require('../../assets/images/plages-assinie.jpg'),
      title: 'Côte d\'Assinie',
      description: 'Plages paradisiaques et villages de pêcheurs traditionnels',
    },
  ];

  useEffect(() => {
    // Charger les propriétés au montage du composant
    fetchProperties();
    
    // Charger les destinations populaires
    const loadPopularDestinations = async () => {
      try {
        setDestinationsLoading(true);
        const destinations = await getPopularDestinations(8);
        setPopularDestinations(destinations);
      } catch (error) {
        console.error('Erreur lors du chargement des destinations populaires:', error);
      } finally {
        setDestinationsLoading(false);
      }
    };
    
    loadPopularDestinations();
  }, []);


  // Rafraîchir les données quand l'écran devient actif (une seule fois)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 HomeScreen devient actif - Rafraîchissement des propriétés');
      // Utiliser fetchProperties avec un délai pour éviter la boucle
      const timeoutId = setTimeout(() => {
        fetchProperties();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }, []) // Tableau vide pour éviter les re-renders
  );


  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const handleSearchPress = () => {
    (navigation as any).navigate('Search');
  };

  const handleDestinationPress = (destination: any) => {
    (navigation as any).navigate('Search', { destination: destination.name });
  };

  const renderPropertyCard = ({ item }: { item: Property }) => (
    <PropertyCard property={item} onPress={handlePropertyPress} variant="list" />
  );

  const renderListHeader = () => (
    <>
      <HeroSection onSearchPress={handleSearchPress} />

      <WeatherDateTimeWidget />

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
              onPress={() => navigation.navigate('Vehicles' as never)}
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

      <PopularDestinations
        destinations={popularDestinations}
        onDestinationPress={handleDestinationPress}
        loading={destinationsLoading}
      />

      <ImageCarousel
        images={carouselImages}
        onImagePress={(image) => {
          // Optionnel : navigation vers une page de détails de l'image
          console.log('Image sélectionnée:', image.title);
        }}
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
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Erreur: {error}</Text>
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
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('property.noProperties')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('property.noPropertiesDesc')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {t('property.noPropertiesSubtext')}
              </Text>
            </View>
          )}
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
});

export default HomeScreen;