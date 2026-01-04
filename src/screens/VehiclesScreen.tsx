import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
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
import VehicleBrandAutocomplete from '../components/VehicleBrandAutocomplete';
import { LocationResult } from '../hooks/useLocationSearch';
import { useCurrency } from '../hooks/useCurrency';

const { width } = Dimensions.get('window');

const VehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { vehicles, loading, error, fetchVehicles, refetch } = useVehicles();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<VehicleFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const searchTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -60],
    extrapolate: 'clamp',
  });

  const renderVehicle = ({ item }: { item: Vehicle }) => (
    <VehicleCard
      vehicle={item}
      onPress={handleVehiclePress}
      variant="list"
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="car-outline" size={80} color="#cbd5e1" />
      </View>
      <Text style={styles.emptyTitle}>Aucun véhicule</Text>
      <Text style={styles.emptyText}>
        Modifiez vos critères de recherche
      </Text>
      {getActiveFiltersCount() > 0 && (
        <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
          <Text style={styles.resetBtnText}>Réinitialiser</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && vehicles.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header minimaliste */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Véhicules</Text>
            {vehicles.length > 0 && (
              <Text style={styles.headerCount}>{vehicles.length} disponible{vehicles.length > 1 ? 's' : ''}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={22} color="#2563eb" />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Barre de recherche flottante ultra-minimaliste */}
        <Animated.View
          style={[
            styles.searchWrapper,
            { transform: [{ translateY: searchTranslateY }] },
          ]}
        >
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.7}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search" size={18} color="#64748b" />
            <View style={styles.searchTextWrapper}>
              {searchQuery ? (
                <Text style={styles.searchText} numberOfLines={1}>
                  {searchQuery}
                </Text>
              ) : selectedLocationName ? (
                <Text style={styles.searchText} numberOfLines={1}>
                  {selectedLocationName}
                </Text>
              ) : (
                <Text style={styles.searchPlaceholder}>
                  Rechercher un véhicule...
                </Text>
              )}
            </View>
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterDot}>
                <View style={styles.filterDotInner} />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      {/* Filtres actifs - style ultra-minimal */}
      {getActiveFiltersCount() > 0 && (
        <View style={styles.filtersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {filters.vehicleType && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{filters.vehicleType}</Text>
                <TouchableOpacity onPress={() => removeFilter('vehicleType')}>
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {filters.transmission && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {getTransmissionLabel(filters.transmission)}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('transmission')}>
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {filters.fuelType && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {getFuelLabel(filters.fuelType)}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('fuelType')}>
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {filters.seats && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{filters.seats}+ places</Text>
                <TouchableOpacity onPress={() => removeFilter('seats')}>
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {(filters.priceMin || filters.priceMax) && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {formatPrice(filters.priceMin || 0)} - {formatPrice(filters.priceMax || 999999)}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newFilters = { ...filters };
                    delete newFilters.priceMin;
                    delete newFilters.priceMax;
                    setFilters(newFilters);
                  }}
                >
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {filters.locationId && (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {selectedLocationName || 'Lieu'}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('locationId')}>
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {filters.search && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>"{filters.search}"</Text>
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    removeFilter('search');
                  }}
                >
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            {filters.features && filters.features.length > 0 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {filters.features.length} équipement{filters.features.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity onPress={() => removeFilter('features')}>
                  <Ionicons name="close" size={12} color="#2563eb" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.clearBtn} onPress={handleResetFilters}>
              <Text style={styles.clearText}>Tout effacer</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Modal de recherche */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.searchModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.searchModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSearchModal(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.searchModalContent}>
                <View style={styles.searchModalHeader}>
                  <Text style={styles.searchModalTitle}>Rechercher un véhicule</Text>
                  <TouchableOpacity
                    onPress={() => setShowSearchModal(false)}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={24} color="#0f172a" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.searchModalScroll}
                  contentContainerStyle={styles.searchModalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.searchInputs}>
                    <View style={styles.searchFieldContainer}>
                      <Text style={styles.searchFieldLabel}>Marque ou modèle</Text>
                      <VehicleBrandAutocomplete
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Ex: Toyota, Mercedes, BMW..."
                        style={styles.brandAutocomplete}
                      />
                    </View>

                    <View style={styles.searchFieldContainer}>
                      <Text style={styles.searchFieldLabel}>Localisation</Text>
                      <LocationSearchInput
                        value={selectedLocationName}
                        onChangeText={setSelectedLocationName}
                        onLocationSelect={handleLocationSelect}
                        placeholder="Ville, commune ou quartier"
                        style={styles.modalLocationInput}
                      />
                    </View>
                  </View>

                  <View style={styles.searchModalActions}>
                    <TouchableOpacity
                      style={styles.modalFilterBtn}
                      onPress={() => {
                        setShowSearchModal(false);
                        setShowFilters(true);
                      }}
                    >
                      <Ionicons name="options-outline" size={20} color="#2563eb" />
                      <Text style={styles.modalFilterBtnText}>Filtres avancés</Text>
                      {getActiveFiltersCount() > 0 && (
                        <View style={styles.modalBadge}>
                          <Text style={styles.modalBadgeText}>{getActiveFiltersCount()}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSearchBtn}
                      onPress={() => {
                        handleSearch();
                        setShowSearchModal(false);
                      }}
                    >
                      <Ionicons name="search" size={20} color="#ffffff" />
                      <Text style={styles.modalSearchBtnText}>Rechercher</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {error && (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={18} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Animated.FlatList
        data={vehicles}
        renderItem={renderVehicle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />

      <VehicleFiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleFilterChange}
        initialFilters={filters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    backgroundColor: '#ffffff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -1,
  },
  headerCount: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  searchTextWrapper: {
    flex: 1,
  },
  searchText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  searchPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  filterDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  filtersRow: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  resetBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resetBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 14,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
  },
  searchModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  searchModalScroll: {
    flex: 1,
  },
  searchModalScrollContent: {
    paddingBottom: 40,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchModalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  searchInputs: {
    gap: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  searchFieldContainer: {
    gap: 10,
  },
  searchFieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  inputIcon: {
    marginRight: 0,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  brandAutocomplete: {
    width: '100%',
  },
  modalLocationInput: {
    width: '100%',
  },
  searchModalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  modalFilterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  modalFilterBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  modalBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    position: 'absolute',
    top: -4,
    right: -4,
  },
  modalBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  modalSearchBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalSearchBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default VehiclesScreen;

