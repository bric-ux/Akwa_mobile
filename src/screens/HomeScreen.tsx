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
import { useAuth } from '../services/AuthContext';
import { useProperties } from '../hooks/useProperties';
import { useCities } from '../hooks/useCities';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { Property } from '../types';
import PropertyCard from '../components/PropertyCard';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { PopularDestinations } from '../components/PopularDestinations';
import ImageCarousel from '../components/ImageCarousel';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { properties, loading, error, fetchProperties, refreshProperties } = useProperties();
  const { cities, loading: citiesLoading, error: citiesError } = useCities();
  const { requireAuthForProfile } = useAuthRedirect();


  // Données pour le carrousel d'images
  const carouselImages = [
    {
      id: '1',
      source: require('../../assets/images/pont.jpg'),
      title: 'Le Pont ADO',
      description: 'Symbole architectural d\'Abidjan',
    },
    {
      id: '2',
      source: require('../../assets/images/plages-assinie.jpg'),
      title: 'Plages d\'Assinie',
      description: 'Paradis tropical de la Côte d\'Ivoire',
    },
    {
      id: '3',
      source: require('../../assets/images/elephants.jpg'),
      title: 'Parc National de la Comoé',
      description: 'Découvrez la faune sauvage',
    },
    {
      id: '4',
      source: require('../../assets/images/culture.jpg'),
      title: 'Culture Ivoirienne',
      description: 'Traditions et patrimoine vivant',
    },
    {
      id: '5',
      source: require('../../assets/images/abidjan.jpg'),
      title: 'Abidjan la Perle des Lagunes',
      description: 'Métropole moderne et dynamique',
    },
    {
      id: '6',
      source: require('../../assets/images/basilique-yamoussoukro.jpg'),
      title: 'Basilique Notre-Dame de la Paix',
      description: 'Joyau architectural de Yamoussoukro',
    },
  ];

  useEffect(() => {
    // Charger les propriétés au montage du composant
    fetchProperties();
  }, []);

  // Rafraîchir les données quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 HomeScreen devient actif - Rafraîchissement des propriétés');
      refreshProperties();
    }, []) // Supprimer refreshProperties des dépendances pour éviter la boucle
  );


  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const handleSearchPress = () => {
    navigation.navigate('Search');
  };

  const handleProfilePress = () => {
    requireAuthForProfile();
  };

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'Fonctionnalité à venir');
  };

  const handleDestinationPress = (destination: any) => {
    navigation.navigate('Search', { destination: destination.name });
  };


  const renderPropertyCard = ({ item }: { item: Property }) => (
    <PropertyCard property={item} onPress={handlePropertyPress} variant="list" />
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
    <View style={styles.container}>
      <Header 
        onProfilePress={handleProfilePress}
        onNotificationPress={handleNotificationPress}
      />
      
      <FlatList
        style={styles.content}
        data={properties}
        renderItem={renderPropertyCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={() => (
          <>
            <HeroSection onSearchPress={handleSearchPress} />

            <PopularDestinations
              destinations={cities}
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
        )}
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
  );
};

const styles = StyleSheet.create({
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