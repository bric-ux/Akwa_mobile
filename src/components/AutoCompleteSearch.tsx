import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'city' | 'neighborhood' | 'property' | 'recent';
  icon: string;
  subtitle?: string;
}

interface AutoCompleteSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  initialValue?: string;
}

const AutoCompleteSearch: React.FC<AutoCompleteSearchProps> = ({
  placeholder = "Rechercher ville ou quartier...",
  onSearch,
  onSuggestionSelect,
  initialValue = '',
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuggestionSelected, setIsSuggestionSelected] = useState(false);
  const isProcessingRef = useRef(false);
  const lastProcessedId = useRef<string | null>(null);

  // Charger les recherches récentes
  useEffect(() => {
    // Simuler le chargement des recherches récentes depuis le stockage local
    setRecentSearches(['Abidjan', 'Yamoussoukro', 'Grand-Bassam', 'San-Pédro']);
  }, []);

  // Recherche d'autocomplétion
  useEffect(() => {
    if (query.length > 1 && !isSuggestionSelected) {
      searchSuggestions(query);
    } else if (query.length <= 1) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, isSuggestionSelected]);

  const searchSuggestions = async (searchQuery: string) => {
    setLoading(true);
    try {
      const suggestions: SearchSuggestion[] = [];

      // Recherches récentes qui correspondent
      recentSearches.forEach((search, index) => {
        if (search.toLowerCase().includes(searchQuery.toLowerCase())) {
          suggestions.push({
            id: `recent_${index}`,
            text: search,
            type: 'recent',
            icon: 'time-outline',
            subtitle: 'Recherche récente',
          });
        }
      });

      // Recherche dans les villes de la base de données
      const { data: cities, error } = await supabase
        .from('cities')
        .select('id, name, region')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!error && cities) {
        cities.forEach((city) => {
          suggestions.push({
            id: `city_${city.id}`,
            text: city.name,
            type: 'city',
            icon: 'location-outline',
            subtitle: `${city.region} • Ville`,
          });
        });
      }

      // Recherche dans les quartiers
      const { data: neighborhoods, error: neighborhoodsError } = await supabase
        .from('neighborhoods')
        .select('id, name, commune')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!neighborhoodsError && neighborhoods) {
        neighborhoods.forEach((neighborhood) => {
          suggestions.push({
            id: `neighborhood_${neighborhood.id}`,
            text: neighborhood.name,
            type: 'neighborhood',
            icon: 'home-outline',
            subtitle: `${neighborhood.commune} • Quartier`,
          });
        });
      }

      // Recherche dans les propriétés
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, city')
        .or(`title.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`)
        .limit(3);

      if (!propertiesError && properties) {
        properties.forEach((property) => {
          suggestions.push({
            id: `property_${property.id}`,
            text: property.title,
            type: 'property',
            icon: 'home-outline',
            subtitle: property.city || 'Propriété',
          });
        });
      }

      setSuggestions(suggestions.slice(0, 8));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: SearchSuggestion) => {
    // Protection par ID unique avec délai immédiat
    if (lastProcessedId.current === suggestion.id) {
      console.log('🚫 Clic dupliqué bloqué pour ID:', suggestion.id);
      return;
    }
    
    console.log('✅ Traitement du clic pour:', suggestion.text, 'ID:', suggestion.id);
    lastProcessedId.current = suggestion.id;
    
    // Marquer qu'une suggestion a été sélectionnée
    setIsSuggestionSelected(true);
    
    // Actions immédiates
    setQuery(suggestion.text);
    setShowSuggestions(false);
    setSuggestions([]); // Vider les suggestions immédiatement
    
    // Ajouter à l'historique
    if (!recentSearches.includes(suggestion.text)) {
      setRecentSearches(prev => [suggestion.text, ...prev.slice(0, 4)]);
    }
    
    // Lancer la recherche immédiatement
    onSearch?.(suggestion.text);
    
    // Callback pour notifier la sélection
    onSuggestionSelect?.(suggestion);
    
    // Réinitialiser après un délai
    setTimeout(() => {
      lastProcessedId.current = null;
      console.log('🔄 ID réinitialisé');
    }, 1000);
  };

  const handleSearch = () => {
    if (query.trim()) {
      setShowSuggestions(false);
      onSearch(query.trim());
    }
  };

  const clearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    setIsSuggestionSelected(false);
    onSearch('');
  };

  const renderSuggestion = ({ item }: { item: SearchSuggestion }) => {
    const handlePress = () => {
      console.log('🖱️ Clic détecté sur:', item.text, 'ID:', item.id);
      handleSuggestionPress(item);
    };

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.suggestionItem}
        onPress={handlePress}
        activeOpacity={0.7}
      >
      <Ionicons 
        name={item.icon as any} 
        size={20} 
        color={
          item.type === 'recent' ? '#666' : 
          item.type === 'city' ? '#007bff' : 
          item.type === 'neighborhood' ? '#28a745' : 
          '#e67e22'
        } 
        style={styles.suggestionIcon}
      />
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionText}>{item.text}</Text>
        {item.subtitle && (
          <Text style={styles.suggestionSubtitle}>{item.subtitle}</Text>
        )}
      </View>
      {item.type === 'recent' && (
        <TouchableOpacity
          onPress={() => {
            const newRecentSearches = recentSearches.filter(s => s !== item.text);
            setRecentSearches(newRecentSearches);
          }}
        >
          <Ionicons name="close" size={16} color="#ccc" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            // Réinitialiser l'état de sélection quand l'utilisateur tape
            setIsSuggestionSelected(false);
          }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          onFocus={() => {
            setIsSuggestionSelected(false);
            if (query.length > 1) {
              setShowSuggestions(true);
            }
          }}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>...</Text>
          </View>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  loadingContainer: {
    padding: 5,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: 300,
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  suggestionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default AutoCompleteSearch;
