import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Amenity } from '../types';
import { getAmenityIonicIcon } from '../utils/amenityIcons';

const POPULAR_AMENITIES = [
  'WiFi gratuit',
  'Climatisation',
  'Parking gratuit',
  'Piscine',
  'Eau chaude',
  'Jacuzzi',
  'Sauna',
  'Ascenseur',
  'Petit-déjeuner',
  'Salle de sport',
];

type Props = {
  amenities: Amenity[];
  loading: boolean;
  selected: string[];
  onToggle: (name: string) => void;
  accentColor: string;
  onSearchFocus?: () => void;
};

const AmenityFilterPicker: React.FC<Props> = ({
  amenities,
  loading,
  selected,
  onToggle,
  accentColor,
  onSearchFocus,
}) => {
  const [query, setQuery] = useState('');

  const sortedAmenities = useMemo(() => {
    return [...amenities].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [amenities]);

  const filteredAmenities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedAmenities;
    return sortedAmenities.filter((a) => a.name.toLowerCase().includes(q));
  }, [sortedAmenities, query]);

  const popularOptions = useMemo(() => {
    const names = new Set(sortedAmenities.map((a) => a.name));
    return POPULAR_AMENITIES.filter((name) => names.has(name));
  }, [sortedAmenities]);

  const showPopular = query.trim().length === 0 && popularOptions.length > 0;

  const renderAmenityRow = (name: string, key: string) => {
    const isSelected = selected.includes(name);
    const iconName = getAmenityIonicIcon(name) as keyof typeof Ionicons.glyphMap;
    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.row,
          isSelected && { backgroundColor: `${accentColor}14`, borderColor: accentColor },
        ]}
        onPress={() => onToggle(name)}
      >
        <View style={[styles.rowIcon, isSelected && { backgroundColor: accentColor }]}>
          <Ionicons name={iconName} size={18} color={isSelected ? '#fff' : '#64748b'} />
        </View>
        <Text style={[styles.rowLabel, isSelected && { color: accentColor, fontWeight: '600' }]}>
          {name}
        </Text>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={20} color={accentColor} />
        ) : (
          <Ionicons name="add-circle-outline" size={20} color="#cbd5e1" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un équipement…"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          onFocus={onSearchFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {selected.length > 0 ? (
        <View style={styles.selectedWrap}>
          <Text style={styles.selectedTitle}>Sélectionnés ({selected.length})</Text>
          <View style={styles.selectedChips}>
            {selected.map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.selectedChip, { backgroundColor: accentColor }]}
                onPress={() => onToggle(name)}
              >
                <Text style={styles.selectedChipText}>{name}</Text>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <Text style={styles.loadingText}>Chargement des équipements…</Text>
      ) : (
        <View style={styles.list}>
          {showPopular ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Populaires</Text>
              {popularOptions.map((name) => renderAmenityRow(name, `pop-${name}`))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {query.trim() ? `Résultats (${filteredAmenities.length})` : 'Tous les équipements'}
            </Text>
            {filteredAmenities.length === 0 ? (
              <Text style={styles.emptyText}>Aucun équipement pour « {query} »</Text>
            ) : (
              filteredAmenities.map((amenity) => renderAmenityRow(amenity.name, amenity.id))
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    padding: 0,
  },
  selectedWrap: { gap: 8 },
  selectedTitle: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  list: { gap: 4 },
  section: { gap: 6, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 14, color: '#334155' },
  loadingText: { fontSize: 14, color: '#64748b', paddingVertical: 8 },
  emptyText: { fontSize: 14, color: '#94a3b8', paddingVertical: 12 },
});

export default AmenityFilterPicker;
