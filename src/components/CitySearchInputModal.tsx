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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCities } from '../hooks/useCities';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import {
  forwardGeocodeNominatim,
  matchLocationNearCoords,
} from '../lib/geolocation';

interface SearchResult {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'commune';
  region?: string;
  commune?: string;
  city_id?: string;
  latitude?: number;
  longitude?: number;
  parent_id?: string;
  /** Suggestion OpenStreetMap (hors table locations) */
  fromMap?: boolean;
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

function normalizeLocationValue(value: string | SearchResult | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'name' in value) return String((value as SearchResult).name);
  return '';
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
  const [inputValue, setInputValue] = useState(() => normalizeLocationValue(value));
  const [showModal, setShowModal] = useState(externalVisible || false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const osmTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
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

  // Synchroniser avec la valeur externe (toujours en string pour éviter de rendre un objet)
  useEffect(() => {
    const next = normalizeLocationValue(value);
    if (next !== inputValue) {
      setInputValue(next);
    }
  }, [value]);

  // Synchroniser avec visible externe
  useEffect(() => {
    if (externalVisible !== undefined) {
      setShowModal(externalVisible);
    }
  }, [externalVisible]);

  // Recherche DB + secours OpenStreetMap
  useEffect(() => {
    if (osmTimeoutRef.current) {
      clearTimeout(osmTimeoutRef.current);
      osmTimeoutRef.current = null;
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setMapLoading(false);
      return;
    }

    const searchTerm = searchQuery.toLowerCase();
    const filteredResults: SearchResult[] = [];

    cities.forEach((city) => {
      if (city.name.toLowerCase().includes(searchTerm)) {
        filteredResults.push({
          id: city.id,
          name: city.name,
          type: 'city',
          latitude: city.latitude,
          longitude: city.longitude,
        });
      }
    });

    neighborhoods.forEach((neighborhood) => {
      if (neighborhood.name.toLowerCase().includes(searchTerm)) {
        filteredResults.push({
          id: neighborhood.id,
          name: neighborhood.name,
          type: neighborhood.type === 'commune' ? 'commune' : 'neighborhood',
          commune: neighborhood.type === 'commune' ? neighborhood.name : undefined,
          city_id: neighborhood.parent_id,
          parent_id: neighborhood.parent_id,
          latitude: neighborhood.latitude,
          longitude: neighborhood.longitude,
        });
      }
    });

    filteredResults.sort((a, b) => {
      const typeOrder = { commune: 0, neighborhood: 1, city: 2 };
      if (a.type !== b.type) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return a.name.localeCompare(b.name);
    });

    const uniqueResults = Array.from(
      new Map(filteredResults.map((item) => [item.id, item])).values(),
    );
    const dbResults = uniqueResults.slice(0, 12);
    setResults(dbResults);

    // Secours carte si peu / aucun résultat en base
    if (dbResults.length < 4) {
      setMapLoading(true);
      osmTimeoutRef.current = setTimeout(async () => {
        try {
          const osmHits = await forwardGeocodeNominatim(searchQuery.trim(), { limit: 6 });
          const normalize = (s: string) =>
            s
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim();
          const osmResults: SearchResult[] = [];
          for (const hit of osmHits) {
            const already = dbResults.some((r) => normalize(r.name) === normalize(hit.shortName));
            if (already) continue;
            osmResults.push({
              id: `osm_${hit.placeId}`,
              name: hit.shortName,
              type: hit.typeHint,
              latitude: hit.latitude,
              longitude: hit.longitude,
              fromMap: true,
            });
          }
          setResults([...dbResults, ...osmResults].slice(0, 15));
        } catch (e) {
          console.warn('Recherche carte (Nominatim):', e);
        } finally {
          setMapLoading(false);
        }
      }, 350);
    } else {
      setMapLoading(false);
    }

    return () => {
      if (osmTimeoutRef.current) {
        clearTimeout(osmTimeoutRef.current);
        osmTimeoutRef.current = null;
      }
    };
  }, [searchQuery, cities, neighborhoods]);

  // Gérer la sélection
  const handleSelect = async (result: SearchResult) => {
    console.log('✅ === SÉLECTION MODAL ===', result.name);

    if (isKeyboardVisible) {
      Keyboard.dismiss();
    }

    setIsSelecting(true);
    setInputValue(result.name);
    setShowModal(false);

    let finalResult: SearchResult = result;

    // Lieu carte : tenter un rattachement locations + garder les coords précises
    if (
      result.fromMap &&
      result.latitude != null &&
      result.longitude != null &&
      Number.isFinite(result.latitude) &&
      Number.isFinite(result.longitude)
    ) {
      try {
        const matched = await matchLocationNearCoords({
          latitude: result.latitude,
          longitude: result.longitude,
        });
        if (matched?.id) {
          finalResult = {
            ...result,
            id: matched.id,
            name: result.name,
            type:
              matched.type === 'city' || matched.type === 'commune' || matched.type === 'neighborhood'
                ? matched.type
                : result.type,
            parent_id: matched.parent_id ?? undefined,
            latitude: result.latitude,
            longitude: result.longitude,
            fromMap: true,
          };
        }
      } catch {
        // garder le résultat OSM tel quel
      }
    }

    onChange(finalResult);
    if (onSelect) {
      onSelect(finalResult);
    }

    setTimeout(() => {
      setIsSelecting(false);
    }, 500);
  };

  const openModal = () => {
    if (!isSelecting) {
      setShowModal(true);
      setSearchQuery(inputValue);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSearchQuery('');
    if (onClose) {
      onClose();
    }
  };

  // Gérer le changement de texte dans l'input principal (maintenant non-éditable)
  const handleTextChange = (text: string) => {
    console.log('📝 CHANGEMENT TEXTE PRINCIPAL (non-éditable):', text);
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
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <SafeAreaView style={styles.modalContent} edges={['top', 'bottom']}>
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
              {citiesLoading || neighborhoodsLoading || mapLoading ? (
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
                          name={
                            item.fromMap
                              ? 'map'
                              : item.type === 'city'
                                ? 'location'
                                : item.type === 'commune'
                                  ? 'business'
                                  : 'home'
                          }
                          size={20}
                          color={
                            item.fromMap
                              ? '#0ea5e9'
                              : item.type === 'city'
                                ? '#3b82f6'
                                : item.type === 'commune'
                                  ? '#8b5cf6'
                                  : '#10b981'
                          }
                        />
                        <View style={styles.resultText}>
                          <Text style={styles.resultName}>{item.name}</Text>
                          <Text style={styles.resultSubtitle}>
                            {item.fromMap
                              ? 'Sur la carte'
                              : item.type === 'city'
                                ? "Côte d'Ivoire"
                                : item.type === 'commune'
                                  ? 'Commune'
                                  : item.commune
                                    ? `${item.commune} - Abidjan`
                                    : 'Quartier'}
                          </Text>
                        </View>
                        <View style={[
                          styles.resultType,
                          item.fromMap
                            ? styles.resultTypeMap
                            : item.type === 'city'
                              ? styles.resultTypeCity
                              : item.type === 'commune'
                                ? styles.resultTypeCommune
                                : styles.resultTypeNeighborhood
                        ]}>
                          <Text style={[
                            styles.resultTypeText,
                            item.fromMap
                              ? styles.resultTypeTextMap
                              : item.type === 'city'
                                ? styles.resultTypeTextCity
                                : item.type === 'commune'
                                  ? styles.resultTypeTextCommune
                                  : styles.resultTypeTextNeighborhood
                          ]}>
                            {item.fromMap
                              ? 'Carte'
                              : item.type === 'city'
                                ? 'Ville'
                                : item.type === 'commune'
                                  ? 'Commune'
                                  : 'Quartier'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                />
              ) : searchQuery.length >= 2 && !mapLoading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    Aucun résultat trouvé pour "{searchQuery}"
                  </Text>
                </View>
              ) : searchQuery.length >= 2 && mapLoading ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="large" color="#0ea5e9" />
                  <Text style={styles.emptyText}>Recherche sur la carte…</Text>
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
          </SafeAreaView>
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
    maxHeight: '90%',
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
  resultTypeMap: {
    backgroundColor: '#e0f2fe',
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
  resultTypeTextMap: {
    color: '#0369a1',
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
