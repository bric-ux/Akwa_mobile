import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProperties } from '../hooks/useProperties';
import { useHotels } from '../hooks/useHotels';
import { usePropertySorting, SortOption } from '../hooks/usePropertySorting';
import { useApprovedMonthlyRentalListings, ApprovedMonthlyFilters } from '../hooks/useApprovedMonthlyRentalListings';
import { Property, SearchFilters, RootStackParamList, HotelEstablishment, HotelFilters } from '../types';
import type { MonthlyRentalListing } from '../types';
import PropertyCard from '../components/PropertyCard';
import HotelCard from '../components/HotelCard';
import MonthlyRentalListingCard from '../components/MonthlyRentalListingCard';
import FiltersModal, { SearchFilterContext } from '../components/FiltersModal';
import SearchResultsHeader from '../components/SearchResultsHeader';
import SearchFormModal from '../components/SearchFormModal';
import SearchResultsView from '../components/SearchResultsView';
import { supabase } from '../services/supabase';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';
import { HOTEL_COLORS } from '../constants/colors';
import { getPublicPropertyListVersion } from '../utils/publicPropertyListVersion';

const SEARCH_LIST_PAGE_SIZE = 30;

function buildHotelSearchFilters(filters: SearchFilters, query: string): HotelFilters {
  return {
    search: (query || filters.city || '').trim() || undefined,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    guests: filters.guests,
    establishmentType: filters.establishmentType,
    starRatingMin: filters.starRatingMin,
  };
}

function buildMonthlySearchFilters(
  filters: SearchFilters,
  query: string,
): ApprovedMonthlyFilters {
  return {
    city: query || undefined,
    propertyType: filters.monthlyPropertyType,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    isFurnished: filters.isFurnished,
    chargesIncluded: filters.chargesIncluded,
    minSurfaceM2: filters.minSurfaceM2,
    minBedrooms: filters.minBedrooms,
  };
}

function sortHotelsForSearch(
  list: HotelEstablishment[],
  sortBy: SortOption,
): HotelEstablishment[] {
  const items = [...list];
  switch (sortBy) {
    case 'price_asc':
      return items.sort(
        (a, b) => (a.min_price_per_night ?? Infinity) - (b.min_price_per_night ?? Infinity),
      );
    case 'price_desc':
      return items.sort(
        (a, b) => (b.min_price_per_night ?? 0) - (a.min_price_per_night ?? 0),
      );
    case 'rating_desc':
      return items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    default:
      return items;
  }
}

type SearchScreenRouteProp = RouteProp<RootStackParamList, 'Search'>;

