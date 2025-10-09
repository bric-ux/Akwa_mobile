import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useProperties } from '../hooks/useProperties';
import { Property, SearchFilters } from '../types';
import PropertyCard from '../components/PropertyCard';
import { SearchBar, FiltersModal } from '../components/SearchBar';
import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { RecommendedProperties } from '../components/RecommendedProperties';
import { PopularDestinations } from '../components/PopularDestinations';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { properties, loading, error, fetchProperties } = useProperties();
  const [showFilters, setShowFilters] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({});

  // Données mockées pour les destinations populaires
  const popularDestinations = [
    {
      id: '1',
      name: 'Abidjan',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      propertiesCount: 45,
    },
    {
      id: '2',
      name: 'Yamoussoukro',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      propertiesCount: 23,
    },
    {
      id: '3',
      name: 'Grand-Bassam',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      propertiesCount: 18,
    },
    {
      id: '4',
      name: 'San-Pédro',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      propertiesCount: 12,
    },
  ];

  useEffect(() => {
    // Charger les propriétés au montage du composant
    fetchProperties();
  }, []);

  const handleSearch = (filters: SearchFilters) => {
    setSearchFilters(filters);
    fetchProperties(filters);
  };

  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const handleSearchPress = () => {
    navigation.navigate('Search');
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const handleNotificationPress = () => {
    Alert.alert('Notifications', 'Fonctionnalité à venir');
  };

  const handleDestinationPress = (destination: any) => {
    navigation.navigate('Search', { destination: destination.name });
  };

  const handleViewAllProperties = () => {
    navigation.navigate('Search');
  };

  const renderPropertyCard = ({ item }: { item: Property }) => (
    <PropertyCard property={item} onPress={handlePropertyPress} />
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
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <HeroSection onSearchPress={handleSearchPress} />

        <SearchBar
          onSearch={handleSearch}
          onFiltersPress={() => setShowFilters(true)}
        />

        <PopularDestinations
          destinations={popularDestinations}
          onDestinationPress={handleDestinationPress}
        />

        <RecommendedProperties
          properties={properties.slice(0, 5)}
          onPropertyPress={handlePropertyPress}
          onViewAllPress={handleViewAllProperties}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toutes les propriétés</Text>
          <FlatList
            data={properties}
            renderItem={renderPropertyCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.propertiesGrid}
          />
        </View>
      </ScrollView>

      <FiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleSearch}
        initialFilters={searchFilters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  section: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginHorizontal: 20,
    marginBottom: 15,
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