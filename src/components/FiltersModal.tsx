import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters } from '../types';
import { useAmenities } from '../hooks/useAmenities';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';
import { getAmenityIonicIcon } from '../utils/amenityIcons';

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
  lockedRentalType?: 'short_term' | 'monthly';
}

const FiltersModal: React.FC<FiltersModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
  lockedRentalType,
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const { amenities, loading: amenitiesLoading } = useAmenities();
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>(initialFilters.sortBy || '');
  const [rentalType, setRentalType] = useState<'short_term' | 'monthly'>(
    lockedRentalType ?? (initialFilters.rentalType === 'monthly' ? 'monthly' : 'short_term')
  );
  const [minPriceInput, setMinPriceInput] = useState<string>(initialFilters.priceMin?.toString() || '');
  const [maxPriceInput, setMaxPriceInput] = useState<string>(initialFilters.priceMax?.toString() || '');

  const propertyTypes = [
    { key: 'apartment', label: 'Appartement' },
    { key: 'house', label: 'Maison' },
    { key: 'villa', label: 'Villa' },
    { key: 'eco_lodge', label: 'Éco-lodge' },
    { key: 'other', label: 'Autre' },
  ];

  // Gammes de prix rapides améliorées (alignées avec le site web)
  const quickPriceRanges = [
    { label: 'Économique', min: 0, max: 25000 },
    { label: 'Moyen', min: 25000, max: 50000 },
    { label: 'Confort', min: 50000, max: 100000 },
    { label: 'Premium', min: 100000, max: 200000 },
  ];

  // Options de tri (alignées avec le site web)
  const sortOptions = [
    { value: '', label: 'Par défaut' },
    { value: 'price_asc', label: 'Prix croissant' },
    { value: 'price_desc', label: 'Prix décroissant' },
    { value: 'recent', label: 'Plus récents' },
    { value: 'rating_desc', label: 'Meilleures notes' },
    { value: 'popular', label: 'Plus populaires' },
  ];

  // Initialiser les filtres depuis initialFilters
  useEffect(() => {
    if (initialFilters.amenities) {
      setSelectedAmenities(initialFilters.amenities);
    }
    if (initialFilters.sortBy) {
      setSortBy(initialFilters.sortBy);
    }
    if (lockedRentalType) {
      setRentalType(lockedRentalType);
    } else if (initialFilters.rentalType !== undefined) {
      setRentalType(initialFilters.rentalType);
    }
    if (initialFilters.priceMin !== undefined) {
      setMinPriceInput(initialFilters.priceMin.toString());
    }
    if (initialFilters.priceMax !== undefined) {
      setMaxPriceInput(initialFilters.priceMax.toString());
    }
  }, [initialFilters, lockedRentalType]);

  const handleApply = () => {
    const priceMin = minPriceInput ? parseInt(minPriceInput) : undefined;
    const priceMax = maxPriceInput ? parseInt(maxPriceInput) : undefined;
    
    onApply({
      ...filters,
      priceMin,
      priceMax,
      amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
      sortBy: sortBy || undefined,
      rentalType: lockedRentalType ?? rentalType,
    });
    onClose();
  };

  const handlePriceRangeSelect = (range: { min: number; max: number }) => {
    setMinPriceInput(range.min.toString());
    setMaxPriceInput(range.max.toString());
    setFilters({
      ...filters,
      priceMin: range.min,
      priceMax: range.max,
    });
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedAmenities([]);
    setSortBy('');
    setRentalType(lockedRentalType ?? 'short_term');
    setMinPriceInput('');
    setMaxPriceInput('');
  };

  const toggleAmenity = (amenityName: string) => {
    if (selectedAmenities.includes(amenityName)) {
      setSelectedAmenities(selectedAmenities.filter(a => a !== amenityName));
    } else {
      setSelectedAmenities([...selectedAmenities, amenityName]);
    }
  };

  // Équipements essentiels prioritaires (affichés en premier)
  const essentialAmenities = [
    'WiFi gratuit',
    'Eau chaude',
    'Climatisation',
    'Parking gratuit',
    'Piscine',
    'Jacuzzi',
    'Sauna',
    'Ascenseur',
  ];

  // Trier les équipements : essentiels d'abord, puis les autres
  const sortedAmenities = [...amenities].sort((a, b) => {
    const aIsEssential = essentialAmenities.includes(a.name);
    const bIsEssential = essentialAmenities.includes(b.name);
    if (aIsEssential && !bIsEssential) return -1;
    if (!aIsEssential && bIsEssential) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Filtres</Text>
          <TouchableOpacity onPress={handleApply}>
            <Text style={styles.applyText}>Appliquer</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {FEATURE_MONTHLY_RENTAL && !lockedRentalType && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="home" size={18} color="#2E7D32" />
                <Text style={styles.sectionTitle}>Type de logement</Text>
              </View>
              <View style={styles.sortContainer}>
                <TouchableOpacity
                  style={[styles.sortOption, rentalType === 'short_term' && styles.sortOptionActive]}
                  onPress={() => setRentalType('short_term')}
                >
                  <Text style={[styles.sortOptionText, rentalType === 'short_term' && styles.sortOptionTextActive]}>Résidence meublée</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortOption, rentalType === 'monthly' && styles.sortOptionActive]}
                  onPress={() => setRentalType('monthly')}
                >
                  <Text style={[styles.sortOptionText, rentalType === 'monthly' && styles.sortOptionTextActive]}>Location longue durée</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Tri */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={18} color="#2E7D32" />
              <Text style={styles.sectionTitle}>Trier par</Text>
            </View>
            <View style={styles.sortContainer}>
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.value || 'default'}
                  style={[
                    styles.sortOption,
                    sortBy === option.value && styles.sortOptionActive,
                  ]}
                  onPress={() => setSortBy(option.value)}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortBy === option.value && styles.sortOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Prix */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cash" size={18} color="#2E7D32" />
              <Text style={styles.sectionTitle}>
                {rentalType === 'monthly' ? 'Loyer mensuel' : 'Prix par nuit'}
              </Text>
            </View>
            <View style={styles.priceRange}>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Minimum</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  value={minPriceInput}
                  onChangeText={(text) => {
                    setMinPriceInput(text);
                    const value = parseInt(text) || 0;
                    const maxValue = parseInt(maxPriceInput) || 200000;
                    const clamped = Math.min(Math.max(value, 0), maxValue);
                    if (text === '' || !isNaN(clamped)) {
                      setFilters({ ...filters, priceMin: text === '' ? undefined : clamped });
                    }
                  }}
                  onBlur={() => {
                    const value = parseInt(minPriceInput) || 0;
                    const maxValue = parseInt(maxPriceInput) || 200000;
                    const clamped = Math.min(Math.max(value, 0), maxValue);
                    setMinPriceInput(clamped.toString());
                    setFilters({ ...filters, priceMin: clamped });
                  }}
                  keyboardType="numeric"
                />
                <Text style={styles.priceUnit}>FCFA</Text>
              </View>
              <Text style={styles.priceSeparator}>-</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Maximum</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="200000"
                  value={maxPriceInput}
                  onChangeText={(text) => {
                    setMaxPriceInput(text);
                    const value = parseInt(text) || 200000;
                    const minValue = parseInt(minPriceInput) || 0;
                    const clamped = Math.max(Math.min(value, 200000), minValue);
                    if (text === '' || !isNaN(clamped)) {
                      setFilters({ ...filters, priceMax: text === '' ? undefined : clamped });
                    }
                  }}
                  onBlur={() => {
                    const value = parseInt(maxPriceInput) || 200000;
                    const minValue = parseInt(minPriceInput) || 0;
                    const clamped = Math.max(Math.min(value, 200000), minValue);
                    setMaxPriceInput(clamped.toString());
                    setFilters({ ...filters, priceMax: clamped });
                  }}
                  keyboardType="numeric"
                />
                <Text style={styles.priceUnit}>FCFA</Text>
              </View>
            </View>
            
            {/* Gammes de prix rapides améliorées */}
            <View style={styles.priceRanges}>
              {quickPriceRanges.map((range, index) => {
                const isActive = 
                  (filters.priceMin === range.min || parseInt(minPriceInput) === range.min) &&
                  (filters.priceMax === range.max || parseInt(maxPriceInput) === range.max);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.priceRangeButton,
                      isActive && styles.priceRangeButtonActive,
                    ]}
                    onPress={() => handlePriceRangeSelect(range)}
                  >
                    <Text
                      style={[
                        styles.priceRangeText,
                        isActive && styles.priceRangeTextActive,
                      ]}
                    >
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Type de logement */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="home" size={18} color="#2E7D32" />
              <Text style={styles.sectionTitle}>Type de logement</Text>
            </View>
            <View style={styles.propertyTypes}>
              {propertyTypes.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.propertyTypeButton,
                    filters.propertyType === type.key && styles.propertyTypeButtonActive,
                  ]}
                  onPress={() => setFilters({ ...filters, propertyType: type.key })}
                >
                  <Text
                    style={[
                      styles.propertyTypeText,
                      filters.propertyType === type.key && styles.propertyTypeTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>


          {rentalType !== 'monthly' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recherche par rayon</Text>
              <Text style={styles.helpText}>
                Rechercher les logements dans un rayon autour du lieu sélectionné
              </Text>
              <View style={styles.radiusInputContainer}>
                <Text style={styles.radiusLabel}>Rayon (km)</Text>
                <TextInput
                  style={styles.radiusInput}
                  placeholder="Ex: 5, 10, 20"
                  value={filters.radiusKm?.toString() || ''}
                  onChangeText={(text) => {
                    const value = text ? parseFloat(text) : undefined;
                    setFilters({ ...filters, radiusKm: value && value > 0 ? value : undefined });
                  }}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
              {filters.radiusKm && filters.radiusKm > 0 && (
                <Text style={styles.radiusInfo}>
                  Afficher les logements dans un rayon de {filters.radiusKm} km
                </Text>
              )}
            </View>
          )}

          {/* Équipements */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="options" size={18} color="#2E7D32" />
              <Text style={styles.sectionTitle}>Équipements</Text>
            </View>
            {amenitiesLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Chargement des équipements...</Text>
              </View>
            ) : (
              <View style={styles.amenities}>
                {sortedAmenities.map((amenity) => {
                  const isSelected = selectedAmenities.includes(amenity.name);
                  const iconName = getAmenityIonicIcon(amenity.name) as any;
                  return (
                    <TouchableOpacity
                      key={amenity.id}
                      style={[
                        styles.amenityButton,
                        isSelected && styles.amenityButtonActive,
                      ]}
                      onPress={() => toggleAmenity(amenity.name)}
                    >
                      <Ionicons 
                        name={iconName} 
                        size={20} 
                        color={isSelected ? '#fff' : '#666'} 
                      />
                      <Text style={[styles.amenityText, isSelected && styles.amenityTextActive]}>
                        {amenity.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Bouton effacer */}
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Effacer tous les filtres</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  cancelText: {
    fontSize: 16,
    color: '#6c757d',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  applyText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  sortContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sortOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  sortOptionActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#6c757d',
  },
  sortOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  priceUnit: {
    position: 'absolute',
    right: 8,
    top: 28,
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 15,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    paddingRight: 50,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  priceSeparator: {
    marginHorizontal: 10,
    fontSize: 16,
    color: '#6c757d',
  },
  priceRanges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priceRangeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  priceRangeButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  priceRangeText: {
    fontSize: 14,
    color: '#6c757d',
  },
  priceRangeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  propertyTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  propertyTypeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  propertyTypeButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  propertyTypeText: {
    fontSize: 14,
    color: '#6c757d',
  },
  propertyTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  amenityButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  amenityText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
  amenityTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  radiusInputContainer: {
    marginTop: 10,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  radiusInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  radiusInfo: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 8,
    fontStyle: 'italic',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
});

export default FiltersModal;

