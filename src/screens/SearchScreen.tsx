import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProperties } from '../hooks/useProperties';
import { Property, SearchFilters, RootStackParamList } from '../types';
import PropertyCard from '../components/PropertyCard';
import FiltersModal from '../components/FiltersModal';
import SearchSuggestions from '../components/SearchSuggestions';
import SearchResultsHeader from '../components/SearchResultsHeader';
import QuickFilters from '../components/QuickFilters';
import AutoCompleteSearch from '../components/AutoCompleteSearch';
import DateGuestsSelector from '../components/DateGuestsSelector';
import SearchButton from '../components/SearchButton';

type SearchScreenRouteProp = RouteProp<RootStackParamList, 'Search'>;

const SearchScreen: React.FC = () => {
  const route = useRoute<SearchScreenRouteProp>();
  const navigation = useNavigation();
  const { properties, loading, error, fetchProperties } = useProperties();
  
  const [searchQuery, setSearchQuery] = useState(route.params?.destination || '');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('popular');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // États pour les dates et voyageurs
  const [checkIn, setCheckIn] = useState<string>();
  const [checkOut, setCheckOut] = useState<string>();
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [babies, setBabies] = useState(0);

  // Filtres rapides
  const quickFilters = useMemo(() => [
    { id: 'wifi', label: 'WiFi', icon: 'wifi', active: filters.wifi || false },
    { id: 'parking', label: 'Parking', icon: 'car', active: filters.parking || false },
    { id: 'pool', label: 'Piscine', icon: 'water', active: filters.pool || false },
    { id: 'airConditioning', label: 'Climatisation', icon: 'snow', active: filters.airConditioning || false },
    { id: 'under_20000', label: 'Moins de 20k', icon: 'cash', active: filters.priceMax === 20000 },
    { id: 'over_50000', label: 'Plus de 50k', icon: 'diamond', active: filters.priceMin === 50000 },
  ], [filters]);

  useEffect(() => {
    if (searchQuery) {
      fetchProperties({ ...filters, city: searchQuery });
    } else {
      fetchProperties(filters);
    }
  }, [searchQuery, filters]);

  // Charger les recherches récentes
  useEffect(() => {
    // Simuler le chargement des recherches récentes depuis le stockage local
    setRecentSearches(['Abidjan', 'Yamoussoukro', 'Grand-Bassam']);
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true);
    
    if (query.trim()) {
      // Ajouter à l'historique des recherches
      if (!recentSearches.includes(query)) {
        setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
      }
      
      try {
        await fetchProperties({ 
          ...filters, 
          city: query,
          checkIn,
          checkOut,
          adults,
          children,
          babies,
          guests: adults + children + babies
        });
      } finally {
        setIsSearching(false);
      }
    } else {
      try {
        await fetchProperties(filters);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleSuggestionSelect = (suggestion: any) => {
    setSearchQuery(suggestion.text);
    // Mettre à jour les filtres avec la nouvelle ville sélectionnée
    const newFilters = {
      ...filters,
      city: suggestion.text,
      checkIn,
      checkOut,
      adults,
      children,
      babies,
      guests: adults + children + babies
    };
    setFilters(newFilters);
  };

  const handleSearchButtonPress = () => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  };

  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    const searchFilters = { 
      ...newFilters, 
      city: searchQuery,
      checkIn,
      checkOut,
      adults,
      children,
      babies,
      guests: adults + children + babies
    };
    fetchProperties(searchFilters);
  };

  const handleQuickFilterToggle = (filterId: string) => {
    let newFilters = { ...filters };

    switch (filterId) {
      case 'wifi':
        newFilters.wifi = !filters.wifi;
        break;
      case 'parking':
        newFilters.parking = !filters.parking;
        break;
      case 'pool':
        newFilters.pool = !filters.pool;
        break;
      case 'airConditioning':
        newFilters.airConditioning = !filters.airConditioning;
        break;
      case 'under_20000':
        newFilters.priceMax = filters.priceMax === 20000 ? undefined : 20000;
        break;
      case 'over_50000':
        newFilters.priceMin = filters.priceMin === 50000 ? undefined : 50000;
        break;
    }

    setFilters(newFilters);
    fetchProperties({ 
      ...newFilters, 
      city: searchQuery,
      checkIn,
      checkOut,
      adults,
      children,
      babies,
      guests: adults + children + babies
    });
  };

  const handleDateGuestsChange = (dates: { checkIn?: string; checkOut?: string }, guests: { adults: number; children: number; babies: number }) => {
    setCheckIn(dates.checkIn);
    setCheckOut(dates.checkOut);
    setAdults(guests.adults);
    setChildren(guests.children);
    setBabies(guests.babies);
    
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
    fetchProperties({ 
      ...newFilters, 
      city: searchQuery 
    });
  };

  const handleSortChange = () => {
    // Logique de tri sera implémentée
    Alert.alert('Tri', 'Fonctionnalité de tri en cours de développement');
  };

  const getActiveFiltersCount = (): number => {
    let count = 0;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.propertyType) count++;
    if (filters.guests) count++;
    if (filters.wifi || filters.parking || filters.pool || filters.airConditioning) count++;
    return count;
  };

  const renderPropertyCard = ({ item }: { item: Property }) => (
    <PropertyCard 
      property={item} 
      onPress={handlePropertyPress} 
      variant="list"
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header avec bouton retour */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rechercher</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={24} color="#2E7D32" />
          {getActiveFiltersCount() > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Barre de recherche avec autocomplétion */}
      <AutoCompleteSearch
        placeholder="Rechercher par ville..."
        onSearch={handleSearch}
        onSuggestionSelect={handleSuggestionSelect}
        initialValue={searchQuery}
      />

      {/* Sélecteur de dates et voyageurs */}
      <DateGuestsSelector
        checkIn={checkIn}
        checkOut={checkOut}
        adults={adults}
        children={children}
        babies={babies}
        onDateGuestsChange={handleDateGuestsChange}
      />

      {/* Bouton de recherche */}
      <SearchButton
        onPress={handleSearchButtonPress}
        disabled={!searchQuery.trim()}
        loading={isSearching}
      />

      {/* Filtres rapides */}
      <QuickFilters
        filters={quickFilters}
        onFilterToggle={handleQuickFilterToggle}
      />

      {/* Résultats */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Erreur: {error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchProperties({ ...filters, city: searchQuery })}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <SearchResultsHeader
            resultsCount={properties.length}
            onSortPress={handleSortChange}
            currentSort={sortBy}
            onViewToggle={() => {}}
            isGridView={false}
          />
          
          {properties.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search" size={64} color="#ccc" />
              <Text style={styles.noResultsTitle}>
                {searchQuery ? `Aucun hébergement trouvé à ${searchQuery}` : 'Aucun résultat trouvé'}
              </Text>
              <Text style={styles.noResultsSubtitle}>
                {searchQuery ? 
                  `Essayez une autre ville ou ajustez vos filtres.` : 
                  'Commencez par rechercher une ville ou un quartier.'
                }
              </Text>
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Villes disponibles :</Text>
                <Text style={styles.suggestionsText}>Cocody, Grand-Bassam, Divo, Anyama, Agboville...</Text>
              </View>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setFilters({});
                  setSearchQuery('');
                  fetchProperties({});
                }}
              >
                <Text style={styles.clearFiltersButtonText}>Effacer les filtres</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={properties}
              renderItem={renderPropertyCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.propertiesList}
            />
          )}
        </View>
      )}

      <FiltersModal
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
    backgroundColor: '#f8f9fa',
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
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
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
  },
});

export default SearchScreen;