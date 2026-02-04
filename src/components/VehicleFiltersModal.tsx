import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VehicleFilters, VehicleType, TransmissionType, FuelType } from '../types';
import { TRAVELER_COLORS } from '../constants/colors';
import { VEHICLE_BRANDS } from './VehicleBrandAutocomplete';

interface VehicleFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: VehicleFilters) => void;
  initialFilters?: VehicleFilters;
}

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'car', label: 'Voiture' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Camion' },
  { value: 'motorcycle', label: 'Moto' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'bicycle', label: 'Vélo' },
  { value: 'other', label: 'Autre' },
];

const TRANSMISSION_TYPES: { value: TransmissionType; label: string }[] = [
  { value: 'manual', label: 'Manuelle' },
  { value: 'automatic', label: 'Automatique' },
];

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'essence', label: 'Essence' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Électrique' },
  { value: 'hybrid', label: 'Hybride' },
];

const COMMON_FEATURES = [
  'Climatisation',
  'GPS',
  'Bluetooth',
  'Sièges en cuir',
  'Toit ouvrant',
  'Caméra de recul',
  'Régulateur de vitesse',
  'Détecteur de pluie',
  'Phares automatiques',
  'Parking assisté',
];

// Composant d'autocomplétion pour les marques
const BrandAutocomplete: React.FC<{
  value: string;
  onChange: (brand: string) => void;
}> = ({ value, onChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions(VEHICLE_BRANDS.slice(0, 10));
      return;
    }
    
    const filtered = VEHICLE_BRANDS.filter(brand =>
      brand.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
    
    setSuggestions(filtered);
  }, [searchQuery]);

  const handleSelect = (brand: string) => {
    onChange(brand);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    setShowSuggestions(false);
  };

  return (
    <View style={styles.brandAutocompleteContainer}>
      <View style={styles.brandInputContainer}>
        <Ionicons name="car" size={18} color={TRAVELER_COLORS.primary} />
        <TextInput
          style={styles.brandInput}
          placeholder="Rechercher une marque..."
          placeholderTextColor="#94a3b8"
          value={searchQuery || value}
          onChangeText={(text) => {
            setSearchQuery(text);
            setShowSuggestions(true);
            if (!text) {
              onChange('');
            }
          }}
          onFocus={() => {
            if (!value) {
              setShowSuggestions(true);
            }
          }}
        />
        {value && (
          <TouchableOpacity onPress={handleClear}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </View>
      
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.brandSuggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.brandSuggestionItem}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="car-sport" size={18} color={TRAVELER_COLORS.primary} style={{ marginRight: 12 }} />
                <Text style={styles.brandSuggestionText}>{item}</Text>
                {value === item && (
                  <Ionicons name="checkmark-circle" size={18} color={TRAVELER_COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          />
        </View>
      )}
    </View>
  );
};

const VehicleFiltersModal: React.FC<VehicleFiltersModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) => {

  const [filters, setFilters] = useState<VehicleFilters>(initialFilters);
  const [priceMin, setPriceMin] = useState(initialFilters.priceMin?.toString() || '');
  const [priceMax, setPriceMax] = useState(initialFilters.priceMax?.toString() || '');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(initialFilters.features || []);

  useEffect(() => {
    if (visible) {
      setFilters(initialFilters);
      setPriceMin(initialFilters.priceMin?.toString() || '');
      setPriceMax(initialFilters.priceMax?.toString() || '');
      setSelectedFeatures(initialFilters.features || []);
    }
  }, [visible, initialFilters]);

  const handleApply = () => {
    const appliedFilters: VehicleFilters = {
      ...filters,
      priceMin: priceMin ? parseInt(priceMin, 10) : undefined,
      priceMax: priceMax ? parseInt(priceMax, 10) : undefined,
      features: selectedFeatures.length > 0 ? selectedFeatures : undefined,
    };
    onApply(appliedFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: VehicleFilters = {};
    setFilters(resetFilters);
    setPriceMin('');
    setPriceMax('');
    setSelectedFeatures([]);
    onApply(resetFilters);
    onClose();
  };

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    // vehicleType n'est pas compté car il est géré en dehors du modal
    if (filters.brand) count++;
    if (filters.transmission) count++;
    if (filters.fuelType) count++;
    if (filters.seats) count++;
    if (priceMin) count++;
    if (priceMax) count++;
    if (filters.withDriver !== undefined) count++;
    if (selectedFeatures.length > 0) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Filtres</Text>
            {activeFiltersCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Marque */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Marque</Text>
              <BrandAutocomplete
                value={filters.brand || ''}
                onChange={(brand) =>
                  setFilters(prev => ({
                    ...prev,
                    brand: brand || undefined,
                  }))
                }
              />
            </View>

            {/* Transmission */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transmission</Text>
              <View style={styles.optionsContainer}>
                {TRANSMISSION_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.option,
                      filters.transmission === type.value && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setFilters(prev => ({
                        ...prev,
                        transmission: prev.transmission === type.value ? undefined : type.value,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        filters.transmission === type.value && styles.optionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Type de carburant */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Type de carburant</Text>
              <View style={styles.optionsContainer}>
                {FUEL_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.option,
                      filters.fuelType === type.value && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setFilters(prev => ({
                        ...prev,
                        fuelType: prev.fuelType === type.value ? undefined : type.value,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        filters.fuelType === type.value && styles.optionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Nombre de places */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nombre de places minimum</Text>
              <View style={styles.optionsContainer}>
                {[2, 4, 5, 7, 9].map(seats => (
                  <TouchableOpacity
                    key={seats}
                    style={[
                      styles.option,
                      filters.seats === seats && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setFilters(prev => ({
                        ...prev,
                        seats: prev.seats === seats ? undefined : seats,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        filters.seats === seats && styles.optionTextSelected,
                      ]}
                    >
                      {seats}+ places
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Prix */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prix par jour (XOF)</Text>
              <View style={styles.priceContainer}>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceLabel}>Min</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    value={priceMin}
                    onChangeText={setPriceMin}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceLabel}>Max</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="100000"
                    value={priceMax}
                    onChangeText={setPriceMax}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Véhicule avec chauffeur */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Service de chauffeur</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    filters.withDriver === true && styles.optionSelected,
                  ]}
                  onPress={() =>
                    setFilters(prev => ({
                      ...prev,
                      withDriver: prev.withDriver === true ? undefined : true,
                    }))
                  }
                >
                  <Ionicons 
                    name={filters.withDriver === true ? "checkmark-circle" : "ellipse-outline"} 
                    size={18} 
                    color={filters.withDriver === true ? "#fff" : "#64748b"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      filters.withDriver === true && styles.optionTextSelected,
                    ]}
                  >
                    Avec chauffeur
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    filters.withDriver === false && styles.optionSelected,
                  ]}
                  onPress={() =>
                    setFilters(prev => ({
                      ...prev,
                      withDriver: prev.withDriver === false ? undefined : false,
                    }))
                  }
                >
                  <Ionicons 
                    name={filters.withDriver === false ? "checkmark-circle" : "ellipse-outline"} 
                    size={18} 
                    color={filters.withDriver === false ? "#fff" : "#64748b"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      filters.withDriver === false && styles.optionTextSelected,
                    ]}
                  >
                    Sans chauffeur
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Équipements */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Équipements</Text>
              <View style={styles.featuresContainer}>
                {COMMON_FEATURES.map(feature => (
                  <TouchableOpacity
                    key={feature}
                    style={[
                      styles.featureTag,
                      selectedFeatures.includes(feature) && styles.featureTagSelected,
                    ]}
                    onPress={() => toggleFeature(feature)}
                  >
                    <Text
                      style={[
                        styles.featureText,
                        selectedFeatures.includes(feature) && styles.featureTextSelected,
                      ]}
                    >
                      {feature}
                    </Text>
                    {selectedFeatures.includes(feature) && (
                      <Ionicons name="checkmark" size={16} color="#fff" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: TRAVELER_COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  optionSelected: {
    backgroundColor: TRAVELER_COLORS.primary,
    borderColor: TRAVELER_COLORS.primary,
  },
  optionText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  priceInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontWeight: '500',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginRight: 8,
    marginBottom: 8,
  },
  featureTagSelected: {
    backgroundColor: TRAVELER_COLORS.primary,
    borderColor: TRAVELER_COLORS.primary,
  },
  featureText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  featureTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
    backgroundColor: '#fff',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: TRAVELER_COLORS.primary,
    alignItems: 'center',
    shadowColor: TRAVELER_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  brandAutocompleteContainer: {
    marginTop: 8,
  },
  brandInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  brandInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  brandSuggestionsContainer: {
    marginTop: 8,
    maxHeight: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  brandSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandSuggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default VehicleFiltersModal;





