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
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle, VehicleFilters } from '../types';
import VehicleCard from '../components/VehicleCard';
import { useLanguage } from '../contexts/LanguageContext';
import VehicleFiltersModal from '../components/VehicleFiltersModal';
import { LocationResult, useLocationSearch } from '../hooks/useLocationSearch';
import { useCurrency } from '../hooks/useCurrency';
import DateGuestsSelector from '../components/DateGuestsSelector';
import { VehicleDateTimeSelector } from '../components/VehicleDateTimeSelector';
import VehicleDateTimePickerModal from '../components/VehicleDateTimePickerModal';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { useAuth } from '../services/AuthContext';
import { safeGoBack } from '../utils/navigation';
import { VEHICLE_COLORS, TRAVELER_COLORS } from '../constants/colors';
import VehicleMapView from '../components/VehicleMapView';

const { width, height } = Dimensions.get('window');
const isSmallScreen = width < 360 || height < 640; // Écrans de 3.12 pouces et moins

const VehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { vehicles, loading, error, fetchVehicles, refetch } = useVehicles();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { dates: searchDates, setDates: saveSearchDates } = useSearchDatesContext();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<VehicleFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationName, setSelectedLocationName] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<LocationResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
  const locationInputRef = useRef<TextInput>(null);
  const { searchLocations, getPopularLocations } = useLocationSearch();
  const [startDate, setStartDate] = useState<string>(searchDates.checkIn || '');
  const [endDate, setEndDate] = useState<string>(searchDates.checkOut || '');
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [endDateTime, setEndDateTime] = useState<string>('');
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // AMÉLIORATION: États pour le nouveau design avec carte
  const [isMapView, setIsMapView] = useState(true); // Carte par défaut
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [showRentalModeModal, setShowRentalModeModal] = useState(false);
  const [selectedVehicleGroup, setSelectedVehicleGroup] = useState<string[]>([]);
  const [filteredVehiclesForList, setFilteredVehiclesForList] = useState<Vehicle[]>([]);
  
  // Fonction pour calculer la durée en heures
  const calculateRentalHours = (): number => {
    if (!startDateTime || !endDateTime) return 0;
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60));
  };
  
  const rentalHours = calculateRentalHours();
  
  // Fonction pour formater la date/heure pour l'affichage
  const formatDateTime = (dateTime: string | null): string => {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    }) + ' à ' + date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Réinitialiser la liste filtrée quand les véhicules changent
  useEffect(() => {
    if (selectedVehicleGroup.length === 0) {
      setFilteredVehiclesForList([]);
    }
  }, [vehicles, selectedVehicleGroup]);

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

  const handleVehicleGroupPress = (vehicleIds: string[]) => {
    // Si on reclique sur le même groupe, fermer l'encart
    if (selectedVehicleGroup.length > 0 && 
        selectedVehicleGroup.length === vehicleIds.length &&
        selectedVehicleGroup.every(id => vehicleIds.includes(id))) {
      setSelectedVehicleGroup([]);
      setFilteredVehiclesForList([]);
      return;
    }
    
    // Afficher la liste horizontale avec les véhicules de ce groupe
    setSelectedVehicleGroup(vehicleIds);
    const groupVehicles = vehicles.filter(v => vehicleIds.includes(v.id));
    setFilteredVehiclesForList(groupVehicles);
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
    setShowSearchModal(false);
    setLocationSearchQuery('');
    setLocationSearchResults([]);
  };

  // Charger les villes populaires quand la modal s'ouvre
  useEffect(() => {
    if (showSearchModal && locationSearchQuery.length === 0) {
      setIsSearchingLocation(true);
      getPopularLocations().then((results) => {
        setLocationSearchResults(results);
        setIsSearchingLocation(false);
      }).catch(() => {
        setIsSearchingLocation(false);
      });
      
      // Délai avant de focuser pour éviter le conflit avec la barre de statut
      setTimeout(() => {
        setShouldFocusInput(true);
        locationInputRef.current?.focus();
      }, 300);
    } else if (!showSearchModal) {
      setShouldFocusInput(false);
    }
  }, [showSearchModal]); // Seulement quand la modal s'ouvre

  // Recherche de localisation en temps réel
  useEffect(() => {
    if (!showSearchModal) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    if (locationSearchQuery.length >= 2) {
      setIsSearchingLocation(true);
      timeoutId = setTimeout(async () => {
        try {
          const results = await searchLocations(locationSearchQuery);
          setLocationSearchResults(results);
        } catch (error) {
          console.error('Erreur recherche localisation:', error);
          setLocationSearchResults([]);
        } finally {
          setIsSearchingLocation(false);
        }
      }, 300);
    } else if (locationSearchQuery.length === 0) {
      // Recharger les villes populaires si le champ est vidé
      setIsSearchingLocation(true);
      getPopularLocations().then((results) => {
        setLocationSearchResults(results);
        setIsSearchingLocation(false);
      }).catch(() => {
        setIsSearchingLocation(false);
      });
    } else {
      setLocationSearchResults([]);
      setIsSearchingLocation(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [locationSearchQuery]); // Seulement quand la requête change

  // Réinitialiser quand la modal se ferme
  useEffect(() => {
    if (!showSearchModal) {
      setLocationSearchQuery('');
      setLocationSearchResults([]);
      setIsSearchingLocation(false);
    }
  }, [showSearchModal]);

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
      <SafeAreaView style={styles.newContainer} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={TRAVELER_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.newContainer}>
      {/* Carte en arrière-plan */}
      {isMapView && (
        <View style={styles.mapContainer}>
          <VehicleMapView
            vehicles={vehicles}
            onVehiclePress={(vehicleId) => {
              const vehicle = vehicles.find(v => v.id === vehicleId);
              if (vehicle) handleVehiclePress(vehicle);
            }}
            onVehicleGroupPress={handleVehicleGroupPress}
            userLocation={userLocation}
          />
        </View>
      )}
      
      {/* Overlay avec header et filtres en haut */}
      <SafeAreaView style={styles.overlayContainer} edges={['top']}>
        {/* Header avec position et dates/heures */}
        <View style={styles.topHeaderBar}>
          <TouchableOpacity 
            style={styles.locationSection}
            onPress={() => setShowSearchModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={18} color={TRAVELER_COLORS.primary} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationText} numberOfLines={1}>
                {selectedLocationName ? selectedLocationName.split(',')[0] || selectedLocationName : 'Localisation'}
              </Text>
              <Text style={styles.locationSubtext} numberOfLines={1}>
                {selectedLocationName && selectedLocationName.includes(',') 
                  ? selectedLocationName.split(',').slice(1).join(',').trim() || selectedLocationName
                  : selectedLocationName || 'Sélectionner un lieu'}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.dateTimeSection}
            onPress={() => setShowDateTimePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={18} color={TRAVELER_COLORS.primary} />
            <View style={styles.dateTimeTextContainer}>
              {startDateTime && endDateTime ? (
                <>
                  <Text style={styles.dateTimeText}>
                    {new Date(startDateTime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} {new Date(startDateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.dateTimeText}>
                    {new Date(endDateTime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} {new Date(endDateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </>
              ) : (
                <Text style={styles.dateTimePlaceholder}>Quand ?</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Barre de filtres en haut */}
        <View style={styles.filtersBar}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersBarContent}
          >
            {/* Type de véhicule */}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowVehicleTypeModal(true)}
            >
              <Text style={styles.filterButtonText}>
                {filters.vehicleType || 'Type de véhicule'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={TRAVELER_COLORS.primary} />
            </TouchableOpacity>
            
            {/* Mode de location */}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowRentalModeModal(true)}
            >
              <Text style={styles.filterButtonText}>Mode de location</Text>
              <Ionicons name="chevron-down" size={16} color={TRAVELER_COLORS.primary} />
            </TouchableOpacity>
            
            {/* Plus de filtres */}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="options-outline" size={18} color={TRAVELER_COLORS.primary} />
              <Text style={styles.filterButtonText}>Plus de filtres</Text>
              {getActiveFiltersCount() > 0 && (
                <View style={styles.filterDot}>
                  <View style={styles.filterDotInner} />
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
      
      {/* Bouton Liste en bas à gauche (si vue carte) */}
      {isMapView && (
        <TouchableOpacity
          style={[
            styles.listButton,
            filteredVehiclesForList.length > 0 && styles.listButtonWithBottomSheet
          ]}
          onPress={() => {
            // Fermer l'encart quand on passe en mode liste
            setSelectedVehicleGroup([]);
            setFilteredVehiclesForList([]);
            setIsMapView(false);
          }}
        >
          <Ionicons name="list" size={20} color="#fff" />
          <Text style={styles.listButtonText}>Liste</Text>
        </TouchableOpacity>
      )}
      
      {/* Bouton Carte flottant (si vue liste) */}
      {!isMapView && (
        <TouchableOpacity
          style={[
            styles.mapButton,
            filteredVehiclesForList.length > 0 && styles.mapButtonWithBottomSheet
          ]}
          onPress={() => {
            // Fermer l'encart quand on passe en mode carte
            setSelectedVehicleGroup([]);
            setFilteredVehiclesForList([]);
            setIsMapView(true);
          }}
        >
          <Ionicons name="map" size={20} color="#fff" />
          <Text style={styles.mapButtonText}>Carte</Text>
        </TouchableOpacity>
      )}

      {/* Liste des véhicules (seulement si pas en vue carte) */}
      {!isMapView && (
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
              colors={[TRAVELER_COLORS.primary]}
              tintColor={TRAVELER_COLORS.primary}
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
      )}

      {/* Modal de sélection de localisation - Interface intégrée moderne */}
      <Modal
        visible={showSearchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.searchModalSafeArea}>
          <KeyboardAvoidingView
            style={styles.searchModalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <TouchableOpacity
              style={styles.searchModalBackdrop}
              activeOpacity={1}
              onPress={() => setShowSearchModal(false)}
            >
              <TouchableWithoutFeedback>
                <View style={styles.searchModalContent}>
                  <View style={[styles.searchModalHeaderSafeArea, { paddingTop: Math.max(insets.top, 8) }]}>
                    {/* Header */}
                    <View style={styles.searchModalHeader}>
                    <View style={styles.searchModalHeaderLeft}>
                      <Ionicons name="location" size={24} color={TRAVELER_COLORS.primary} />
                      <Text style={styles.searchModalTitle}>Choisir une localisation</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowSearchModal(false)}
                      style={styles.closeBtn}
                    >
                      <Ionicons name="close" size={24} color="#0f172a" />
                    </TouchableOpacity>
                  </View>
                  </View>

                  {/* Champ de recherche intégré */}
                  <View style={styles.locationSearchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.locationSearchIcon} />
                    <TextInput
                      ref={locationInputRef}
                      style={styles.locationSearchInput}
                      placeholder="Rechercher une ville, commune ou quartier..."
                      placeholderTextColor="#999"
                      value={locationSearchQuery}
                      onChangeText={setLocationSearchQuery}
                      autoFocus={shouldFocusInput}
                      returnKeyType="search"
                      blurOnSubmit={false}
                    />
                    {isSearchingLocation && (
                      <ActivityIndicator size="small" color={TRAVELER_COLORS.primary} style={styles.locationSearchLoader} />
                    )}
                    {locationSearchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setLocationSearchQuery('')}
                        style={styles.locationSearchClear}
                      >
                        <Ionicons name="close-circle" size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Liste des résultats */}
                  <FlatList
                    data={locationSearchResults}
                    keyExtractor={(item) => item.id}
                    style={styles.locationResultsList}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                      !isSearchingLocation && locationSearchQuery.length >= 2 ? (
                        <View style={styles.locationEmptyContainer}>
                          <Ionicons name="search" size={48} color="#ccc" />
                          <Text style={styles.locationEmptyText}>
                            Aucun résultat pour "{locationSearchQuery}"
                          </Text>
                        </View>
                      ) : !isSearchingLocation && locationSearchQuery.length === 0 ? (
                        <View style={styles.locationEmptyContainer}>
                          <Ionicons name="location-outline" size={48} color="#ccc" />
                          <Text style={styles.locationEmptyText}>
                            Commencez à taper pour rechercher
                          </Text>
                        </View>
                      ) : null
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.locationResultItem}
                        onPress={() => handleLocationSelect(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.locationResultIconContainer}>
                          <Ionicons
                            name={item.type === 'city' ? 'location' : item.type === 'commune' ? 'map' : 'home'}
                            size={22}
                            color={item.type === 'city' ? '#2563eb' : item.type === 'commune' ? '#10b981' : '#64748b'}
                          />
                        </View>
                        <View style={styles.locationResultContent}>
                          <Text style={styles.locationResultName}>{item.name}</Text>
                          <View style={styles.locationResultMeta}>
                            {item.type === 'city' && (
                              <Text style={styles.locationResultType}>Ville</Text>
                            )}
                            {item.type === 'commune' && (
                              <Text style={styles.locationResultType}>Commune</Text>
                            )}
                            {item.type === 'neighborhood' && item.commune && (
                              <Text style={styles.locationResultType}>{item.commune} • Quartier</Text>
                            )}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableWithoutFeedback>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Liste horizontale de véhicules en bas - seulement quand on clique sur une clé */}
      {filteredVehiclesForList.length > 0 && (
        <View style={styles.vehiclesHorizontalList}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vehiclesHorizontalListContent}
            snapToInterval={width * 0.85 + 16}
            decelerationRate="fast"
          >
            {filteredVehiclesForList.map((vehicle) => {
              const vehicleImages = vehicle.images || vehicle.vehicle_photos?.map((p: any) => p.url) || [];
              const mainImage = vehicleImages[0] || '';
              const vehicleTitle = vehicle.title || `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}`.trim();
              
              return (
                <TouchableOpacity
                  key={vehicle.id}
                  style={styles.vehicleHorizontalCard}
                  onPress={() => handleVehiclePress(vehicle)}
                  activeOpacity={0.9}
                >
                  {/* Image */}
                  <View style={styles.vehicleHorizontalCardImageContainer}>
                    {mainImage ? (
                      <Image
                        source={{ uri: mainImage }}
                        style={styles.vehicleHorizontalCardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.vehicleHorizontalCardImage, styles.vehicleHorizontalCardImagePlaceholder]}>
                        <Ionicons name="car-outline" size={40} color="#ccc" />
                      </View>
                    )}
                    {/* Badge optionnel - peut être ajouté plus tard si nécessaire */}
                  </View>
                  
                  {/* Contenu */}
                  <View style={styles.vehicleHorizontalCardContent}>
                    <Text style={styles.vehicleHorizontalCardTitle} numberOfLines={1}>
                      {vehicleTitle}
                    </Text>
                    
                    {/* Note */}
                    {vehicle.rating > 0 && (
                      <View style={styles.vehicleHorizontalCardRating}>
                        <Ionicons name="star" size={14} color={TRAVELER_COLORS.primary} />
                        <Text style={styles.vehicleHorizontalCardRatingText}>
                          {vehicle.rating.toFixed(1)}({vehicle.review_count || 0})
                        </Text>
                      </View>
                    )}
                    
                    {/* Prix */}
                    <View style={styles.vehicleHorizontalCardPrice}>
                      {vehicle.hourly_rental_enabled && vehicle.price_per_hour && (
                        <Text style={styles.vehicleHorizontalCardPriceText}>
                          À partir de {formatPrice(vehicle.price_per_hour)} /h
                        </Text>
                      )}
                      <Text style={styles.vehicleHorizontalCardPriceText}>
                        {vehicle.hourly_rental_enabled && vehicle.price_per_hour ? ' • ' : ''}
                        {formatPrice(vehicle.price_per_day)} /jour
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Le menu de navigation en bas est maintenant géré par VehicleTabNavigator */}

      {/* Modal de sélection dates/heures - Style overlay en bas */}
      <VehicleDateTimePickerModal
        visible={showDateTimePicker}
        startDateTime={startDateTime}
        endDateTime={endDateTime}
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={(start, end) => {
          setStartDateTime(start);
          setEndDateTime(end);
          handleDateTimeChange(start, end);
        }}
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
    paddingTop: isSmallScreen ? 12 : 16,
    paddingBottom: isSmallScreen ? 24 : 40,
    paddingHorizontal: isSmallScreen ? 16 : 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    alignItems: 'center',
    marginBottom: isSmallScreen ? 12 : 16,
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
    fontSize: isSmallScreen ? 24 : 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: isSmallScreen ? 8 : 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: isSmallScreen ? 13 : 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    paddingHorizontal: isSmallScreen ? 8 : 0,
  },
  heroAddVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: VEHICLE_COLORS.primary,
    paddingVertical: isSmallScreen ? 10 : 12,
    paddingHorizontal: isSmallScreen ? 18 : 24,
    borderRadius: 12,
    marginTop: isSmallScreen ? 12 : 20,
  },
  heroAddVehicleBtnText: {
    color: '#fff',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
  searchBarContainer: {
    marginTop: isSmallScreen ? 16 : 24,
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
    minHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
    overflow: 'hidden',
  },
  searchModalHeaderSafeArea: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  searchModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
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
  // Styles pour la recherche de localisation intégrée
  locationSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  locationSearchIcon: {
    marginRight: 12,
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    padding: 0,
  },
  locationSearchLoader: {
    marginLeft: 8,
  },
  locationSearchClear: {
    marginLeft: 8,
    padding: 4,
  },
  locationResultsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  locationResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  locationResultIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationResultContent: {
    flex: 1,
  },
  locationResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  locationResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationResultType: {
    fontSize: 13,
    color: '#64748b',
  },
  locationEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  locationEmptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
  },
  // AMÉLIORATION: Nouveaux styles pour le design avec carte
  newContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topHeaderBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
  },
  locationSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 16,
    paddingRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    lineHeight: 18,
  },
  locationSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    lineHeight: 16,
  },
  dateTimeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  dateTimeTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  dateTimeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    lineHeight: 18,
  },
  dateTimePlaceholder: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  filtersBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersBarContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TRAVELER_COLORS.primary,
    marginLeft: 4,
  },
  filterDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TRAVELER_COLORS.primary,
  },
  listButton: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TRAVELER_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 30,
  },
  listButtonWithBottomSheet: {
    bottom: 280,
  },
  listButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TRAVELER_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 30,
  },
  mapButtonWithBottomSheet: {
    bottom: 280,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontWeight: '500',
  },
  navLabelActive: {
    color: TRAVELER_COLORS.primary,
    fontWeight: '600',
  },
  dateTimeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateTimeOval: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TRAVELER_COLORS.primary,
  },
  dateTimeOvalInactive: {
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  dateTimeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  dateTimeValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: TRAVELER_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TRAVELER_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  vehiclesHorizontalList: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 10,
  },
  vehiclesHorizontalListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  vehicleHorizontalCard: {
    width: width * 0.85,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  vehicleHorizontalCardImageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  vehicleHorizontalCardImage: {
    width: '100%',
    height: '100%',
  },
  vehicleHorizontalCardImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleHorizontalCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vehicleHorizontalCardBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vehicleHorizontalCardContent: {
    padding: 12,
  },
  vehicleHorizontalCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  vehicleHorizontalCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  vehicleHorizontalCardRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  vehicleHorizontalCardPrice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  vehicleHorizontalCardPriceText: {
    fontSize: 14,
    fontWeight: '600',
    color: TRAVELER_COLORS.primary,
  },
});

export default VehiclesScreen;

