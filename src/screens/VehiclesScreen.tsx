import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle, VehicleFilters } from '../types';
import VehicleCard from '../components/VehicleCard';
import { useLanguage } from '../contexts/LanguageContext';
import VehicleFiltersModal from '../components/VehicleFiltersModal';
import LocationSearchInput from '../components/LocationSearchInput';
import { LocationResult } from '../hooks/useLocationSearch';

const VehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { vehicles, loading, error, fetchVehicles, refetch } = useVehicles();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<VehicleFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationName, setSelectedLocationName] = useState('');

  // Appliquer les filtres quand ils changent
  useEffect(() => {
    const searchFilters: VehicleFilters = {
      ...filters,
      search: searchQuery.trim() || undefined,
    };
    fetchVehicles(searchFilters);
  }, [filters, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleVehiclePress = (vehicle: Vehicle) => {
    navigation.navigate('VehicleDetails' as never, { vehicleId: vehicle.id } as never);
  };

  const handleFilterChange = (newFilters: VehicleFilters) => {
    setFilters(newFilters);
  };

  const handleLocationSelect = (location: LocationResult) => {
    setSelectedLocationName(location.name);
    setFilters({
      ...filters,
      locationId: location.id,
    });
  };

  const handleSearch = () => {
    const searchFilters: VehicleFilters = {
      ...filters,
      search: searchQuery.trim() || undefined,
    };
    fetchVehicles(searchFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
    setSearchQuery('');
    setSelectedLocationName('');
  };

  const removeFilter = (filterKey: keyof VehicleFilters) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    setFilters(newFilters);
    if (filterKey === 'locationId') {
      setSelectedLocationName('');
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.vehicleType) count++;
    if (filters.brand) count++;
    if (filters.transmission) count++;
    if (filters.fuelType) count++;
    if (filters.seats) count++;
    if (filters.priceMin) count++;
    if (filters.priceMax) count++;
    if (filters.locationId) count++;
    if (filters.features && filters.features.length > 0) count++;
    if (filters.search) count++;
    return count;
  };

  const getTransmissionLabel = (transmission: string | null) => {
    if (!transmission) return null;
    return transmission === 'automatic' ? 'Auto' : 'Manuel';
  };

  const getFuelLabel = (fuel: string | null) => {
    if (!fuel) return null;
    const labels: Record<string, string> = {
      essence: 'Essence',
      diesel: 'Diesel',
      electric: 'Électrique',
      hybrid: 'Hybride',
    };
    return labels[fuel] || fuel;
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <VehicleCard
      vehicle={item}
      onPress={handleVehiclePress}
      variant="list"
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="car-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>
        {t('vehicles.noVehicles') || 'Aucun véhicule disponible'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {t('vehicles.noVehiclesSubtext') || 'Il n\'y a pas de véhicules disponibles pour le moment'}
      </Text>
    </View>
  );

  if (loading && vehicles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('vehicles.title') || 'Location de véhicules'}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('vehicles.title') || 'Location de véhicules'}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddVehicle' as never)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#2E7D32" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de recherche améliorée */}
      <View style={styles.searchSection}>
        <View style={styles.searchBarContainer}>
          {/* Recherche textuelle */}
          <View style={styles.searchInputContainer}>
            <Ionicons name="car-outline" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Marque, modèle, titre..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Localisation */}
          <View style={styles.locationInputContainer}>
            <LocationSearchInput
              value={selectedLocationName}
              onChangeText={setSelectedLocationName}
              onLocationSelect={handleLocationSelect}
              placeholder="Où ?"
              style={styles.locationInput}
            />
          </View>

          {/* Actions */}
          <View style={styles.searchActions}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="filter-outline" size={20} color="#2E7D32" />
              {getActiveFiltersCount() > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
            >
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtres actifs */}
        {getActiveFiltersCount() > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activeFiltersContainer}
            contentContainerStyle={styles.activeFiltersContent}
          >
            {filters.vehicleType && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>Type: {filters.vehicleType}</Text>
                <TouchableOpacity onPress={() => removeFilter('vehicleType')}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.transmission && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  {getTransmissionLabel(filters.transmission)}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('transmission')}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.fuelType && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  {getFuelLabel(filters.fuelType)}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('fuelType')}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.seats && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>{filters.seats}+ places</Text>
                <TouchableOpacity onPress={() => removeFilter('seats')}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {(filters.priceMin || filters.priceMax) && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Prix: {filters.priceMin || '0'} - {filters.priceMax || 'Max'}
                </Text>
                <TouchableOpacity onPress={() => {
                  const newFilters = { ...filters };
                  delete newFilters.priceMin;
                  delete newFilters.priceMax;
                  setFilters(newFilters);
                }}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.locationId && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Lieu: {selectedLocationName || 'Sélectionné'}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('locationId')}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.search && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Recherche: "{filters.search}"
                </Text>
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  removeFilter('search');
                }}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.features && filters.features.length > 0 && (
              <View style={styles.activeFilter}>
                <Text style={styles.activeFilterText}>
                  Équipements: {filters.features.length}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('features')}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.resetFiltersButton}
              onPress={handleResetFilters}
            >
              <Text style={styles.resetFiltersText}>Réinitialiser</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={vehicles}
        renderItem={renderVehicle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E7D32']}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Modal de filtres */}
      <VehicleFiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleFilterChange}
        initialFilters={filters}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e67e22',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  searchSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBarContainer: {
    gap: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationInputContainer: {
    marginTop: 0,
  },
  locationInput: {
    marginTop: 0,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  searchButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFiltersContainer: {
    marginTop: 12,
    maxHeight: 50,
  },
  activeFiltersContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  resetFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff3e0',
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});

export default VehiclesScreen;

