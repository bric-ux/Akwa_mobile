import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocationSearch, LocationResult } from '../hooks/useLocationSearch';

interface LocationSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onLocationSelect: (location: LocationResult) => void;
  placeholder?: string;
  style?: any;
}

const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  value,
  onChangeText,
  onLocationSelect,
  placeholder = 'Où allez-vous ?',
  style,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const { searchLocations, getPopularLocations } = useLocationSearch();

  // Gestion du clavier
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Charger les villes populaires au montage
  useEffect(() => {
    loadPopularLocations();
  }, []);

  // Rechercher quand la requête change
  useEffect(() => {
    // Annuler le timeout précédent
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.length >= 2) {
      // Délai de 300ms pour éviter trop de requêtes
      const timeout = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
      setSearchTimeout(timeout);
    } else if (searchQuery.length === 0) {
      loadPopularLocations();
    } else {
      setSearchResults([]);
    }

    // Cleanup function
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);

  const loadPopularLocations = async () => {
    try {
      console.log('📋 Chargement des villes populaires...');
      const locations = await getPopularLocations();
      console.log('✅ Villes populaires chargées:', locations.length);
      setSearchResults(locations);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des villes:', error);
      setSearchResults([]);
    }
  };

  const performSearch = async (query: string) => {
    console.log('🔍 Recherche pour:', query);
    setIsSearching(true);
    try {
      const results = await searchLocations(query);
      console.log('✅ Résultats trouvés:', results.length);
      setSearchResults(results);
    } catch (error) {
      console.error('❌ Erreur lors de la recherche:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location: LocationResult) => {
    console.log('🎯 Sélection popup:', location.name);
    onChangeText(location.name);
    onLocationSelect(location);
    setShowModal(false);
    setSearchQuery('');
  };

  const openModal = () => {
    console.log('🔍 Ouverture du modal');
    setShowModal(true);
    setSearchQuery('');
    setSearchResults([]); // Réinitialiser les résultats
    setIsSearching(false); // Réinitialiser l'état de recherche
    loadPopularLocations();
  };

  const closeModal = () => {
    console.log('❌ Fermeture du modal');
    setShowModal(false);
    setSearchQuery('');
    setSearchResults([]); // Nettoyer les résultats
    setIsSearching(false); // Nettoyer l'état de recherche
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Ionicons name="location" size={20} color="#666" style={styles.searchIcon} />
        <Text style={[styles.input, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>

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
          <View style={[
            styles.modalContent,
            isKeyboardVisible && styles.modalContentKeyboardVisible
          ]}>
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
              {isSearching && (
                <ActivityIndicator size="small" color="#007bff" />
              )}
            </View>

            {/* Results */}
            <View style={styles.resultsContainer}>
              {searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.resultItem}
                      onPress={() => handleLocationSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultContent}>
                        <Ionicons
                          name={item.type === 'city' ? 'location' : 'home'}
                          size={20}
                          color={item.type === 'city' ? '#007bff' : '#28a745'}
                        />
                        <View style={styles.resultText}>
                          <Text style={styles.resultName}>{item.name}</Text>
                          {item.type === 'city' && item.region && (
                            <Text style={styles.resultSubtitle}>
                              {item.region} • Ville
                            </Text>
                          )}
                          {item.type === 'neighborhood' && item.commune && (
                            <Text style={styles.resultSubtitle}>
                              {item.commune} • Quartier
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.resultsList}
                  keyboardShouldPersistTaps="handled"
                />
              ) : searchQuery.length >= 2 ? (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="search" size={48} color="#ccc" />
                  <Text style={styles.noResultsText}>
                    Aucun résultat trouvé pour "{searchQuery}"
                  </Text>
                </View>
              ) : (
                <View style={styles.noResultsContainer}>
                  <Ionicons name="location" size={48} color="#ccc" />
                  <Text style={styles.noResultsText}>
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
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  placeholder: {
    color: '#999',
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
  modalContentKeyboardVisible: {
    maxHeight: '70%',
    minHeight: '50%',
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
  resultsList: {
    flex: 1,
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
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
});

export default LocationSearchInput;