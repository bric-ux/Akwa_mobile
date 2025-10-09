import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickFilter {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  onFilterToggle: (filterId: string) => void;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  filters,
  onFilterToggle,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              filter.active && styles.filterChipActive,
            ]}
            onPress={() => onFilterToggle(filter.id)}
          >
            <Ionicons
              name={filter.icon as any}
              size={16}
              color={filter.active ? '#fff' : '#666'}
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterText,
                filter.active && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
});

export default QuickFilters;
