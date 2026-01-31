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
import DateGuestsSelector from '../components/DateGuestsSelector';
import { VehicleDateTimeSelector } from '../components/VehicleDateTimeSelector';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { useAuth } from '../services/AuthContext';
import { safeGoBack } from '../utils/navigation';
import { VEHICLE_COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

const VehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { vehicles, loading, error, fetchVehicles, refetch } = useVehicles();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { dates: searchDates, setDates: saveSearchDates } = useSearchDatesContext();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<VehicleFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [startDate, setStartDate] = useState<string>(searchDates.checkIn || '');
  const [endDate, setEndDate] = useState<string>(searchDates.checkOut || '');
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [endDateTime, setEndDateTime] = useState<string>('');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Synchroniser avec le contexte quand il change
  useEffect(() => {
    // Ne synchroniser que si les dates sont explicitement définies (non vides)
    if (searchDates.checkIn !== undefined && searchDates.checkIn !== '' && searchDates.checkIn !== startDate) {
      setStartDate(searchDates.checkIn);
    } else if (searchDates.checkIn === undefined || searchDates.checkIn === '') {
      // Si la date n'est pas définie dans le contexte, la réinitialiser
      if (startDate !== '') {
        setStartDate('');
      }
    }
    if (searchDates.checkOut !== undefined && searchDates.checkOut !== '' && searchDates.checkOut !== endDate) {
      setEndDate(searchDates.checkOut);
    } else if (searchDates.checkOut === undefined || searchDates.checkOut === '') {
      // Si la date n'est pas définie dans le contexte, la réinitialiser
      if (endDate !== '') {
        setEndDate('');
      }
    }
  }, [searchDates.checkIn, searchDates.checkOut, startDate, endDate]);

  // Chargement initial au montage (sans filtres de dates)
  const hasLoadedOnceRef = useRef(false);
  
  useEffect(() => {
    // Charger une première fois au montage sans filtres de dates
    if (!hasLoadedOnceRef.current) {
      console.log(`🔄 [VehiclesScreen] Chargement initial (sans filtres de dates)`);
      fetchVehicles({});
      hasLoadedOnceRef.current = true;
    }
  }, [fetchVehicles]);
  
  // SUPPRIMÉ: useEffect automatique qui causait des appels multiples
  // Les recherches se font maintenant uniquement via handleSearch(), handleDateTimeChange() ou handleDateGuestsChange()
  // Cela évite les appels redondants quand les dates changent

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
      locationName: location.name, // Utiliser le nom pour la recherche hiérarchique
      locationId: undefined, // Ne plus utiliser locationId pour la recherche hiérarchique
    });
  };

  const handleSearch = () => {
    console.log(`🔍 [VehiclesScreen] handleSearch - État actuel:`, {
      startDate,
      endDate,
      startDateTime,
      endDateTime,
      searchQuery,
      selectedLocationName,
      filtersKeys: Object.keys(filters)
    });
    
    // Essayer d'obtenir les dates depuis startDate/endDate ou depuis startDateTime/endDateTime
    let finalStartDate = startDate;
    let finalEndDate = endDate;
    
    // Si les dates simples sont vides mais qu'on a des datetime, extraire les dates
    if ((!finalStartDate || finalStartDate === '') && startDateTime) {
      finalStartDate = startDateTime.split('T')[0];
    }
    if ((!finalEndDate || finalEndDate === '') && endDateTime) {
      finalEndDate = endDateTime.split('T')[0];
    }
    
    const hasBothDates = finalStartDate !== '' && finalEndDate !== '';
    console.log(`🔍 [VehiclesScreen] handleSearch - hasBothDates:`, hasBothDates, `finalStartDate: "${finalStartDate}"`, `finalEndDate: "${finalEndDate}"`);
    
    // Construire les filtres en incluant TOUJOURS les dates si elles sont définies
    const searchFilters: VehicleFilters = {
      ...filters,
      search: searchQuery.trim() || undefined,
      // Si on a une localisation sélectionnée, utiliser son nom pour la recherche hiérarchique
      locationName: selectedLocationName || filters.locationName,
    };
    
    // IMPORTANT: Toujours inclure les dates si elles sont définies, même si on a d'autres filtres
    if (hasBothDates) {
      searchFilters.startDate = finalStartDate;
      searchFilters.endDate = finalEndDate;
      searchFilters.rentalType = undefined; // Toujours utiliser la recherche par jour pour les recherches avec dates
      console.log(`✅ [VehiclesScreen] handleSearch - Dates ajoutées aux filtres:`, finalStartDate, finalEndDate);
    } else {
      console.log(`⚠️ [VehiclesScreen] handleSearch - Dates non ajoutées (hasBothDates=false)`);
    }
    
    console.log(`🔍 [VehiclesScreen] handleSearch - searchFilters avant nettoyage:`, searchFilters);
    
    // Nettoyer les filtres undefined (mais préserver les dates si elles sont définies)
    const cleanedFilters: VehicleFilters = Object.fromEntries(
      Object.entries(searchFilters).filter(([key, value]) => {
        if (value === undefined || value === '') {
          console.log(`🗑️ [VehiclesScreen] handleSearch - Filtre "${key}" supprimé (valeur: ${value})`);
          return false;
        }
        if (Array.isArray(value) && value.length === 0) {
          console.log(`🗑️ [VehiclesScreen] handleSearch - Filtre "${key}" supprimé (tableau vide)`);
          return false;
        }
        return true;
      })
    ) as VehicleFilters;
    
    console.log(`🔍 [VehiclesScreen] handleSearch - cleanedFilters après nettoyage:`, cleanedFilters);
    
    // Ne pas appeler fetchVehicles si tous les filtres sont vides (sauf si on a des dates)
    const hasAnyFilters = Object.keys(cleanedFilters).length > 0;
    if (!hasAnyFilters) {
      console.log(`⏭️ [VehiclesScreen] handleSearch - Appel fetchVehicles ignoré - tous les filtres sont vides`);
      return;
    }
    
    console.log(`🔄 [VehiclesScreen] handleSearch - Appel fetchVehicles avec filtres:`, cleanedFilters);
    fetchVehicles(cleanedFilters);
  };

  const handleDateTimeChange = (start: string, end: string) => {
    setStartDateTime(start);
    setEndDateTime(end);
    // Extraire aussi les dates pour compatibilité
    const newStartDate = start.split('T')[0];
    const newEndDate = end.split('T')[0];
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Appeler fetchVehicles automatiquement si les deux dates sont définies
    if (newStartDate && newEndDate) {
      const searchFilters: VehicleFilters = {
        ...filters,
        search: searchQuery.trim() || undefined,
        locationName: selectedLocationName || filters.locationName,
        startDate: newStartDate,
        endDate: newEndDate,
        rentalType: undefined,
      };
      
      // Nettoyer les filtres undefined
      const cleanedFilters: VehicleFilters = Object.fromEntries(
        Object.entries(searchFilters).filter(([_, value]) => {
          if (value === undefined || value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        })
      ) as VehicleFilters;
      
      console.log(`🔄 [VehiclesScreen] handleDateTimeChange - Appel fetchVehicles avec dates:`, cleanedFilters);
      fetchVehicles(cleanedFilters);
    }
  };

  const handleDateGuestsChange = (dates: { checkIn?: string; checkOut?: string }, guests: { adults: number; children: number; babies: number }) => {
    // Pour les véhicules, on utilise seulement les dates (pas les voyageurs)
    const newStartDate = dates.checkIn || '';
    const newEndDate = dates.checkOut || '';
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    
    // Sauvegarder les dates dans le contexte
    saveSearchDates({
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      adults: guests.adults,
      children: guests.children,
      babies: guests.babies,
    });
    
    // Appeler fetchVehicles automatiquement si les deux dates sont définies
    if (newStartDate && newEndDate) {
      const searchFilters: VehicleFilters = {
        ...filters,
        search: searchQuery.trim() || undefined,
        locationName: selectedLocationName || filters.locationName,
        startDate: newStartDate,
        endDate: newEndDate,
        rentalType: undefined,
      };
      
      // Nettoyer les filtres undefined
      const cleanedFilters: VehicleFilters = Object.fromEntries(
        Object.entries(searchFilters).filter(([_, value]) => {
          if (value === undefined || value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        })
      ) as VehicleFilters;
      
      console.log(`🔄 [VehiclesScreen] handleDateGuestsChange - Appel fetchVehicles avec dates:`, cleanedFilters);
      fetchVehicles(cleanedFilters);
    }
  };

  const handleResetFilters = () => {
    // Réinitialiser tous les filtres
    setFilters({});
    setSearchQuery('');
    setSelectedLocationName('');
    setStartDate('');
    setEndDate('');
    setStartDateTime('');
    setEndDateTime('');
    
    // Afficher tous les véhicules (sans filtres)
    console.log(`🔄 [VehiclesScreen] handleResetFilters - Réinitialisation et affichage de tous les véhicules`);
    fetchVehicles({});
  };

  const removeFilter = (filterKey: keyof VehicleFilters) => {
    const newFilters = { ...filters };
    delete newFilters[filterKey];
    setFilters(newFilters);
    if (filterKey === 'locationId' || filterKey === 'locationName') {
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
    if (filters.locationId || filters.locationName) count++;
    if (filters.features && filters.features.length > 0) count++;
    if (filters.search) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    return count;
  };

  const getTransmissionLabel = (transmission: string | null) => {
    if (!transmission) return '';
    return transmission === 'automatic' ? 'Auto' : 'Manuel';
  };

  const getFuelLabel = (fuel: string | null) => {
    if (!fuel) return '';
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
      {/* Header avec bouton retour */}
      <SafeAreaView style={styles.headerContainer} edges={['top']}>
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => safeGoBack(navigation, 'Home')}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="car-outline" size={20} color="#fff" />
              <Text style={styles.topHeaderTitle}>Location de véhicules</Text>
            </View>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={[]} style={styles.safeArea}>
        {/* Hero Section avec gradient - FIXE */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Trouvez le véhicule parfait</Text>
            <Text style={styles.heroSubtitle}>
              SUV, berlines, motos et plus encore. Paiement en espèces uniquement.
            </Text>
            <TouchableOpacity
              style={styles.heroAddVehicleBtn}
              onPress={() => {
                if (user) {
                  navigation.navigate('AddVehicle' as never);
                } else {
                  navigation.navigate('Auth' as never, { redirect: '/add-vehicle' } as never);
                }
              }}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.heroAddVehicleBtnText}>Proposer mon véhicule</Text>
            </TouchableOpacity>
          </View>

          {/* Barre de recherche intégrée */}
          <View style={styles.searchBarContainer}>
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
                    Marque, modèle, titre...
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowFilters(true)}
                style={styles.filterIconBtn}
              >
                <Ionicons name="options-outline" size={20} color="#2563eb" />
                {getActiveFiltersCount() > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSearch}
                style={styles.searchIconBtn}
              >
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Liste des véhicules avec header */}
      <FlatList
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
        style={styles.flatList}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Section contenu */}
            <View style={styles.contentSection}>
              {/* En-tête avec titre */}
              <View style={styles.contentHeader}>
                <View style={styles.contentHeaderLeft}>
                  <Text style={styles.contentTitle}>Véhicules disponibles</Text>
                  <Text style={styles.contentSubtitle}>
                    Trouvez le véhicule qui correspond à vos besoins
                  </Text>
                </View>
                {(getActiveFiltersCount() > 0 || startDate || endDate) && (
                  <TouchableOpacity
                    style={styles.resetAllBtn}
                    onPress={handleResetFilters}
                  >
                    <Ionicons name="refresh-outline" size={16} color="#2563eb" />
                    <Text style={styles.resetAllBtnText}>Tout réinitialiser</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Filtres actifs */}
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
                    {(filters.locationId || filters.locationName) && (
                      <View style={styles.chip}>
                        <Text style={styles.chipText} numberOfLines={1}>
                          {selectedLocationName || filters.locationName || 'Lieu'}
                        </Text>
                        <TouchableOpacity onPress={() => {
                          removeFilter('locationId');
                          removeFilter('locationName');
                          setSelectedLocationName('');
                        }}>
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
                    {(filters.startDate || filters.endDate) && (
                      <View style={styles.chip}>
                        <Text style={styles.chipText} numberOfLines={1}>
                          {filters.startDate && filters.endDate
                            ? `${new Date(filters.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - ${new Date(filters.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
                            : filters.startDate
                            ? `À partir du ${new Date(filters.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
                            : filters.endDate
                            ? `Jusqu'au ${new Date(filters.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
                            : ''}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            removeFilter('startDate');
                            removeFilter('endDate');
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

              {/* Nombre de résultats et bouton afficher tous */}
              <View style={styles.resultsRow}>
                {vehicles && vehicles.length > 0 && (
                  <View style={styles.resultsCount}>
                    <Text style={styles.resultsCountText}>
                      <Text style={styles.resultsCountBold}>{vehicles.length}</Text> véhicule{vehicles.length > 1 ? 's' : ''} disponible{vehicles.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.showAllBtn}
                  onPress={() => {
                    console.log(`🔄 [VehiclesScreen] Bouton "Afficher tous les véhicules" cliqué`);
                    fetchVehicles({});
                  }}
                >
                  <Ionicons name="list-outline" size={16} color="#2563eb" />
                  <Text style={styles.showAllBtnText}>Afficher tous les véhicules</Text>
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={styles.error}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        }
      />

      {/* Modal de recherche */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
        statusBarTranslucent={false}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.searchModalSafeArea}>
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
                    {/* Dates et heures de location - en premier pour plus de visibilité */}
                    <View style={styles.searchFieldContainer}>
                      <Text style={styles.searchFieldLabel}>Dates et heures de prise/rendu *</Text>
                      <VehicleDateTimeSelector
                        startDateTime={startDateTime}
                        endDateTime={endDateTime}
                        onDateTimeChange={handleDateTimeChange}
                      />
                    </View>

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
                      <Ionicons name="options-outline" size={18} color="#2563eb" />
                      <Text style={styles.modalFilterBtnText} numberOfLines={1} ellipsizeMode="tail">
                        Filtres
                      </Text>
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
        </SafeAreaView>
      </Modal>


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
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    backgroundColor: '#1e293b', // slate-900 - même couleur que heroSection
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerPlaceholder: {
    width: 40,
  },
  safeArea: {
    backgroundColor: '#1e293b',
    flex: 0,
  },
  heroSection: {
    backgroundColor: '#1e293b', // slate-900
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  heroAddVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: VEHICLE_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  heroAddVehicleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchBarContainer: {
    marginTop: 24,
    paddingHorizontal: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
  filterIconBtn: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  searchIconBtn: {
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 12,
  },
  contentSection: {
    backgroundColor: '#f8f9fa',
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  contentHeaderLeft: {
    flex: 1,
    minWidth: 200,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  contentSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addVehicleBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resetAllBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  resultsCount: {
    flex: 1,
  },
  resultsCountText: {
    fontSize: 14,
    color: '#64748b',
  },
  resultsCountBold: {
    fontWeight: '600',
    color: '#0f172a',
  },
  showAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  showAllBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 16,
    zIndex: 1000,
    elevation: 5, // Pour Android
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 60, // Hauteur minimale du header
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
    zIndex: 999,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 4, // Pour Android
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
  flatList: {
    zIndex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 20, // Margin après la barre de recherche
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
  searchModalSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
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
    overflow: 'hidden',
  },
  searchModalHeaderSafeArea: {
    backgroundColor: '#ffffff',
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
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
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
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    overflow: 'visible',
    minWidth: 0, // Permet au flex de fonctionner correctement
  },
  modalFilterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    flexShrink: 1,
    numberOfLines: 1,
  },
  modalBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 10,
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

