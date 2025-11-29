import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
  visible?: boolean;
  onClose?: () => void;
  onSelect?: (result: SearchResult) => void;
}

const CitySearchInputModal: React.FC<CitySearchInputProps> = ({
  value = '',
  onChange,
  placeholder = 'Où allez-vous ?',
  disabled = false,
  visible: externalVisible,
  onClose,
  onSelect
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showModal, setShowModal] = useState(externalVisible || false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const { cities, loading: citiesLoading } = useCities();
  const { neighborhoods, loading: neighborhoodsLoading } = useNeighborhoods();

  // Détecter la visibilité du clavier
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      console.log('⌨️ Clavier ouvert');
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      console.log('⌨️ Clavier fermé');
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Synchroniser avec la valeur externe
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Synchroniser avec visible externe
  useEffect(() => {
    if (externalVisible !== undefined) {
      setShowModal(externalVisible);
    }
  }, [externalVisible]);

  // Recherche et filtrage
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchTerm = searchQuery.toLowerCase();
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

    // Trier les résultats
    filteredResults.sort((a, b) => {
      const typeOrder = { commune: 0, neighborhood: 1, city: 2 };
      if (a.type !== b.type) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return a.name.localeCompare(b.name);
    });

    // Filtrer les doublons par ID avant de limiter les résultats
    const uniqueResults = Array.from(
      new Map(filteredResults.map(item => [item.id, item])).values()
    );
    
    const finalResults = uniqueResults.slice(0, 15);
    console.log('🔍 Résultats filtrés:', finalResults.length);
    console.log('🔍 Premiers résultats:', finalResults.slice(0, 3).map(r => r.name));
    setResults(finalResults);
  }, [searchQuery, cities, neighborhoods]);

  // Ouvrir le modal
  const openModal = () => {
    console.log('🚀 OUVERTURE MODAL - isSelecting:', isSelecting);
    if (!isSelecting) {
      console.log('🚀 Ouverture du modal autorisée');
      setShowModal(true);
      setSearchQuery(inputValue);
    } else {
      console.log('🚀 Ouverture du modal bloquée car sélection en cours');
    }
  };

  // Fermer le modal
  const closeModal = () => {
    console.log('❌ FERMETURE MODAL');
    setShowModal(false);
    setSearchQuery('');
    if (onClose) {
      onClose();
    }
  };

  // Gérer la sélection
  const handleSelect = (result: SearchResult) => {
    console.log('✅ === SÉLECTION MODAL ===');
    console.log('✅ Résultat sélectionné:', result);
    console.log('✅ Nom:', result.name);
    console.log('✅ Clavier visible:', isKeyboardVisible);
    
    // Fermer le clavier d'abord
    if (isKeyboardVisible) {
      console.log('⌨️ Fermeture du clavier avant sélection');
      Keyboard.dismiss();
    }
    
    // Marquer qu'on est en train de sélectionner
    setIsSelecting(true);
    
    // Mettre à jour l'input
    setInputValue(result.name);
    
    // Fermer le modal
    setShowModal(false);
    
    // Notifier le parent
    onChange(result);
    if (onSelect) {
      onSelect(result);
    }
    
    // Réinitialiser l'état de sélection après un délai
    setTimeout(() => {
      setIsSelecting(false);
    }, 500);
    
    console.log('✅ === FIN SÉLECTION MODAL ===');
  };

  // Gérer le changement de texte dans l'input principal (maintenant non-éditable)
  const handleTextChange = (text: string) => {
    console.log('📝 CHANGEMENT TEXTE PRINCIPAL (non-éditable):', text);
    // Le champ n'est plus éditable, cette fonction ne devrait plus être appelée
  };

  // Effacer
  const handleClear = () => {
    console.log('🗑️ EFFACER');
    setInputValue('');
    setShowModal(false);
    onChange(null);
  };

  // Si visible est false et qu'on utilise le mode modal uniquement, ne rien afficher
  if (externalVisible === false && !value) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Input principal - seulement si on n'utilise pas le mode modal uniquement */}
      {externalVisible === undefined && (
        <TouchableOpacity 
          style={styles.inputContainer}
          onPress={openModal}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Ionicons name="location" size={20} color="#9ca3af" style={styles.searchIcon} />
          <Text style={[styles.inputText, !inputValue && styles.placeholderText]}>
            {inputValue || placeholder}
          </Text>
          {inputValue.length > 0 ? (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                handleClear();
              }} 
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={20} color="#9ca3af" />
          )}
        </TouchableOpacity>
      )}

      {/* Modal de recherche */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rechercher une localisation</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="location" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tapez pour rechercher..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                placeholderTextColor="#999"
              />
              {citiesLoading || neighborhoodsLoading ? (
                <ActivityIndicator size="small" color="#007bff" />
              ) : null}
            </View>

            {/* Results */}
            <View style={styles.resultsContainer}>
              {results.length > 0 ? (
                <FlatList
                  data={results}
                  keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `result-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.resultItem}
                      onPress={() => handleSelect(item)}
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
                  )}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                />
              ) : searchQuery.length >= 2 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    Aucun résultat trouvé pour "{searchQuery}"
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="location" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    Tapez pour rechercher une ville ou un quartier
                  </Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#9ca3af',
  },
  clearButton: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    margin: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: {
    marginLeft: 12,
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
});

export default CitySearchInputModal;
