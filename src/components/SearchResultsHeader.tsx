import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types';

interface SortOption {
  key: string;
  label: string;
  icon: string;
}

interface SearchResultsHeaderProps {
  resultsCount: number;
  onSortPress: () => void;
  currentSort: string;
  onViewToggle: () => void;
  isGridView: boolean;
}

export const SearchResultsHeader: React.FC<SearchResultsHeaderProps> = ({
  resultsCount,
  onSortPress,
  currentSort,
  onViewToggle,
  isGridView,
}) => {
  const [showSortModal, setShowSortModal] = useState(false);

  const sortOptions: SortOption[] = [
    { key: 'price_asc', label: 'Prix croissant', icon: 'arrow-up' },
    { key: 'price_desc', label: 'Prix décroissant', icon: 'arrow-down' },
    { key: 'rating', label: 'Mieux notés', icon: 'star' },
    { key: 'newest', label: 'Plus récents', icon: 'time' },
    { key: 'popular', label: 'Plus populaires', icon: 'trending-up' },
  ];

  const getSortLabel = (key: string): string => {
    const option = sortOptions.find(opt => opt.key === key);
    return option ? option.label : 'Trier';
  };

  const handleSortSelect = (option: SortOption) => {
    onSortPress();
    setShowSortModal(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsCount}>
          {resultsCount} propriété{resultsCount > 1 ? 's' : ''} trouvée{resultsCount > 1 ? 's' : ''}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
          >
            <Ionicons name="swap-vertical" size={16} color="#666" />
            <Text style={styles.sortText}>{getSortLabel(currentSort)}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.viewToggleButton}
            onPress={onViewToggle}
          >
            <Ionicons 
              name={isGridView ? 'list' : 'grid'} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de tri */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Trier par</Text>
            <FlatList
              data={sortOptions}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sortOption,
                    currentSort === item.key && styles.sortOptionActive,
                  ]}
                  onPress={() => handleSortSelect(item)}
                >
                  <Ionicons 
                    name={item.icon as any} 
                    size={20} 
                    color={currentSort === item.key ? '#2E7D32' : '#666'} 
                  />
                  <Text
                    style={[
                      styles.sortOptionText,
                      currentSort === item.key && styles.sortOptionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {currentSort === item.key && (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.key}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  sortText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  viewToggleButton: {
    padding: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: '#f0f8f0',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  sortOptionTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default SearchResultsHeader;

