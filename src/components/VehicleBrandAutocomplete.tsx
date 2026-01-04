import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Liste des marques de véhicules populaires
const VEHICLE_BRANDS = [
  'Audi', 'BMW', 'Chevrolet', 'Citroën', 'Dacia', 'Fiat', 'Ford', 'Honda',
  'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda',
  'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot',
  'Porsche', 'Renault', 'Seat', 'Skoda', 'Subaru', 'Suzuki', 'Tesla',
  'Toyota', 'Volkswagen', 'Volvo', 'Range Rover', 'Dodge', 'GMC',
  'Infiniti', 'Acura', 'Alfa Romeo', 'Aston Martin', 'Bentley', 'Bugatti',
  'Cadillac', 'Chrysler', 'Ferrari', 'Genesis', 'Lamborghini', 'Maserati',
  'McLaren', 'Rolls-Royce', 'Saab', 'Lancia', 'Hummer', 'Isuzu'
];

// Modèles populaires par marque
const VEHICLE_MODELS: Record<string, string[]> = {
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Land Cruiser', 'Hilux', 'Yaris', 'Prado', 'C-HR', 'Fortuner', 'Avalon'],
  'Mercedes-Benz': ['Classe C', 'Classe E', 'Classe S', 'GLA', 'GLC', 'GLE', 'GLS', 'Classe A', 'AMG GT', 'Maybach'],
  'BMW': ['Série 3', 'Série 5', 'Série 7', 'X1', 'X3', 'X5', 'X6', 'X7', 'M3', 'M5'],
  'Audi': ['A3', 'A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'RS6', 'e-tron'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'Pilot', 'Odyssey', 'Jazz', 'City'],
  'Hyundai': ['Tucson', 'Santa Fe', 'Elantra', 'Sonata', 'Palisade', 'Kona', 'i10', 'i20', 'i30'],
  'Nissan': ['Altima', 'Maxima', 'Rogue', 'Pathfinder', 'Patrol', 'Sentra', 'Qashqai', 'X-Trail', 'Juke'],
  'Ford': ['Focus', 'Fiesta', 'Mustang', 'Explorer', 'Ranger', 'F-150', 'Escape', 'Edge', 'Bronco'],
  'Volkswagen': ['Golf', 'Polo', 'Passat', 'Tiguan', 'Touareg', 'Jetta', 'Arteon', 'ID.4', 'T-Roc'],
  'Peugeot': ['208', '308', '508', '2008', '3008', '5008', 'Rifter', 'Partner', 'Expert'],
  'Renault': ['Clio', 'Megane', 'Captur', 'Kadjar', 'Koleos', 'Arkana', 'Duster', 'Talisman'],
  'Kia': ['Sportage', 'Sorento', 'Seltos', 'Carnival', 'Rio', 'Cerato', 'Stinger', 'Soul', 'EV6'],
  'Range Rover': ['Sport', 'Velar', 'Evoque', 'Defender', 'Vogue', 'Autobiography'],
  'Jeep': ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator'],
  'Porsche': ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan', 'Boxster', 'Cayman'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
  'Lexus': ['RX', 'NX', 'ES', 'LS', 'GX', 'LX', 'IS', 'LC', 'UX'],
};

interface VehicleBrandAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: any;
  mode?: 'brand' | 'model';
  selectedBrand?: string;
}

const VehicleBrandAutocomplete: React.FC<VehicleBrandAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Marque, modèle...',
  style,
  mode = 'brand',
  selectedBrand,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // Get list based on mode
  const getList = (): string[] => {
    if (mode === 'brand') {
      return VEHICLE_BRANDS;
    }
    if (mode === 'model' && selectedBrand) {
      return VEHICLE_MODELS[selectedBrand] || [];
    }
    return [];
  };

  // Filter suggestions
  useEffect(() => {
    const list = getList();
    if (!searchQuery.trim()) {
      setSuggestions(list.slice(0, 15));
      return;
    }
    
    const filtered = list.filter(item =>
      item.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 15);
    
    setSuggestions(filtered);
  }, [searchQuery, mode, selectedBrand]);

  const handleSelect = (item: string) => {
    onChange(item);
    setShowModal(false);
    setSearchQuery('');
  };

  const openModal = () => {
    setShowModal(true);
    setSearchQuery(value);
    const list = getList();
    setSuggestions(list.slice(0, 15));
  };

  const closeModal = () => {
    setShowModal(false);
    setSearchQuery('');
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Ionicons name="car" size={18} color="#64748b" style={styles.icon} />
        <Text style={[styles.input, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
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
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === 'brand' ? 'Sélectionner une marque' : 'Sélectionner un modèle'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Rechercher..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                placeholderTextColor="#94a3b8"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="car-sport" size={20} color="#2563eb" />
                  <Text style={styles.suggestionText}>{item}</Text>
                  {item.toLowerCase() === value.toLowerCase() && (
                    <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length >= 2 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>
                      Aucun résultat pour "{searchQuery}"
                    </Text>
                  </View>
                ) : null
              }
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
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
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  icon: {
    marginRight: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  placeholder: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  searchIcon: {
    marginRight: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  suggestionsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
  },
});

export { VEHICLE_BRANDS, VEHICLE_MODELS };
export default VehicleBrandAutocomplete;
