import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VehicleFilters, VehicleType, TransmissionType, FuelType } from '../types';
import { useCities } from '../hooks/useCities';
import { useNeighborhoods } from '../hooks/useNeighborhoods';

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

const VehicleFiltersModal: React.FC<VehicleFiltersModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) => {
  const { cities } = useCities();
  const { neighborhoods } = useNeighborhoods();

  const [filters, setFilters] = useState<VehicleFilters>(initialFilters);
  const [priceMin, setPriceMin] = useState(initialFilters.priceMin?.toString() || '');
  const [priceMax, setPriceMax] = useState(initialFilters.priceMax?.toString() || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(initialFilters.locationId);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(initialFilters.features || []);

  useEffect(() => {
    if (visible) {
      setFilters(initialFilters);
      setPriceMin(initialFilters.priceMin?.toString() || '');
      setPriceMax(initialFilters.priceMax?.toString() || '');
      setSelectedLocationId(initialFilters.locationId);
      setSelectedFeatures(initialFilters.features || []);
    }
  }, [visible, initialFilters]);

  const handleApply = () => {
    const appliedFilters: VehicleFilters = {
      ...filters,
      priceMin: priceMin ? parseInt(priceMin, 10) : undefined,
      priceMax: priceMax ? parseInt(priceMax, 10) : undefined,
      locationId: selectedLocationId,
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
    setSelectedLocationId(undefined);
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
    if (filters.vehicleType) count++;
    if (filters.brand) count++;
    if (filters.transmission) count++;
    if (filters.fuelType) count++;
    if (filters.seats) count++;
    if (priceMin) count++;
    if (priceMax) count++;
    if (selectedLocationId) count++;
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
            {/* Type de véhicule */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Type de véhicule</Text>
              <View style={styles.optionsContainer}>
                {VEHICLE_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.option,
                      filters.vehicleType === type.value && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setFilters(prev => ({
                        ...prev,
                        vehicleType: prev.vehicleType === type.value ? undefined : type.value,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        filters.vehicleType === type.value && styles.optionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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

            {/* Localisation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Localisation</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.locationScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.locationOption,
                    !selectedLocationId && styles.locationOptionSelected,
                  ]}
                  onPress={() => setSelectedLocationId(undefined)}
                >
                  <Text
                    style={[
                      styles.locationOptionText,
                      !selectedLocationId && styles.locationOptionTextSelected,
                    ]}
                  >
                    Toutes
                  </Text>
                </TouchableOpacity>
                {cities.map(city => (
                  <TouchableOpacity
                    key={city.id}
                    style={[
                      styles.locationOption,
                      selectedLocationId === city.id && styles.locationOptionSelected,
                    ]}
                    onPress={() => setSelectedLocationId(city.id)}
                  >
                    <Text
                      style={[
                        styles.locationOptionText,
                        selectedLocationId === city.id && styles.locationOptionTextSelected,
                      ]}
                    >
                      {city.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    backgroundColor: '#e67e22',
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
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
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  locationScroll: {
    marginTop: 8,
  },
  locationOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  locationOptionSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  locationOptionText: {
    fontSize: 14,
    color: '#666',
  },
  locationOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  featureTagSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
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
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#e67e22',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VehicleFiltersModal;





