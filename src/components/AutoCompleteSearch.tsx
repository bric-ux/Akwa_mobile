import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'city' | 'neighborhood' | 'commune' | 'property' | 'recent';
  icon: string;
  subtitle?: string;
  latitude?: number;
  longitude?: number;
}

interface AutoCompleteSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  initialValue?: string;
  /** N'affiche les suggestions qu'après focus sur le champ (ex. réouverture modale) */
  requireFocusForSuggestions?: boolean;
  /** Liste en flux normal (pousse le contenu en dessous) au lieu d'un overlay */
  inlineSuggestions?: boolean;
  /** Marges intégrées dans une carte parente */
  embedded?: boolean;
}

export interface AutoCompleteSearchHandle {
  getQuery: () => string;
  blur: () => void;
}

const AutoCompleteSearch = forwardRef<AutoCompleteSearchHandle, AutoCompleteSearchProps>(({
  placeholder = "Où allez-vous ?",
  onSearch,
  onSuggestionSelect,
  initialValue = '',
  requireFocusForSuggestions = false,
  inlineSuggestions = false,
  embedded = false,
}, ref) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuggestionSelected, setIsSuggestionSelected] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isProcessingRef = useRef(false);
  const lastProcessedId = useRef<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const lastSyncedInitialValue = useRef(initialValue);

  useImperativeHandle(ref, () => ({
    getQuery: () => query,
    blur: () => textInputRef.current?.blur(),
  }));

  // Charger les recherches récentes
  useEffect(() => {
    // Simuler le chargement des recherches récentes depuis le stockage local
    setRecentSearches(['Abidjan', 'Yamoussoukro', 'Grand-Bassam', 'San-Pédro']);
  }, []);

  // Synchroniser uniquement quand le parent change initialValue (pas pendant la frappe locale)
  useEffect(() => {
    if (initialValue === lastSyncedInitialValue.current) return;
    lastSyncedInitialValue.current = initialValue;
    setQuery(initialValue);
    if (initialValue === '') {
      setIsSuggestionSelected(false);
      setShowSuggestions(false);
    } else if (requireFocusForSuggestions) {
      setIsSuggestionSelected(true);
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [initialValue, requireFocusForSuggestions]);

  // Recherche d'autocomplétion
  useEffect(() => {
    if (requireFocusForSuggestions && !isInputFocused) {
      return;
    }
    if (query.length > 0 && !isSuggestionSelected) {
      searchSuggestions(query);
    } else if (query.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query, isSuggestionSelected, isInputFocused, requireFocusForSuggestions]);

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
        .from('locations')
        .select('id, name, type, latitude, longitude')
        .eq('type', 'city')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!error && cities) {
        cities.forEach((city) => {
          suggestions.push({
            id: `city_${city.id}`,
            text: city.name,
            type: 'city',
            icon: 'location-outline',
            subtitle: 'Ville',
            latitude: city.latitude,
            longitude: city.longitude,
          });
        });
      }

      // Recherche dans les communes
      const { data: communes, error: communesError } = await supabase
        .from('locations')
        .select('id, name, type, latitude, longitude')
        .eq('type', 'commune')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!communesError && communes) {
        communes.forEach((commune) => {
          suggestions.push({
            id: `commune_${commune.id}`,
            text: commune.name,
            type: 'commune',
            icon: 'location-outline',
            subtitle: 'Commune',
            latitude: commune.latitude,
            longitude: commune.longitude,
          });
        });
      }

      // Recherche dans les quartiers
      const { data: neighborhoods, error: neighborhoodsError } = await supabase
        .from('locations')
        .select('id, name, type, parent_id, latitude, longitude')
        .eq('type', 'neighborhood')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      if (!neighborhoodsError && neighborhoods) {
        // Récupérer les noms des communes parentes pour l'affichage
        const parentIds = neighborhoods.map(n => n.parent_id).filter(Boolean);
        let parentNames: { [key: string]: string } = {};
        
        if (parentIds.length > 0) {
          const { data: parents } = await supabase
            .from('locations')
            .select('id, name')
            .in('id', parentIds);
          
          if (parents) {
            parentNames = parents.reduce((acc, p) => {
              acc[p.id] = p.name;
              return acc;
            }, {} as { [key: string]: string });
          }
        }
        
        neighborhoods.forEach((neighborhood) => {
          const communeName = neighborhood.parent_id ? parentNames[neighborhood.parent_id] : '';
          suggestions.push({
            id: `neighborhood_${neighborhood.id}`,
            text: neighborhood.name,
            type: 'neighborhood',
            icon: 'home-outline',
            subtitle: communeName ? `${communeName} • Quartier` : 'Quartier',
            latitude: neighborhood.latitude,
            longitude: neighborhood.longitude,
          });
        });
      }

      // Recherche dans les propriétés
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, locations:location_id(name)')
        .or(`title.ilike.%${searchQuery}%`)
        .limit(3);

      if (!propertiesError && properties) {
        properties.forEach((property) => {
          suggestions.push({
            id: `property_${property.id}`,
            text: property.title,
            type: 'property',
            icon: 'home-outline',
            subtitle: property.locations?.name || 'Propriété',
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
    
    // Marquer qu'une suggestion a été sélectionnée AVANT de modifier le query
    setIsSuggestionSelected(true);
    
    // Actions immédiates et définitives
    setQuery(suggestion.text);
    setShowSuggestions(false);
    setSuggestions([]); // Vider les suggestions immédiatement
    
    // Ajouter à l'historique
    if (!recentSearches.includes(suggestion.text)) {
      setRecentSearches(prev => [suggestion.text, ...prev.slice(0, 4)]);
    }
    
    // Fermer le clavier
    textInputRef.current?.blur();
    
    // Lancer la recherche immédiatement
    onSearch?.(suggestion.text);
    
    // Callback pour notifier la sélection (le parent va mettre à jour initialValue)
    onSuggestionSelect?.(suggestion);
    
    // NE PAS réinitialiser isSuggestionSelected pour éviter les re-déclenchements
    // Garder les suggestions fermées définitivement
    setTimeout(() => {
      lastProcessedId.current = null;
      console.log('🔄 ID réinitialisé, suggestions fermées définitivement');
    }, 1000);
  };

  const handleSearch = () => {
    if (query.trim()) {
      setShowSuggestions(false);
      // Fermer le clavier
      textInputRef.current?.blur();
      onSearch(query.trim());
    }
  };

  const clearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    setIsSuggestionSelected(false);
    // Fermer le clavier
    textInputRef.current?.blur();
    onSearch('');
  };

  const renderSuggestion = (item: SearchSuggestion) => {
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
      <View style={[styles.searchContainer, embedded && styles.searchContainerEmbedded]}>
        <Ionicons name="location" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          ref={textInputRef}
          style={styles.input}
          placeholder={placeholder}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            // Réinitialiser l'état de sélection quand l'utilisateur tape
            setIsSuggestionSelected(false);
            // Si l'utilisateur efface tout, fermer les suggestions
            if (text.length === 0) {
              setShowSuggestions(false);
              setSuggestions([]);
            }
          }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          onFocus={() => {
            setIsInputFocused(true);
            if (requireFocusForSuggestions && query.length > 0) {
              setIsSuggestionSelected(false);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsInputFocused(false);
              setShowSuggestions(false);
            }, 180);
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
        <View
          style={[
            inlineSuggestions ? styles.suggestionsContainerInline : styles.suggestionsContainer,
            embedded && (inlineSuggestions ? styles.suggestionsInlineEmbedded : styles.suggestionsOverlayEmbedded),
          ]}
        >
          <View style={styles.suggestionsList}>
            {suggestions.map((item) => renderSuggestion(item))}
          </View>
        </View>
      )}
    </View>
  );
});

AutoCompleteSearch.displayName = 'AutoCompleteSearch';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  searchContainerEmbedded: {
    marginHorizontal: 0,
    marginVertical: 0,
    shadowOpacity: 0,
    elevation: 0,
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
    maxHeight: 220,
    zIndex: 1000,
  },
  suggestionsContainerInline: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 220,
    marginTop: 6,
    marginBottom: 4,
  },
  suggestionsOverlayEmbedded: {
    left: 0,
    right: 0,
  },
  suggestionsInlineEmbedded: {
    marginHorizontal: 0,
  },
  suggestionsList: {
    maxHeight: 220,
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