const SearchScreen: React.FC = () => {
  const route = useRoute<SearchScreenRouteProp>();
  const navigation = useNavigation();
  
  const openResultsOnMount = route.params?.openResults === true;

  const [shortTermSearchQuery, setShortTermSearchQuery] = useState(route.params?.destination || '');
  const [monthlySearchQuery, setMonthlySearchQuery] = useState(route.params?.destination || '');
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const initialAcc = (route.params as RootStackParamList['Search'])?.initialAccommodationType;
    if (!FEATURE_MONTHLY_RENTAL) {
      return { rentalType: 'short_term', accommodationType: initialAcc ?? 'all' };
    }
    const initial = (route.params as any)?.initialRentalType;
    return {
      rentalType: initial === 'monthly' ? 'monthly' : 'short_term',
      accommodationType: initialAcc ?? 'all',
    };
  });
  const initialRentalTypeApplied = useRef(false);
  const [showFilters, setShowFilters] = useState(false);
  // Utiliser sortBy des filtres, avec fallback sur 'popular'
  const sortBy = (filters.sortBy || 'popular') as SortOption;
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(openResultsOnMount);
  const [showSearchForm, setShowSearchForm] = useState(!openResultsOnMount);
  const [isMapView, setIsMapView] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { properties, loading, error, fetchProperties, refreshProperties } = useProperties();
  const {
    establishments: hotelEstablishments,
    loading: hotelsLoading,
    fetchEstablishments,
    refetch: refetchHotels,
  } = useHotels();
  const lastHandledCatalogVersionRef = useRef<number | null>(null);
  const sortedProperties = usePropertySorting(properties, sortBy);

  const [searchListPage, setSearchListPage] = useState(1);
  useEffect(() => {
    setSearchListPage(1);
  }, [properties]);

  const sortedPropertiesVisible = useMemo(
    () => sortedProperties.slice(0, searchListPage * SEARCH_LIST_PAGE_SIZE),
    [sortedProperties, searchListPage]
  );
  const hasMoreSearchListItems = sortedProperties.length > sortedPropertiesVisible.length;

  const handleSearchListEndReached = useCallback(() => {
    if (!hasMoreSearchListItems) return;
    setSearchListPage((p) => p + 1);
  }, [hasMoreSearchListItems]);

  const searchListFooter = useMemo(() => {
    if (sortedProperties.length === 0) return null;
    return (
      <View style={styles.searchListFooter}>
        <Text style={styles.searchListFooterText}>
          Affichage de {sortedPropertiesVisible.length} sur {sortedProperties.length}
        </Text>
        {hasMoreSearchListItems ? (
          <Text style={styles.searchListFooterHint}>Faites défiler pour afficher plus</Text>
        ) : null}
      </View>
    );
  }, [sortedProperties.length, sortedPropertiesVisible.length, hasMoreSearchListItems]);

  const { listings: monthlyListings, loading: monthlyLoading, fetchListings: fetchMonthlyListings } = useApprovedMonthlyRentalListings();
  const { dates: searchDates, setDates: saveSearchDates } = useSearchDatesContext();
  
  // États pour les dates et voyageurs (initialiser depuis le context, mais seulement si définis)
  const [checkIn, setCheckIn] = useState<string>(searchDates.checkIn || '');
  const [checkOut, setCheckOut] = useState<string>(searchDates.checkOut || '');
  const [adults, setAdults] = useState(searchDates.adults || 1);
  const [children, setChildren] = useState(searchDates.children || 0);
  const [babies, setBabies] = useState(searchDates.babies || 0);

  // Appliquer initialRentalType au premier montage (ex: depuis la section longue durée de l'accueil)
  useEffect(() => {
    if (!FEATURE_MONTHLY_RENTAL) return;
    const initial = (route.params as any)?.initialRentalType;
    if (initial && !initialRentalTypeApplied.current) {
      initialRentalTypeApplied.current = true;
      setFilters((prev) => ({ ...prev, rentalType: initial === 'monthly' ? 'monthly' : 'short_term' }));
    }
  }, [route.params]);

  // Synchroniser avec le context quand il change
  useEffect(() => {
    // Synchroniser seulement si les dates sont définies dans le contexte
    // Ne pas afficher de dates par défaut si elles ne sont pas explicitement définies
    if (searchDates.checkIn !== undefined && searchDates.checkIn !== '' && searchDates.checkIn !== checkIn) {
      console.log('📅 SearchScreen - Synchronisation checkIn depuis context:', searchDates.checkIn);
      setCheckIn(searchDates.checkIn);
    } else if (searchDates.checkIn === undefined || searchDates.checkIn === '') {
      // Si la date n'est pas définie dans le contexte, la réinitialiser
      if (checkIn !== '') {
        setCheckIn('');
      }
    }
    if (searchDates.checkOut !== undefined && searchDates.checkOut !== '' && searchDates.checkOut !== checkOut) {
      console.log('📅 SearchScreen - Synchronisation checkOut depuis context:', searchDates.checkOut);
      setCheckOut(searchDates.checkOut);
    } else if (searchDates.checkOut === undefined || searchDates.checkOut === '') {
      // Si la date n'est pas définie dans le contexte, la réinitialiser
      if (checkOut !== '') {
        setCheckOut('');
      }
    }
    if (searchDates.adults !== undefined && searchDates.adults !== adults) {
      console.log('📅 SearchScreen - Synchronisation adults depuis context:', searchDates.adults);
      setAdults(searchDates.adults);
    }
    if (searchDates.children !== undefined && searchDates.children !== children) {
      console.log('📅 SearchScreen - Synchronisation children depuis context:', searchDates.children);
      setChildren(searchDates.children);
    }
    if (searchDates.babies !== undefined && searchDates.babies !== babies) {
      console.log('📅 SearchScreen - Synchronisation babies depuis context:', searchDates.babies);
      setBabies(searchDates.babies);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDates.checkIn, searchDates.checkOut, searchDates.adults, searchDates.children, searchDates.babies]);


  const rentalType = filters.rentalType ?? 'short_term';
  const accommodationType = filters.accommodationType ?? 'all';

  const filterContext: SearchFilterContext = useMemo(() => {
    if (rentalType === 'monthly') return 'monthly';
    if (accommodationType === 'hotel') return 'hotel';
    if (accommodationType === 'property') return 'residence';
    return 'mixed';
  }, [rentalType, accommodationType]);

  const showHotels =
    rentalType === 'short_term' && (accommodationType === 'all' || accommodationType === 'hotel');
  const showProperties =
    rentalType === 'short_term' && (accommodationType === 'all' || accommodationType === 'property');
  const currentSearchQuery = rentalType === 'monthly' ? monthlySearchQuery : shortTermSearchQuery;

  const fetchShortTermResults = useCallback(
    async (searchFilters: SearchFilters, query: string) => {
      const acc = searchFilters.accommodationType ?? 'all';
      const tasks: Promise<unknown>[] = [];
      if (acc === 'all' || acc === 'property') {
        tasks.push(fetchProperties({ ...searchFilters, city: query }));
      }
      if (acc === 'all' || acc === 'hotel') {
        tasks.push(fetchEstablishments(buildHotelSearchFilters(searchFilters, query)));
      }
      await Promise.all(tasks);
    },
    [fetchProperties, fetchEstablishments],
  );

  const sortedHotels = useMemo(
    () => sortHotelsForSearch(hotelEstablishments, sortBy),
    [hotelEstablishments, sortBy],
  );

  const totalShortTermResults =
    (showProperties ? sortedProperties.length : 0) + (showHotels ? sortedHotels.length : 0);

  const resultsStillLoading =
    rentalType === 'monthly'
      ? monthlyLoading && monthlyListings.length === 0
      : (loading || (showHotels && hotelsLoading)) && totalShortTermResults === 0;

  const openResultsFetchedRef = useRef(false);

  useLayoutEffect(() => {
    if (!openResultsOnMount || openResultsFetchedRef.current) return;
    openResultsFetchedRef.current = true;
    if (rentalType === 'monthly') {
      void fetchMonthlyListings({});
      return;
    }
    void fetchShortTermResults(filters, shortTermSearchQuery);
  }, [
    openResultsOnMount,
    rentalType,
    filters,
    shortTermSearchQuery,
    fetchMonthlyListings,
    fetchShortTermResults,
  ]);

  useEffect(() => {
    if (!hasSubmittedSearch || rentalType !== 'short_term') return;
    if (shortTermSearchQuery) {
      void fetchShortTermResults({ ...filters, city: shortTermSearchQuery }, shortTermSearchQuery);
    } else {
      void fetchShortTermResults(filters, '');
    }
  }, [hasSubmittedSearch, shortTermSearchQuery, filters, rentalType, fetchShortTermResults]);

  useFocusEffect(
    useCallback(() => {
      if (!hasSubmittedSearch || rentalType !== 'short_term') return;
      const v = getPublicPropertyListVersion();
      if (lastHandledCatalogVersionRef.current === null) {
        lastHandledCatalogVersionRef.current = v;
        return;
      }
      if (v > lastHandledCatalogVersionRef.current) {
        lastHandledCatalogVersionRef.current = v;
        if (shortTermSearchQuery) {
          void refreshProperties({ ...filters, city: shortTermSearchQuery });
          if (showHotels) void refetchHotels();
        } else {
          void refreshProperties(filters);
          if (showHotels) void refetchHotels();
        }
      }
    }, [hasSubmittedSearch, rentalType, shortTermSearchQuery, filters, refreshProperties, showHotels, refetchHotels])
  );

  const onRefresh = useCallback(async () => {
    if (!hasSubmittedSearch || rentalType !== 'short_term') return;
    setRefreshing(true);
    try {
      if (shortTermSearchQuery) {
        await fetchShortTermResults({ ...filters, city: shortTermSearchQuery }, shortTermSearchQuery);
      } else {
        await fetchShortTermResults(filters, '');
      }
    } finally {
      setRefreshing(false);
    }
  }, [hasSubmittedSearch, rentalType, shortTermSearchQuery, filters, fetchShortTermResults]);

  useEffect(() => {
    if (!hasSubmittedSearch || rentalType !== 'monthly') return;
    fetchMonthlyListings(buildMonthlySearchFilters(filters, monthlySearchQuery));
  }, [hasSubmittedSearch, rentalType, monthlySearchQuery, filters, fetchMonthlyListings]);

  // Charger les recherches récentes
  useEffect(() => {
    // Simuler le chargement des recherches récentes depuis le stockage local
    setRecentSearches(['Abidjan', 'Yamoussoukro', 'Grand-Bassam']);
  }, []);

  const handleSearch = async (query: string, options?: { forceFetch?: boolean }) => {
    if (rentalType === 'monthly') {
      setMonthlySearchQuery(query);
    } else {
      setShortTermSearchQuery(query);
    }

    if (!query.trim()) {
      setSelectedLocation(null);
      if (!hasSubmittedSearch) return;
      setIsSearching(true);
      try {
        if (rentalType === 'monthly') {
          await fetchMonthlyListings({});
        } else {
          await fetchShortTermResults(
            { ...filters, city: '', centerLat: undefined, centerLng: undefined },
            '',
          );
        }
      } finally {
        setIsSearching(false);
      }
      return;
    }

    if (!hasSubmittedSearch && !options?.forceFetch) return;

    setIsSearching(true);
    
    if (rentalType === 'monthly') {
      try {
        if (query.trim()) {
          if (!recentSearches.includes(query)) {
            setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
          }
          await fetchMonthlyListings({ city: query || undefined });
        } else {
          await fetchMonthlyListings({});
        }
      } finally {
        setIsSearching(false);
      }
      return;
    }

    if (query.trim()) {
      // Ajouter à l'historique des recherches
      if (!recentSearches.includes(query)) {
        setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
      }
      
      try {
        // Si un rayon est spécifié, récupérer les coordonnées de la localisation
        let centerLat: number | undefined = filters.centerLat;
        let centerLng: number | undefined = filters.centerLng;
        
        // Si un rayon est défini mais pas de coordonnées, les récupérer
        if (filters.radiusKm && filters.radiusKm > 0 && (!centerLat || !centerLng)) {
          try {
            // Chercher la localisation dans la base de données
            const { data: locationData } = await supabase
              .from('locations')
              .select('id, name, latitude, longitude, type')
              .or(`name.ilike.%${query.trim()}%,name.eq.${query.trim()}`)
              .limit(1)
              .single();
            
            if (locationData?.latitude && locationData?.longitude) {
              centerLat = locationData.latitude;
              centerLng = locationData.longitude;
              setSelectedLocation({ lat: centerLat, lng: centerLng });
              console.log(`📍 Coordonnées trouvées pour "${query}": [${centerLat}, ${centerLng}]`);
            } else {
              // Si pas trouvé, chercher dans les villes, communes, quartiers
              const { data: locations } = await supabase
                .from('locations')
                .select('latitude, longitude')
                .or(`name.ilike.%${query.trim()}%`)
                .limit(1)
                .single();
              
              if (locations?.latitude && locations?.longitude) {
                centerLat = locations.latitude;
                centerLng = locations.longitude;
                setSelectedLocation({ lat: centerLat, lng: centerLng });
                console.log(`📍 Coordonnées trouvées (recherche large) pour "${query}": [${centerLat}, ${centerLng}]`);
              }
            }
          } catch (err) {
            console.error('Erreur lors de la récupération des coordonnées:', err);
            // Continuer sans coordonnées si erreur
          }
        }
        
        // Construire les filtres de recherche
        const searchFilters: SearchFilters = {
          ...filters,
          city: query,
          checkIn,
          checkOut,
          adults,
          children,
          babies,
          guests: adults + children + babies,
          // Ajouter les coordonnées si trouvées et qu'un rayon est défini
          centerLat: filters.radiusKm && filters.radiusKm > 0 ? centerLat : undefined,
          centerLng: filters.radiusKm && filters.radiusKm > 0 ? centerLng : undefined,
        };
        
        if (rentalType === 'monthly') {
          await fetchMonthlyListings({ city: query || undefined });
        } else {
          await fetchShortTermResults(searchFilters, query);
        }
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleSuggestionSelect = async (suggestion: any) => {
    if (rentalType === 'monthly') {
      setMonthlySearchQuery(suggestion.text);
      return;
    }
    setShortTermSearchQuery(suggestion.text);
    
    // Récupérer les coordonnées du lieu sélectionné si disponible
    let centerLat: number | undefined;
    let centerLng: number | undefined;
    
    if (suggestion.latitude && suggestion.longitude) {
      centerLat = suggestion.latitude;
      centerLng = suggestion.longitude;
      setSelectedLocation({ lat: centerLat, lng: centerLng });
    } else if (suggestion.id) {
      // Si on a un ID mais pas de coordonnées, les récupérer depuis la base
      try {
        const { data } = await supabase
          .from('locations')
          .select('latitude, longitude')
          .eq('id', suggestion.id)
          .single();
        
        if (data?.latitude && data?.longitude) {
          centerLat = data.latitude;
          centerLng = data.longitude;
          setSelectedLocation({ lat: centerLat, lng: centerLng });
        }
      } catch (err) {
        console.error('Erreur lors de la récupération des coordonnées:', err);
      }
    }
    
    // Mettre à jour les filtres avec la nouvelle ville sélectionnée et les coordonnées
    const newFilters: SearchFilters = {
      ...filters,
      city: suggestion.text,
      checkIn,
      checkOut,
      adults,
      children,
      babies,
      guests: adults + children + babies,
      centerLat,
      centerLng,
      // Garder le rayon si déjà défini
      radiusKm: filters.radiusKm
    };
    setFilters(newFilters);
  };


  const handleMonthlyListingPress = (listing: MonthlyRentalListing) => {
    navigation.navigate('MonthlyRentalListingDetail' as never, { listingId: listing.id });
  };

  const handlePropertyPress = useCallback(
    (property: Property) => {
      const datesToPass = {
        checkIn: checkIn || searchDates.checkIn,
        checkOut: checkOut || searchDates.checkOut,
        adults: adults || searchDates.adults || 1,
        children: children || searchDates.children || 0,
        babies: babies || searchDates.babies || 0,
      };

      if (__DEV__) {
        console.log('📅 SearchScreen - handlePropertyPress avec dates:', {
          localCheckIn: checkIn,
          localCheckOut: checkOut,
          contextCheckIn: searchDates.checkIn,
          contextCheckOut: searchDates.checkOut,
          datesToPass,
        });
      }

      navigation.navigate('PropertyDetails', {
        propertyId: property.id,
        ...datesToPass,
      });
    },
    [navigation, checkIn, checkOut, adults, children, babies, searchDates]
  );

  const handleHotelPress = useCallback(
    (establishment: HotelEstablishment) => {
      navigation.navigate('HotelDetails', {
        establishmentId: establishment.id,
        checkIn: checkIn || searchDates.checkIn,
        checkOut: checkOut || searchDates.checkOut,
        guests: adults + children + babies,
      });
    },
    [navigation, checkIn, checkOut, adults, children, babies, searchDates],
  );

  const renderPropertyCard = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyCard property={item} onPress={handlePropertyPress} variant="list" />
    ),
    [handlePropertyPress]
  );

  const propertyFlatListPerf = {
    removeClippedSubviews: Platform.OS === 'android',
    maxToRenderPerBatch: 8,
    windowSize: 5,
    initialNumToRender: 6,
    updateCellsBatchingPeriod: 50,
  } as const;

  const closeFilters = () => {
    setShowFilters(false);
  };

  const openFiltersFromSearchForm = () => {
    setShowFilters(true);
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (!hasSubmittedSearch) return;
    const rt = newFilters.rentalType ?? 'short_term';
    if (rt === 'monthly') {
      fetchMonthlyListings(buildMonthlySearchFilters(newFilters, monthlySearchQuery));
      return;
    }
    const searchFilters = {
      ...newFilters,
      city: shortTermSearchQuery,
      checkIn,
      checkOut,
      adults,
      children,
      babies,
      guests: adults + children + babies,
    };
    void fetchShortTermResults(searchFilters, shortTermSearchQuery);
  };


  const handleClearAllFilters = () => {
    setHasSubmittedSearch(false);
    setShowSearchForm(true);
    const clearedFilters: SearchFilters =
      rentalType === 'monthly'
        ? { rentalType: 'monthly' }
        : { rentalType: 'short_term', accommodationType: filters.accommodationType ?? 'all' };
    setFilters(clearedFilters);
    if (rentalType === 'monthly') {
      setMonthlySearchQuery('');
      fetchMonthlyListings({});
    } else {
      setShortTermSearchQuery(''); // Effacer aussi la ville de recherche
      void fetchShortTermResults(
        {
          ...clearedFilters,
          city: '',
          checkIn,
          checkOut,
          adults,
          children,
          babies,
          guests: adults + children + babies,
        },
        '',
      );
    }
  };

  const handleScroll = (event: any) => {
    // Ne plus gérer le collapse automatique au scroll
    // Le header se contrôle uniquement par le bouton recherche
  };

  const handleSearchButtonPress = async (queryFromForm?: string) => {
    const query = (queryFromForm ?? currentSearchQuery).trim();

    if (!query) {
      Alert.alert(
        'Ville requise',
        'Veuillez choisir une ville ou un quartier pour effectuer la recherche.',
        [{ text: 'OK' }]
      );
      return;
    }

    Keyboard.dismiss();

    if (rentalType === 'monthly') {
      setMonthlySearchQuery(query);
    } else {
      setShortTermSearchQuery(query);
    }

    setHasSubmittedSearch(true);
    setShowSearchForm(false);
    await handleSearch(query, { forceFetch: true });
  };

  const handleDateGuestsChange = (dates: { checkIn?: string; checkOut?: string }, guests: { adults: number; children: number; babies: number }) => {
    console.log('📅 SearchScreen - handleDateGuestsChange appelé:', { dates, guests });
    
    setCheckIn(dates.checkIn);
    setCheckOut(dates.checkOut);
    setAdults(guests.adults);
    setChildren(guests.children);
    setBabies(guests.babies);
    
    // Sauvegarder les dates dans le context (qui les sauvegarde aussi dans AsyncStorage)
    const datesToSave = {
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      adults: guests.adults,
      children: guests.children,
      babies: guests.babies,
    };
    
    console.log('📅 SearchScreen - Appel de saveSearchDates avec:', datesToSave);
    saveSearchDates(datesToSave);
    
    // Mettre à jour les filtres et relancer la recherche
    const newFilters = {
      ...filters,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      adults: guests.adults,
      children: guests.children,
      babies: guests.babies,
      guests: guests.adults + guests.children + guests.babies
    };
    
    setFilters(newFilters);
    if (hasSubmittedSearch) {
      void fetchShortTermResults(
        { ...newFilters, city: shortTermSearchQuery },
        shortTermSearchQuery,
      );
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    console.log('🔄 Changement de tri:', newSort);
    // Le tri est appliqué côté client (usePropertySorting) — pas de refetch réseau.
    setFilters((prev) => ({ ...prev, sortBy: newSort as any }));
  };
  
  const handleViewToggle = () => {
    if (rentalType !== 'short_term') return;
    setIsMapView((prev) => !prev);
  };

  const getActiveFiltersCount = (): number => {
    let count = 0;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.guests) count++;
    if (filters.propertyType) count++;
    if (filters.establishmentType) count++;
    if (filters.starRatingMin) count++;
    if (filters.monthlyPropertyType) count++;
    if (filters.isFurnished !== undefined) count++;
    if (filters.chargesIncluded === true) count++;
    if (filters.minSurfaceM2) count++;
    if (filters.minBedrooms) count++;
    if (filters.amenities && filters.amenities.length > 0) count++;
    if (filters.wifi || filters.parking || filters.pool || filters.airConditioning) count++;
    return count;
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getDatesText = () => {
    if (!checkIn && !checkOut) return '';
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const checkInDay = checkInDate.getDate();
      const checkOutDay = checkOutDate.getDate();
      const checkInMonth = checkInDate.toLocaleDateString('fr-FR', { month: 'short' });
      const checkOutMonth = checkOutDate.toLocaleDateString('fr-FR', { month: 'short' });
      
      if (checkInMonth === checkOutMonth) {
        return `${checkInDay}-${checkOutDay} ${checkInMonth}`;
      }
      return `${formatDateShort(checkIn)} - ${formatDateShort(checkOut)}`;
    }
    if (checkIn) return `À partir du ${formatDateShort(checkIn)}`;
    return '';
  };

  const getGuestsText = () => {
    const total = adults + children + babies;
    if (total === 0) return 'Ajouter des voyageurs';
    if (total === 1) return '1 voyageur';
    return `${total} voyageurs`;
  };

  const hasShortTermResults =
    rentalType !== 'monthly' &&
    totalShortTermResults > 0 &&
    !loading &&
    !(showHotels && hotelsLoading) &&
    !error;

  const renderSearchListHeader = useCallback(
    () => (
      <View>
        <SearchResultsHeader
          resultsCount={totalShortTermResults}
          onSortPress={handleSortChange}
          currentSort={sortBy}
          onViewToggle={handleViewToggle}
          isGridView={isMapView}
          showViewToggle={false}
        />
        {showHotels && sortedHotels.length > 0 ? (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsSectionTitle}>
              Hôtels & Appart&apos;hôtel ({sortedHotels.length})
            </Text>
            {sortedHotels.map((hotel) => (
              <HotelCard key={hotel.id} establishment={hotel} onPress={handleHotelPress} />
            ))}
          </View>
        ) : null}
        {showProperties && showHotels && sortedPropertiesVisible.length > 0 ? (
          <Text style={styles.resultsSectionTitle}>
            Résidences meublées ({sortedProperties.length})
          </Text>
        ) : null}
        {accommodationType === 'hotel' && sortedHotels.length > 0 && sortedPropertiesVisible.length === 0 ? (
          <View style={{ height: 4 }} />
        ) : null}
      </View>
    ),
    [
      totalShortTermResults,
      sortBy,
      isMapView,
      showHotels,
      sortedHotels,
      showProperties,
      sortedPropertiesVisible.length,
      sortedProperties.length,
      accommodationType,
      handleHotelPress,
    ],
  );

  const hasPropertyResults = hasShortTermResults && showProperties && sortedProperties.length > 0;

  const openSearchForm = () => setShowSearchForm(true);
  const closeSearchFormToResults = () => {
    if (hasSubmittedSearch) setShowSearchForm(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {hasSubmittedSearch && !showSearchForm ? (
        <View style={styles.resultsTopBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchSummaryPill} onPress={openSearchForm} activeOpacity={0.85}>
            <Ionicons name="search" size={18} color="#2E7D32" />
            <View style={styles.searchSummaryTexts}>
              <Text style={styles.searchSummaryTitle} numberOfLines={1}>
                {currentSearchQuery || 'Destination'}
              </Text>
              <Text style={styles.searchSummarySubtitle} numberOfLines={1}>
                {rentalType === 'monthly'
                  ? 'Location mensuelle'
                  : `${getDatesText() || 'Dates flexibles'} · ${getGuestsText()}`}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={24} color="#333" />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bouton pour effacer les filtres */}
      {hasSubmittedSearch && !showSearchForm && getActiveFiltersCount() > 0 && (
        <View style={styles.clearFiltersContainer}>
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={handleClearAllFilters}
          >
            <Ionicons name="close-circle" size={16} color="#e74c3c" />
            <Text style={styles.clearFiltersButtonText}>
              Effacer la recherche ({getActiveFiltersCount()})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Résultats (affichés seulement après validation) */}
      {hasSubmittedSearch && !showSearchForm && (resultsStillLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={rentalType === 'monthly' ? '#0d9488' : '#2E7D32'} />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : rentalType !== 'monthly' && error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Erreur: {error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              void fetchShortTermResults({ ...filters, city: shortTermSearchQuery }, shortTermSearchQuery)
            }
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : rentalType === 'monthly' ? (
        monthlyListings.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Ionicons name="business-outline" size={64} color="#ccc" />
            <Text style={styles.noResultsTitle}>
              {monthlySearchQuery ? `Aucun logement longue durée à ${monthlySearchQuery}` : 'Aucun logement longue durée'}
            </Text>
            <Text style={styles.noResultsSubtitle}>
              Essayez une autre ville ou ajustez les filtres.
            </Text>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={() => { setFilters({ rentalType: 'monthly' }); setMonthlySearchQuery(''); fetchMonthlyListings?.({}); }}
            >
              <Text style={styles.clearFiltersButtonText}>Effacer les filtres</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={monthlyListings}
            renderItem={({ item }: { item: MonthlyRentalListing }) => (
              <MonthlyRentalListingCard listing={item} onPress={handleMonthlyListingPress} variant="list" />
            )}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.propertiesList}
            {...propertyFlatListPerf}
            ListHeaderComponent={
              <SearchResultsHeader
                resultsCount={monthlyListings.length}
                onSortPress={() => {}}
                currentSort={sortBy}
                onViewToggle={handleViewToggle}
                isGridView={isMapView}
                showViewToggle={false}
              />
            }
          />
        )
      ) : totalShortTermResults === 0 && !loading && !(showHotels && hotelsLoading) ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search" size={64} color="#ccc" />
          <Text style={styles.noResultsTitle}>
            {shortTermSearchQuery ? `Aucun hébergement trouvé à ${shortTermSearchQuery}` : 'Aucun résultat trouvé'}
          </Text>
          <Text style={styles.noResultsSubtitle}>
            {shortTermSearchQuery
              ? 'Essayez une autre ville, changez le type (hôtel / résidence) ou ajustez vos filtres.'
              : 'Commencez par rechercher une ville ou un quartier.'}
          </Text>
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Villes et quartiers disponibles :</Text>
            <Text style={styles.suggestionsText}>
              Villes: Abidjan, Yamoussoukro, Grand-Bassam{'\n'}
              Quartiers: Cocody, Deux Plateaux, Riviera, Marcory...
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => {
              setFilters({ rentalType: 'short_term', accommodationType: 'all' });
              setShortTermSearchQuery('');
              void fetchShortTermResults({ rentalType: 'short_term', accommodationType: 'all' }, '');
            }}
          >
            <Text style={styles.clearFiltersButtonText}>Effacer les filtres</Text>
          </TouchableOpacity>
        </View>
      ) : hasShortTermResults ? (
        isMapView && showProperties && sortedProperties.length > 0 ? (
          <SearchResultsView
            properties={sortedProperties}
            onPropertyPress={handlePropertyPress}
            location={shortTermSearchQuery}
            checkIn={checkIn}
            checkOut={checkOut}
            guests={adults + children + babies}
            searchCenter={selectedLocation}
            searchRadius={filters.radiusKm}
          />
        ) : (
          <FlatList
            data={showProperties ? sortedPropertiesVisible : []}
            renderItem={renderPropertyCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.propertiesList}
            {...propertyFlatListPerf}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#e67e22"
              />
            }
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onEndReached={showProperties ? handleSearchListEndReached : undefined}
            onEndReachedThreshold={0.35}
            ListFooterComponent={showProperties ? searchListFooter : null}
            ListHeaderComponent={renderSearchListHeader}
          />
        )
      ) : null)}

      {/* Bouton flottant Carte/Liste (même logique que l'espace véhicules) */}
      {hasSubmittedSearch && !showSearchForm && rentalType === 'short_term' && showProperties && sortedProperties.length > 0 && (
        <TouchableOpacity
          style={isMapView ? styles.listButton : styles.mapButton}
          onPress={handleViewToggle}
          activeOpacity={0.85}
        >
          <Ionicons name={isMapView ? 'list' : 'map'} size={20} color="#fff" />
          <Text style={isMapView ? styles.listButtonText : styles.mapButtonText}>
            {isMapView ? 'Liste' : 'Carte'}
          </Text>
        </TouchableOpacity>
      )}

      <SearchFormModal
        visible={showSearchForm && !showFilters}
        canDismissToResults={hasSubmittedSearch}
        onClose={closeSearchFormToResults}
        onBack={() => navigation.goBack()}
        onOpenFilters={openFiltersFromSearchForm}
        rentalType={rentalType}
        currentSearchQuery={currentSearchQuery}
        onSearch={handleSearch}
        onSuggestionSelect={handleSuggestionSelect}
        checkIn={checkIn}
        checkOut={checkOut}
        adults={adults}
        children={children}
        babies={babies}
        onDateGuestsChange={handleDateGuestsChange}
        onSearchPress={handleSearchButtonPress}
        isSearching={isSearching}
      />

      <FiltersModal
        visible={showFilters}
        onClose={closeFilters}
        onApply={handleFilterChange}
        initialFilters={filters}
        filterContext={filterContext}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  resultsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchSummaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchSummaryTexts: {
    flex: 1,
    gap: 2,
  },
  searchSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  searchSummarySubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  searchHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'flex-start',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSubtitle: {
    marginTop: 4,
  },
  headerSubtitleText: {
    fontSize: 14,
    color: '#666',
  },
  resultsHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  modalContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  collapsibleHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  collapsibleHeaderCollapsed: {
    paddingVertical: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  modeSwitchContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d6ead7',
    backgroundColor: '#f6fbf6',
  },
  modeChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  modeChipMonthly: {
    borderColor: '#ccfbf1',
    backgroundColor: '#f0fdfa',
  },
  modeChipMonthlyActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  modeChipTextMonthly: {
    color: '#0d9488',
  },
  modeChipTextActive: {
    color: '#fff',
  },
  monthlySearchHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#0d9488',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  collapsedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  collapsedText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewToggleButton: {
    padding: 8,
  },
  mapButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  mapButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  listButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#dc3545',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  noResultsSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  clearFiltersButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    marginTop: 20,
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  suggestionsText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  propertiesList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  resultsSection: {
    marginBottom: 8,
  },
  resultsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    marginTop: 4,
  },
  searchListFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchListFooterText: {
    fontSize: 13,
    color: '#666',
  },
  searchListFooterHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  monthlySection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  monthlySectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  monthlySectionCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  // Styles pour le bouton effacer les filtres
  clearFiltersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  clearFiltersButtonText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default SearchScreen;