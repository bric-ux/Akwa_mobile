import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters } from '../types';

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onFiltersPress: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onFiltersPress }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    onSearch({ city: searchQuery });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6c757d" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Où voulez-vous aller ?"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity onPress={onFiltersPress} style={styles.filtersButton}>
        <Ionicons name="options" size={20} color="#e67e22" />
        <Text style={styles.filtersText}>Filtres</Text>
      </TouchableOpacity>
    </View>
  );
};

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
  ];

  const handleApply = () => {
    onApply(filters);
    onClose();
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
          </View>

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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nombre de voyageurs</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de voyageurs"
              value={filters.guests?.toString() || ''}
              onChangeText={(text) => setFilters({ ...filters, guests: parseInt(text) || undefined })}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
  },
  searchButton: {
    backgroundColor: '#e67e22',
    borderRadius: 20,
    padding: 8,
    marginLeft: 10,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  filtersText: {
    marginLeft: 5,
    color: '#e67e22',
    fontWeight: '600',
  },
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
    color: '#e67e22',
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
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  propertyTypeText: {
    fontSize: 14,
    color: '#6c757d',
  },
  propertyTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export { SearchBar, FiltersModal };

