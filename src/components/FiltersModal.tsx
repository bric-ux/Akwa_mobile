import React, { useState } from 'react';
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

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

const FiltersModal: React.FC<FiltersModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const propertyTypes = [
    { key: 'apartment', label: 'Appartement' },
    { key: 'house', label: 'Maison' },
    { key: 'villa', label: 'Villa' },
    { key: 'eco_lodge', label: 'Éco-lodge' },
    { key: 'other', label: 'Autre' },
  ];

  const priceRanges = [
    { min: 0, max: 10000, label: 'Moins de 10k FCFA' },
    { min: 10000, max: 25000, label: '10k - 25k FCFA' },
    { min: 25000, max: 50000, label: '25k - 50k FCFA' },
    { min: 50000, max: 100000, label: '50k - 100k FCFA' },
    { min: 100000, max: undefined, label: 'Plus de 100k FCFA' },
  ];

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handlePriceRangeSelect = (range: { min: number; max?: number }) => {
    setFilters({
      ...filters,
      priceMin: range.min,
      priceMax: range.max,
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

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
          {/* Prix */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prix par nuit</Text>
            <View style={styles.priceRange}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={filters.priceMin?.toString() || ''}
                onChangeText={(text) => setFilters({ ...filters, priceMin: parseInt(text) || undefined })}
                keyboardType="numeric"
              />
              <Text style={styles.priceSeparator}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={filters.priceMax?.toString() || ''}
                onChangeText={(text) => setFilters({ ...filters, priceMax: parseInt(text) || undefined })}
                keyboardType="numeric"
              />
            </View>
            
            {/* Gammes de prix rapides */}
            <View style={styles.priceRanges}>
              {priceRanges.map((range, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.priceRangeButton,
                    filters.priceMin === range.min && filters.priceMax === range.max && styles.priceRangeButtonActive,
                  ]}
                  onPress={() => handlePriceRangeSelect(range)}
                >
                  <Text
                    style={[
                      styles.priceRangeText,
                      filters.priceMin === range.min && filters.priceMax === range.max && styles.priceRangeTextActive,
                    ]}
                  >
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Type de logement */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type de logement</Text>
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


          {/* Équipements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Équipements essentiels</Text>
            <View style={styles.amenities}>
              <TouchableOpacity
                style={[
                  styles.amenityButton,
                  filters.wifi && styles.amenityButtonActive,
                ]}
                onPress={() => setFilters({ ...filters, wifi: !filters.wifi })}
              >
                <Ionicons name="wifi" size={20} color={filters.wifi ? '#fff' : '#666'} />
                <Text style={[styles.amenityText, filters.wifi && styles.amenityTextActive]}>
                  WiFi
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.amenityButton,
                  filters.parking && styles.amenityButtonActive,
                ]}
                onPress={() => setFilters({ ...filters, parking: !filters.parking })}
              >
                <Ionicons name="car" size={20} color={filters.parking ? '#fff' : '#666'} />
                <Text style={[styles.amenityText, filters.parking && styles.amenityTextActive]}>
                  Parking
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.amenityButton,
                  filters.pool && styles.amenityButtonActive,
                ]}
                onPress={() => setFilters({ ...filters, pool: !filters.pool })}
              >
                <Ionicons name="water" size={20} color={filters.pool ? '#fff' : '#666'} />
                <Text style={[styles.amenityText, filters.pool && styles.amenityTextActive]}>
                  Piscine
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.amenityButton,
                  filters.airConditioning && styles.amenityButtonActive,
                ]}
                onPress={() => setFilters({ ...filters, airConditioning: !filters.airConditioning })}
              >
                <Ionicons name="snow" size={20} color={filters.airConditioning ? '#fff' : '#666'} />
                <Text style={[styles.amenityText, filters.airConditioning && styles.amenityTextActive]}>
                  Climatisation
                </Text>
              </TouchableOpacity>
            </View>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
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
});

export default FiltersModal;

