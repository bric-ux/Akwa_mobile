import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
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

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { properties, loading, error, fetchProperties, refreshProperties } = useProperties();
  const { cities, loading: citiesLoading, error: citiesError, getPopularDestinations } = useCities();

  // Affichage vertical uniquement


  // Données pour le carrousel d'images - Monuments et singularités de la Côte d'Ivoire
  const carouselImages = [
    {
      id: '1',
      source: require('../../assets/images/pont.jpg'),
      title: 'Le Pont Félix Houphouët-Boigny',
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
      title: 'Cathédrale Saint-Paul d\'Abidjan',
      description: 'Architecture moderne unique, symbole de la foi',
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


  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'Fonctionnalité à venir');
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

      <PopularDestinations
        destinations={getPopularDestinations(8)}
        onDestinationPress={handleDestinationPress}
        loading={citiesLoading}
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header 
          onNotificationPress={handleNotificationPress}
        />
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
              <Text style={styles.emptyTitle}>Aucune propriété disponible</Text>
              <Text style={styles.emptySubtitle}>
                Les propriétés masquées ou inactives ne sont pas affichées ici.
              </Text>
              <Text style={styles.emptySubtitle}>
                Revenez plus tard pour découvrir de nouvelles propriétés !
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
});

export default HomeScreen;