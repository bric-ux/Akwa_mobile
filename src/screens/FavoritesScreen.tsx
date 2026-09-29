import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Property, Vehicle, MonthlyRentalListing } from '../types';
import { useFavorites } from '../hooks/useFavorites';
import { useVehicleFavorites } from '../hooks/useVehicleFavorites';
import { useHotelFavorites } from '../hooks/useHotelFavorites';
import { useMonthlyFavorites } from '../hooks/useMonthlyFavorites';
import type { HotelEstablishmentPublic } from '../hooks/useApprovedHotelEstablishments';
import { useAuth } from '../services/AuthContext';
import PropertyCard from '../components/PropertyCard';
import VehicleCard from '../components/VehicleCard';
import HotelEstablishmentCard from '../components/HotelEstablishmentCard';
import MonthlyRentalListingCard from '../components/MonthlyRentalListingCard';
import BottomNavigationBar from '../components/BottomNavigationBar';
import GuestModePlaceholder from '../components/GuestModePlaceholder';

type FavTab = 'properties' | 'vehicles' | 'hotels' | 'monthly';

const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const { getFavorites, loading: propertiesLoading } = useFavorites();
  const { getFavorites: getVehicleFavorites, loading: vehiclesLoading } = useVehicleFavorites();
  const { getFavorites: getHotelFavorites, loading: hotelsLoading } = useHotelFavorites();
  const { getFavorites: getMonthlyFavorites, loading: monthlyLoading } = useMonthlyFavorites();
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [vehicleFavorites, setVehicleFavorites] = useState<Vehicle[]>([]);
  const [hotelFavorites, setHotelFavorites] = useState<HotelEstablishmentPublic[]>([]);
  const [monthlyFavorites, setMonthlyFavorites] = useState<MonthlyRentalListing[]>([]);
  const [activeTab, setActiveTab] = useState<FavTab>('properties');

  const isVehicleFavoritesTab = route.name === 'VehicleFavoritesTab';
  const loading = propertiesLoading || vehiclesLoading || hotelsLoading || monthlyLoading;

  const loadFavorites = async () => {
    try {
      const [propertiesData, vehiclesData, hotelsData, monthlyData] = await Promise.all([
        getFavorites(),
        getVehicleFavorites(),
        getHotelFavorites(),
        getMonthlyFavorites(),
      ]);
      setFavorites(propertiesData);
      setVehicleFavorites(vehiclesData);
      setHotelFavorites(hotelsData);
      setMonthlyFavorites(monthlyData);
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
      Alert.alert('Erreur', 'Impossible de charger vos favoris');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        void loadFavorites();
      } else {
        setFavorites([]);
        setVehicleFavorites([]);
        setHotelFavorites([]);
        setMonthlyFavorites([]);
      }
    }, [user]),
  );

  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const handleVehiclePress = (vehicle: Vehicle) => {
    navigation.navigate('VehicleDetails', { vehicleId: vehicle.id });
  };

  const handleHotelPress = (est: HotelEstablishmentPublic) => {
    navigation.navigate('HotelEstablishmentDetail', { establishmentId: est.id });
  };

  const handleMonthlyPress = (listing: MonthlyRentalListing) => {
    navigation.navigate('MonthlyRentalListingDetail', { listingId: listing.id });
  };

  const isInTabNavigator = route.name === 'FavoritesTab' || route.name === 'VehicleFavoritesTab';

  if (!user) {
    return (
      <GuestModePlaceholder
        icon="heart-outline"
        subtitleKey="guest.favoritesSubtitle"
        isInTabNavigator={isInTabNavigator}
        bottomNavScreen="favoris"
      />
    );
  }

  if (loading && favorites.length + vehicleFavorites.length + hotelFavorites.length + monthlyFavorites.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
        </View>
        {!isInTabNavigator && <BottomNavigationBar activeScreen="favoris" />}
      </SafeAreaView>
    );
  }

  const totalCount =
    favorites.length + vehicleFavorites.length + hotelFavorites.length + monthlyFavorites.length;

  if (totalCount === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucun favori</Text>
          <Text style={styles.emptySubtitle}>
            Explorez résidences, hôtels, bail longue durée et véhicules, puis ajoutez-les en favoris via
            le cœur.
          </Text>
        </View>
        {!isInTabNavigator && <BottomNavigationBar activeScreen="favoris" />}
      </SafeAreaView>
    );
  }

  const tabs: { key: FavTab; label: string; count: number }[] = [
    { key: 'properties', label: 'Résidences', count: favorites.length },
    { key: 'hotels', label: 'Hôtels', count: hotelFavorites.length },
    { key: 'monthly', label: 'Bail longue durée', count: monthlyFavorites.length },
    { key: 'vehicles', label: 'Véhicules', count: vehicleFavorites.length },
  ];

  const visibleTabs = isVehicleFavoritesTab
    ? tabs.filter((t) => t.key === 'vehicles')
    : tabs.filter((t) => t.count > 0 || t.key === activeTab);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <Text style={styles.headerSubtitle}>
          {totalCount} favori{totalCount > 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {visibleTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'properties' && (
        <FlatList
          data={favorites}
          renderItem={({ item }) => (
            <PropertyCard property={item} onPress={handlePropertyPress} variant="list" />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
      {activeTab === 'hotels' && (
        <FlatList
          data={hotelFavorites}
          renderItem={({ item }) => (
            <HotelEstablishmentCard
              establishment={item}
              onPress={handleHotelPress}
              variant="list"
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
      {activeTab === 'monthly' && (
        <FlatList
          data={monthlyFavorites}
          renderItem={({ item }) => (
            <MonthlyRentalListingCard
              listing={item}
              onPress={handleMonthlyPress}
              variant="list"
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
      {activeTab === 'vehicles' && (
        <FlatList
          data={vehicleFavorites}
          renderItem={({ item }) => (
            <VehicleCard vehicle={item} onPress={handleVehiclePress} variant="list" />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  tabsScroll: {
    maxHeight: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default FavoritesScreen;
