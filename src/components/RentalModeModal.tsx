import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TRAVELER_COLORS } from '../constants/colors';

interface RentalModeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (mode: 'on_demand' | 'auto_booking' | undefined) => void;
  selectedMode?: 'on_demand' | 'auto_booking';
}

const RENTAL_MODES: { 
  value: 'on_demand' | 'auto_booking'; 
  label: string; 
  description: string;
  icon: string;
}[] = [
  { 
    value: 'on_demand', 
    label: 'Location sur demande', 
    description: 'Le propriétaire valide chaque réservation',
    icon: 'time-outline'
  },
  { 
    value: 'auto_booking', 
    label: 'Réservation automatique', 
    description: 'La réservation est confirmée automatiquement',
    icon: 'flash-outline'
  },
];

const RentalModeModal: React.FC<RentalModeModalProps> = ({
  visible,
  onClose,
  onSelect,
  selectedMode,
}) => {
  const handleSelect = (mode: 'on_demand' | 'auto_booking') => {
    if (selectedMode === mode) {
      // Désélectionner si déjà sélectionné
      onSelect(undefined);
    } else {
      onSelect(mode);
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
            <Text style={styles.headerTitle}>Mode de location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            {RENTAL_MODES.map(mode => (
              <TouchableOpacity
                key={mode.value}
                style={[
                  styles.option,
                  selectedMode === mode.value && styles.optionSelected,
                ]}
                onPress={() => handleSelect(mode.value)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={[
                    styles.iconContainer,
                    selectedMode === mode.value && styles.iconContainerSelected
                  ]}>
                    <Ionicons 
                      name={mode.icon as any} 
                      size={28} 
                      color={selectedMode === mode.value ? TRAVELER_COLORS.primary : '#64748b'} 
                    />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text
                      style={[
                        styles.optionText,
                        selectedMode === mode.value && styles.optionTextSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {mode.description}
                    </Text>
                  </View>
                  {selectedMode === mode.value && (
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
    maxHeight: '60%',
    minHeight: '40%',
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
  optionsContainer: {
    padding: 20,
    gap: 16,
  },
  option: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 20,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerSelected: {
    backgroundColor: TRAVELER_COLORS.light,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  optionTextSelected: {
    color: TRAVELER_COLORS.primary,
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '400',
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

export default RentalModeModal;


