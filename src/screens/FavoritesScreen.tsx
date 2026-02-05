import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Property, Vehicle } from '../types';
import { useFavorites } from '../hooks/useFavorites';
import { useVehicleFavorites } from '../hooks/useVehicleFavorites';
import { useAuth } from '../services/AuthContext';
import PropertyCard from '../components/PropertyCard';
import VehicleCard from '../components/VehicleCard';
import BottomNavigationBar from '../components/BottomNavigationBar';

const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { getFavorites, removeFavorite, loading: propertiesLoading } = useFavorites();
  const { getFavorites: getVehicleFavorites, removeFavorite: removeVehicleFavorite, loading: vehiclesLoading } = useVehicleFavorites();
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [vehicleFavorites, setVehicleFavorites] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState<'properties' | 'vehicles'>('vehicles');
  
  // Détecter si on est dans le TabNavigator véhicules
  const isVehicleFavoritesTab = route.name === 'VehicleFavoritesTab';
  const loading = propertiesLoading || vehiclesLoading;

  const loadFavorites = async () => {
    try {
      // Charger les deux types de favoris
      const [propertiesData, vehiclesData] = await Promise.all([
        getFavorites(),
        getVehicleFavorites()
      ]);
      setFavorites(propertiesData);
      setVehicleFavorites(vehiclesData);
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
      Alert.alert('Erreur', 'Impossible de charger vos favoris');
    }
  };

  // Recharger les favoris quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadFavorites();
      } else {
        setFavorites([]);
        setVehicleFavorites([]);
      }
    }, [user])
  );

  const removeFromFavorites = async (propertyId: string) => {
    Alert.alert(
      'Supprimer des favoris',
      'Êtes-vous sûr de vouloir supprimer cette propriété de vos favoris ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFavorite(propertyId);
              setFavorites(prev => prev.filter(fav => fav.id !== propertyId));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de supprimer des favoris');
            }
          },
        },
      ]
    );
  };

  const removeVehicleFromFavorites = async (vehicleId: string) => {
    Alert.alert(
      'Supprimer des favoris',
      'Êtes-vous sûr de vouloir supprimer ce véhicule de vos favoris ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeVehicleFavorite(vehicleId);
              setVehicleFavorites(prev => prev.filter(fav => fav.id !== vehicleId));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de supprimer des favoris');
            }
          },
        },
      ]
    );
  };

  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const handleVehiclePress = (vehicle: Vehicle) => {
    navigation.navigate('VehicleDetails', { vehicleId: vehicle.id });
  };

  const renderFavoriteItem = ({ item }: { item: Property }) => (
    <PropertyCard
      property={item}
      onPress={handlePropertyPress}
      variant="list"
    />
  );

  const renderVehicleFavoriteItem = ({ item }: { item: Vehicle }) => (
    <VehicleCard
      vehicle={item}
      onPress={handleVehiclePress}
      variant="list"
    />
  );

  // Détecter si on est dans le TabNavigator (FavoritesTab) ou dans le Stack (Favorites)
  const isInTabNavigator = route.name === 'FavoritesTab' || route.name === 'VehicleFavoritesTab';

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptySubtitle}>
            Vous devez être connecté pour voir vos favoris
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.exploreButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
        {!isInTabNavigator && <BottomNavigationBar activeScreen="favoris" />}
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
        </View>
        {!isInTabNavigator && <BottomNavigationBar activeScreen="favoris" />}
      </SafeAreaView>
    );
  }

  // Filtrer les items selon l'onglet actif
  const getDisplayItems = () => {
    if (activeTab === 'properties') return favorites;
    return vehicleFavorites;
  };

  const displayItems = getDisplayItems();
  const totalCount = favorites.length + vehicleFavorites.length;

  if (totalCount === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucun favori</Text>
          <Text style={styles.emptySubtitle}>
            Explorez nos hébergements et véhicules, puis ajoutez vos favoris en cliquant sur le cœur
          </Text>
        </View>
        {!isInTabNavigator && <BottomNavigationBar activeScreen="favoris" />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <Text style={styles.headerSubtitle}>
          {totalCount} favori{totalCount > 1 ? 's' : ''} ({favorites.length} résidence{favorites.length > 1 ? 's' : ''}, {vehicleFavorites.length} véhicule{vehicleFavorites.length > 1 ? 's' : ''})
        </Text>
      </View>

      {/* Onglets */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicles' && styles.tabActive]}
          onPress={() => setActiveTab('vehicles')}
        >
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
            Véhicules ({vehicleFavorites.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
          onPress={() => setActiveTab('properties')}
        >
          <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>
            Résidences ({favorites.length})
          </Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={displayItems}
        renderItem={activeTab === 'vehicles' ? renderVehicleFavoriteItem : renderFavoriteItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContainer, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Menu de navigation en bas - seulement si on est dans le Stack, pas dans le TabNavigator */}
      {!isInTabNavigator && <BottomNavigationBar activeScreen="favoris" />}
    </SafeAreaView>
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
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  listContainer: {
    padding: 20,
  },
  favoriteItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  favoriteImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  favoriteContent: {
    padding: 16,
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  favoriteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  removeButton: {
    padding: 5,
  },
  favoriteLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  favoriteDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  favoriteRating: {
    fontSize: 14,
    color: '#333',
  },
  favoriteGuests: {
    fontSize: 14,
    color: '#333',
  },
  favoriteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoritePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenity: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    marginBottom: 4,
  },
  exploreButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default FavoritesScreen;
