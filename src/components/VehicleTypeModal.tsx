import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VehicleType } from '../types';
import { TRAVELER_COLORS } from '../constants/colors';

interface VehicleTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: VehicleType | undefined) => void;
  selectedType?: VehicleType;
}

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: 'car', label: 'Voiture', icon: 'car' },
  { value: 'suv', label: 'SUV', icon: 'car-sport' },
  { value: 'van', label: 'Van', icon: 'car-sport' },
  { value: 'truck', label: 'Camion', icon: 'car-sport' },
  { value: 'motorcycle', label: 'Moto', icon: 'bicycle' },
  { value: 'scooter', label: 'Scooter', icon: 'bicycle' },
  { value: 'bicycle', label: 'Vélo', icon: 'bicycle' },
  { value: 'other', label: 'Autre', icon: 'ellipse' },
];

const VehicleTypeModal: React.FC<VehicleTypeModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedType,
}) => {
  const handleSelect = (type: VehicleType) => {
    if (selectedType === type) {
      // Désélectionner si déjà sélectionné
      onSelect(undefined);
    } else {
      onSelect(type);
    }
  };

  const handleApply = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Type de véhicule</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.optionsContainer}>
              {VEHICLE_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.option,
                    selectedType === type.value && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(type.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={[
                      styles.iconContainer,
                      selectedType === type.value && styles.iconContainerSelected
                    ]}>
                      <Ionicons 
                        name={type.icon as any} 
                        size={24} 
                        color={selectedType === type.value ? TRAVELER_COLORS.primary : '#64748b'} 
                      />
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        selectedType === type.value && styles.optionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                    {selectedType === type.value && (
                      <Ionicons 
                        name="checkmark-circle" 
                        size={24} 
                        color={TRAVELER_COLORS.primary} 
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              activeOpacity={0.8}
            >
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
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  scrollView: {
    flex: 1,
  },
  optionsContainer: {
    padding: 20,
    gap: 12,
  },
  option: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  optionSelected: {
    backgroundColor: TRAVELER_COLORS.light,
    borderColor: TRAVELER_COLORS.primary,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerSelected: {
    backgroundColor: TRAVELER_COLORS.light,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
  },
  optionTextSelected: {
    color: TRAVELER_COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  applyButton: {
    backgroundColor: TRAVELER_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleTypeModal;


