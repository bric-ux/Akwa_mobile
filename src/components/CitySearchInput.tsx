import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
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
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  
  const { cities, loading: citiesLoading } = useCities();
  const { neighborhoods, loading: neighborhoodsLoading } = useNeighborhoods();

  // Synchroniser searchTerm avec la valeur externe - version simplifiée
  useEffect(() => {
    console.log('🔄 Synchronisation - Valeur externe:', value, 'Valeur interne:', searchTerm);
    if (value !== searchTerm) {
      console.log('🔄 Mise à jour searchTerm de', searchTerm, 'vers', value);
      setSearchTerm(value);
      
      // Si une valeur est fournie, essayer de trouver le résultat correspondant
      if (value && value.trim()) {
        // Chercher dans les villes
        const cityMatch = cities.find(city => city.name === value);
        if (cityMatch) {
          console.log('🏙️ Correspondance ville trouvée:', cityMatch);
          setSelectedResult({
            id: cityMatch.id,
            name: cityMatch.name,
            type: 'city'
          });
          return;
        }
        
        // Chercher dans les quartiers
        const neighborhoodMatch = neighborhoods.find(neighborhood => neighborhood.name === value);
        if (neighborhoodMatch) {
          console.log('🏠 Correspondance quartier trouvée:', neighborhoodMatch);
          setSelectedResult({
            id: neighborhoodMatch.id,
            name: neighborhoodMatch.name,
            type: neighborhoodMatch.type === 'commune' ? 'commune' : 'neighborhood',
            commune: neighborhoodMatch.type === 'commune' ? neighborhoodMatch.name : undefined,
            city_id: neighborhoodMatch.parent_id
          });
          return;
        }
        
        // Si pas de correspondance exacte, créer un résultat générique
        console.log('❓ Aucune correspondance exacte, création générique pour:', value);
        setSelectedResult({
          id: `generic-${value}`,
          name: value,
          type: 'city',
          region: 'Non spécifiée'
        });
      } else {
        console.log('🗑️ Valeur vide, suppression de la sélection');
        setSelectedResult(null);
      }
    }
  }, [value, cities, neighborhoods]);

  // Effet pour forcer la mise à jour du champ de texte
  useEffect(() => {
    console.log('🔄 Effet de mise à jour forcée - value:', value, 'searchTerm:', searchTerm);
    if (value && value !== searchTerm) {
      console.log('🔄 Forçage de la mise à jour de searchTerm');
      setSearchTerm(value);
    }
  }, [value]);

  // Filtrer les villes et quartiers basé sur le terme de recherche
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredResults([]);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const results: SearchResult[] = [];

    // Filtrer les villes
    const filteredCities = cities.filter(city => 
      city.name.toLowerCase().includes(searchLower)
    ).map(city => ({
      id: city.id,
      name: city.name,
      type: 'city' as const
    }));

    // Filtrer les quartiers et communes
    const filteredNeighborhoods = neighborhoods.filter(neighborhood => 
      neighborhood.name.toLowerCase().includes(searchLower)
    ).map(neighborhood => ({
      id: neighborhood.id,
      name: neighborhood.name,
      type: (neighborhood.type === 'commune' ? 'commune' : 'neighborhood') as const,
      commune: neighborhood.type === 'commune' ? neighborhood.name : undefined,
      city_id: neighborhood.parent_id
    }));

    // Créer des résultats uniques pour les communes
    const communeResults = neighborhoods
      .filter(neighborhood => 
        neighborhood.type === 'commune' && 
        neighborhood.name.toLowerCase().includes(searchLower)
      )
      .map(neighborhood => ({
        id: neighborhood.id,
        name: neighborhood.name,
        type: 'commune' as const,
        commune: neighborhood.name
      }));

    // Combiner et trier les résultats
    results.push(...filteredCities, ...communeResults, ...filteredNeighborhoods);
    
    // Trier par pertinence puis par type puis par nom
    results.sort((a, b) => {
      // Calculer un score de pertinence basé sur la correspondance
      const getRelevanceScore = (item: SearchResult) => {
        const nameLower = item.name.toLowerCase();
        
        if (nameLower === searchLower) return 100;
        if (nameLower.startsWith(searchLower)) return 80;
        if (nameLower.includes(searchLower)) return 60;
        return 20;
      };
      
      const scoreA = getRelevanceScore(a);
      const scoreB = getRelevanceScore(b);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Score décroissant
      }
      
      // Si même score, trier par type (communes d'abord, puis quartiers, puis villes)
      if (a.type !== b.type) {
        const typeOrder = { commune: 0, neighborhood: 1, city: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      }
      
      // Enfin par nom alphabétique
      return a.name.localeCompare(b.name);
    });

    // Limiter à 15 résultats pour les performances
    setFilteredResults(results.slice(0, 15));
  }, [searchTerm, cities, neighborhoods]);

  // Gérer la sélection d'un résultat (ville ou quartier) - Version robuste
  const handleResultSelect = (result: SearchResult) => {
    console.log('🔍 === DÉBUT SÉLECTION ROBUSTE ===');
    console.log('🔍 Résultat sélectionné:', result);
    console.log('🔍 Nom du résultat:', result.name);
    console.log('🔍 Type du résultat:', result.type);
    
    // Fermer le dropdown immédiatement
    setIsOpen(false);
    
    // Mettre à jour l'état local avec un délai pour forcer le re-render
    setTimeout(() => {
      console.log('🔍 Mise à jour différée des états locaux');
      setSelectedResult(result);
      setSearchTerm(result.name);
      
      console.log('🔍 États locaux mis à jour:');
      console.log('🔍 - selectedResult:', result);
      console.log('🔍 - searchTerm:', result.name);
      
      // Notifier le composant parent
      console.log('🔍 Notification du parent avec:', result);
      onChange(result);
      
      console.log('🔍 === FIN SÉLECTION ROBUSTE ===');
    }, 0);
  };

  // Gérer la suppression de la sélection
  const handleClear = () => {
    console.log('🗑️ Effacement de la sélection');
    setSelectedResult(null);
    setSearchTerm('');
    setIsOpen(false);
    onChange(null);
  };

  // Gérer le changement de texte dans l'input
  const handleTextChange = (text: string) => {
    console.log('📝 === CHANGEMENT DE TEXTE ===');
    console.log('📝 Nouveau texte:', text);
    console.log('📝 Ancien texte:', searchTerm);
    console.log('📝 Résultat sélectionné actuel:', selectedResult?.name);
    
    setSearchTerm(text);
    setIsOpen(true);
    
    // Si le texte est effacé, effacer aussi la sélection
    if (!text.trim()) {
      console.log('📝 Texte effacé, suppression de la sélection');
      setSelectedResult(null);
      onChange(null);
    } else {
      // Si le texte change et qu'il y a une sélection, la réinitialiser
      if (selectedResult && selectedResult.name !== text) {
        console.log('📝 Texte modifié manuellement, réinitialisation de la sélection');
        console.log('📝 Ancienne sélection:', selectedResult.name);
        console.log('📝 Nouveau texte:', text);
        setSelectedResult(null);
      }
    }
    
    console.log('📝 === FIN CHANGEMENT DE TEXTE ===');
  };

  // Gérer le focus de l'input
  const handleFocus = () => {
    console.log('🎯 Focus sur l\'input');
    setIsOpen(true);
  };

  // Gérer la fermeture du dropdown
  const handleCloseDropdown = () => {
    console.log('❌ Fermeture du dropdown');
    setIsOpen(false);
  };


  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="location" size={32} color="#9ca3af" />
      <Text style={styles.emptyStateTitle}>
        {searchTerm.trim() ? 'Aucun résultat trouvé' : 'Commencez à taper pour rechercher'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchTerm.trim() 
          ? `Essayez avec un autre terme que "${searchTerm}"` 
          : 'Villes et quartiers d\'Abidjan disponibles'
        }
      </Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color="#e67e22" />
      <Text style={styles.loadingText}>Recherche en cours...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Input de recherche */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="location" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={[styles.input, disabled && styles.inputDisabled]}
            value={searchTerm}
            onChangeText={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleCloseDropdown}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            editable={!disabled}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Dropdown des résultats */}
      {isOpen && (
        <View style={styles.dropdown}>
          {citiesLoading || neighborhoodsLoading ? (
            renderLoadingState()
          ) : filteredResults.length > 0 ? (
            <FlatList
              data={filteredResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleResultSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultContent}>
                    <View style={styles.resultIcon}>
                      {item.type === 'city' ? (
                        <Ionicons name="location" size={20} color="#3b82f6" />
                      ) : item.type === 'commune' ? (
                        <Ionicons name="business" size={20} color="#8b5cf6" />
                      ) : (
                        <Ionicons name="home" size={20} color="#10b981" />
                      )}
                    </View>
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
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            renderEmptyState()
          )}
        </View>
      )}

      {/* Affichage du résultat sélectionné */}
      {selectedResult && (
        <View style={styles.selectedResult}>
          <View style={styles.selectedResultContent}>
            {selectedResult.type === 'city' ? (
              <Ionicons name="location" size={16} color="#3b82f6" />
            ) : selectedResult.type === 'commune' ? (
              <Ionicons name="business" size={16} color="#8b5cf6" />
            ) : (
              <Ionicons name="home" size={16} color="#10b981" />
            )}
            <Text style={styles.selectedResultText}>
              Sélectionné: <Text style={styles.selectedResultName}>{selectedResult.name}</Text> - {
                selectedResult.type === 'city' 
                  ? 'Côte d\'Ivoire'
                  : selectedResult.type === 'commune'
                  ? 'Commune'
                  : selectedResult.commune ? `${selectedResult.commune} - Abidjan` : 'Quartier'
              }
            </Text>
          </View>
          <View style={[
            styles.selectedResultType,
            selectedResult.type === 'city' ? styles.selectedResultTypeCity : 
            selectedResult.type === 'commune' ? styles.selectedResultTypeCommune : 
            styles.selectedResultTypeNeighborhood
          ]}>
            <Text style={[
              styles.selectedResultTypeText,
              selectedResult.type === 'city' ? styles.selectedResultTypeTextCity : 
              selectedResult.type === 'commune' ? styles.selectedResultTypeTextCommune : 
              styles.selectedResultTypeTextNeighborhood
            ]}>
              {selectedResult.type === 'city' ? 'Ville' : 
               selectedResult.type === 'commune' ? 'Commune' : 'Quartier'}
            </Text>
          </View>
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
    marginBottom: 8,
  },
  inputWrapper: {
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
  dropdown: {
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
  resultIcon: {
    marginRight: 12,
  },
  resultText: {
    flex: 1,
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
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  loadingState: {
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
  selectedResult: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedResultText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  selectedResultName: {
    fontWeight: '600',
    color: '#1f2937',
  },
  selectedResultType: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedResultTypeCity: {
    backgroundColor: '#dbeafe',
  },
  selectedResultTypeCommune: {
    backgroundColor: '#e9d5ff',
  },
  selectedResultTypeNeighborhood: {
    backgroundColor: '#d1fae5',
  },
  selectedResultTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedResultTypeTextCity: {
    color: '#1e40af',
  },
  selectedResultTypeTextCommune: {
    color: '#7c3aed',
  },
  selectedResultTypeTextNeighborhood: {
    color: '#065f46',
  },
});

export default CitySearchInput;
