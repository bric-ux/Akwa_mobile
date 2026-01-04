import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Liste des marques de véhicules populaires (identique au site web)
export const VEHICLE_BRANDS = [
  'Audi', 'BMW', 'Chevrolet', 'Citroën', 'Dacia', 'Fiat', 'Ford', 'Honda',
  'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda',
  'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot',
  'Porsche', 'Renault', 'Seat', 'Skoda', 'Subaru', 'Suzuki', 'Tesla',
  'Toyota', 'Volkswagen', 'Volvo', 'Range Rover', 'Dodge', 'GMC',
  'Infiniti', 'Acura', 'Alfa Romeo', 'Aston Martin', 'Bentley', 'Bugatti',
  'Cadillac', 'Chrysler', 'Ferrari', 'Genesis', 'Lamborghini', 'Maserati',
  'McLaren', 'Rolls-Royce', 'Saab', 'Lancia', 'Hummer', 'Isuzu'
];

// Modèles populaires par marque (identique au site web)
export const VEHICLE_MODELS: Record<string, string[]> = {
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
  placeholder = "Marque, modèle, titre...",
  style,
  mode = 'brand',
  selectedBrand,
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
    if (!value.trim()) {
      setSuggestions(list.slice(0, 10));
      return;
    }
    
    const filtered = list.filter(item =>
      item.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 10);
    
    setSuggestions(filtered);
  }, [value, mode, selectedBrand]);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    Keyboard.dismiss();
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Délai pour permettre le clic sur une suggestion
    setTimeout(() => setIsOpen(false), 200);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <Ionicons name="car-outline" size={20} color="#666" style={styles.icon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#999"
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onChange('');
              setIsOpen(false);
            }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      
      {isOpen && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.suggestionItem,
                  item.toLowerCase() === value.toLowerCase() && styles.suggestionItemActive
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            style={styles.suggestionsList}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionItemActive: {
    backgroundColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
});

export default VehicleBrandAutocomplete;

