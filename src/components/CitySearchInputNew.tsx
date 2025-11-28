import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCities } from '../hooks/useCities';
import { useNeighborhoods } from '../hooks/useNeighborhoods';

interface SearchResult {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'commune';
  region?: string;
  commune?: string;
  city_id?: string;
}

interface CitySearchInputProps {
  value?: string;
  onChange: (result: SearchResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const CitySearchInput: React.FC<CitySearchInputProps> = ({
  value = '',
  onChange,
  placeholder = 'Où allez-vous ?',
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  
  const { cities, loading: citiesLoading } = useCities();
  const { neighborhoods, loading: neighborhoodsLoading } = useNeighborhoods();

  // Synchroniser avec la valeur externe
  useEffect(() => {
    console.log('🔄 Sync: value externe =', value, 'inputValue interne =', inputValue);
    if (value !== inputValue) {
      console.log('🔄 Mise à jour inputValue vers:', value);
      setInputValue(value);
    }
  }, [value]);

  // Recherche et filtrage
  useEffect(() => {
    if (!inputValue.trim() || inputValue.length < 2) {
      setResults([]);
      return;
    }

    const searchTerm = inputValue.toLowerCase();
    const filteredResults: SearchResult[] = [];

    // Rechercher dans les villes
    cities.forEach(city => {
      if (city.name.toLowerCase().includes(searchTerm)) {
        filteredResults.push({
          id: city.id,
          name: city.name,
          type: 'city'
        });
      }
    });

    // Rechercher dans les quartiers et communes
    neighborhoods.forEach(neighborhood => {
      if (neighborhood.name.toLowerCase().includes(searchTerm)) {
        filteredResults.push({
          id: neighborhood.id,
          name: neighborhood.name,
          type: neighborhood.type === 'commune' ? 'commune' : 'neighborhood',
          commune: neighborhood.type === 'commune' ? neighborhood.name : undefined,
          city_id: neighborhood.parent_id
        });
      }
    });

    // Créer des communes uniques
    const communes = neighborhoods
      .filter(n => n.type === 'commune' && n.name.toLowerCase().includes(searchTerm))
      .map(neighborhood => ({
        id: neighborhood.id,
        name: neighborhood.name,
        type: 'commune' as const,
        commune: neighborhood.name
      }));

    filteredResults.push(...communes);

    // Trier les résultats
    filteredResults.sort((a, b) => {
      const typeOrder = { commune: 0, neighborhood: 1, city: 2 };
      if (a.type !== b.type) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return a.name.localeCompare(b.name);
    });

    const finalResults = filteredResults.slice(0, 15);
    console.log('🔍 Résultats filtrés:', finalResults.length);
    console.log('🔍 Premiers résultats:', finalResults.slice(0, 3).map(r => r.name));
    setResults(finalResults);
  }, [inputValue, cities, neighborhoods]);

  // Gérer la sélection
  const handleSelect = (result: SearchResult) => {
    console.log('✅ === DÉBUT SÉLECTION ===');
    console.log('✅ Résultat sélectionné:', result);
    console.log('✅ Nom:', result.name);
    console.log('✅ Type:', result.type);
    console.log('✅ ID:', result.id);
    
    // Marquer qu'on est en train de sélectionner
    setIsSelecting(true);
    
    // Mettre à jour l'input
    console.log('✅ Mise à jour inputValue de', inputValue, 'vers', result.name);
    setInputValue(result.name);
    
    // Fermer les résultats
    console.log('✅ Fermeture des résultats');
    setShowResults(false);
    
    // Notifier le parent
    console.log('✅ Notification du parent avec:', result);
    onChange(result);
    
    // Réinitialiser l'état de sélection
    setTimeout(() => {
      setIsSelecting(false);
    }, 100);
    
    console.log('✅ === FIN SÉLECTION ===');
  };

  // Gérer le changement de texte
  const handleTextChange = (text: string) => {
    console.log('📝 CHANGEMENT TEXTE:', text);
    setInputValue(text);
    setShowResults(text.length >= 2);
    
    // Si le texte est effacé, notifier le parent
    if (!text.trim()) {
      onChange(null);
    }
  };

  // Gérer le focus
  const handleFocus = () => {
    console.log('🎯 FOCUS');
    setShowResults(inputValue.length >= 2);
  };

  // Gérer le blur
  const handleBlur = () => {
    console.log('👋 BLUR - isSelecting:', isSelecting);
    if (!isSelecting) {
      // Délai plus long pour permettre le clic sur un résultat
      setTimeout(() => {
        console.log('👋 Fermeture différée des résultats');
        setShowResults(false);
      }, 300);
    } else {
      console.log('👋 Blur ignoré car sélection en cours');
    }
  };

  // Effacer
  const handleClear = () => {
    console.log('🗑️ EFFACER');
    setInputValue('');
    setShowResults(false);
    onChange(null);
  };

  return (
    <View style={styles.container}>
      {/* Input */}
      <View style={styles.inputContainer}>
        <Ionicons name="location" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={inputValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          editable={!disabled}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {inputValue.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Résultats */}
      {showResults && (
        <View style={styles.resultsContainer}>
          {console.log('🎨 RENDU - showResults:', showResults, 'results.length:', results.length)}
          {citiesLoading || neighborhoodsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#e67e22" />
              <Text style={styles.loadingText}>Recherche...</Text>
            </View>
          ) : results.length > 0 ? (
            <ScrollView
              style={styles.resultsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {results.map((item) => {
                console.log('🎨 Rendu élément:', item.name);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.resultItem}
                    onPress={() => {
                      console.log('👆 PRESS sur:', item.name);
                      handleSelect(item);
                    }}
                    onPressIn={() => {
                      console.log('👆 PRESS IN sur:', item.name);
                      handleSelect(item);
                    }}
                    onTouchStart={() => {
                      console.log('👆 TOUCH START sur:', item.name);
                      handleSelect(item);
                    }}
                    activeOpacity={0.7}
                  >
                  <View style={styles.resultContent}>
                    <Ionicons
                      name={item.type === 'city' ? 'location' : item.type === 'commune' ? 'business' : 'home'}
                      size={20}
                      color={item.type === 'city' ? '#3b82f6' : item.type === 'commune' ? '#8b5cf6' : '#10b981'}
                    />
                    <View style={styles.resultText}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      <Text style={styles.resultSubtitle}>
                        {item.type === 'city' 
                          ? 'Côte d\'Ivoire'
                          : item.type === 'commune'
                          ? 'Commune'
                          : item.commune ? `${item.commune} - Abidjan` : 'Quartier'
                        }
                      </Text>
                    </View>
                    <View style={[
                      styles.resultType,
                      item.type === 'city' ? styles.resultTypeCity : 
                      item.type === 'commune' ? styles.resultTypeCommune : 
                      styles.resultTypeNeighborhood
                    ]}>
                      <Text style={[
                        styles.resultTypeText,
                        item.type === 'city' ? styles.resultTypeTextCity : 
                        item.type === 'commune' ? styles.resultTypeTextCommune : 
                        styles.resultTypeTextNeighborhood
                      ]}>
                        {item.type === 'city' ? 'Ville' : 
                         item.type === 'commune' ? 'Commune' : 'Quartier'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucun résultat trouvé</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
  },
  clearButton: {
    marginLeft: 8,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 300,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultsList: {
    maxHeight: 300,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  resultType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultTypeCity: {
    backgroundColor: '#dbeafe',
  },
  resultTypeCommune: {
    backgroundColor: '#e9d5ff',
  },
  resultTypeNeighborhood: {
    backgroundColor: '#d1fae5',
  },
  resultTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  resultTypeTextCity: {
    color: '#1e40af',
  },
  resultTypeTextCommune: {
    color: '#7c3aed',
  },
  resultTypeTextNeighborhood: {
    color: '#065f46',
  },
  loadingContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default CitySearchInput;
