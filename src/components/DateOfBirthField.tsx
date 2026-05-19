import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  clampDateOfBirth,
  formatDateDdMmYyyy,
  getDefaultDateOfBirthPickerValue,
  getMaxDateOfBirth,
  getMinDateOfBirth,
  validateAdultAgeDdMmYyyy,
} from '../lib/phoneAuth';

type Variant = 'auth' | 'signup';

type Props = {
  value: string;
  onChange: (ddMmYyyy: string) => void;
  onErrorChange?: (message: string | null) => void;
  error?: string | null;
  label?: string;
  hint?: string;
  placeholder?: string;
  variant?: Variant;
};

/** Calendrier natif sur Android récent ; dialog classique sinon. */
const ANDROID_DATE_DISPLAY = Platform.OS === 'android' ? 'calendar' : 'spinner';

const DateOfBirthField: React.FC<Props> = ({
  value,
  onChange,
  onErrorChange,
  error,
  label,
  hint,
  placeholder = 'JJ/MM/AAAA',
  variant = 'signup',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() =>
    getDefaultDateOfBirthPickerValue(value),
  );

  const applyDate = useCallback(
    (date: Date) => {
      const safe = clampDateOfBirth(date);
      const formatted = formatDateDdMmYyyy(safe);
      onChange(formatted);
      const validation = validateAdultAgeDdMmYyyy(formatted);
      onErrorChange?.(validation.isValid ? null : validation.message || null);
    },
    [onChange, onErrorChange],
  );

  const openPicker = () => {
    const initial = getDefaultDateOfBirthPickerValue(value);
    setTempDate(initial);
    // Évite que le dialog Android ne s’ouvre pas dans un ScrollView / clavier actif
    InteractionManager.runAfterInteractions(() => {
      setShowPicker(true);
    });
  };

  const closePicker = () => {
    setShowPicker(false);
  };

  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      closePicker();
      if (event.type === 'dismissed') return;
      if (!selectedDate) return;
      // type 'set' (API 33+) ou undefined sur anciennes versions après validation
      if (event.type === 'set' || event.type === 'neutralButton' || event.type == null) {
        applyDate(selectedDate);
      }
      return;
    }
    if (selectedDate) setTempDate(clampDateOfBirth(selectedDate));
  };

  const confirmIos = () => {
    applyDate(tempDate);
    closePicker();
  };

  const isAuth = variant === 'auth';
  const hasError = !!error;
  const pickerValue = clampDateOfBirth(tempDate);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[
          isAuth ? styles.authInputContainer : styles.signupTrigger,
          hasError && styles.triggerError,
        ]}
        onPress={openPicker}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label || 'Date de naissance'}
        accessibilityHint="Ouvre le sélecteur de date"
      >
        {isAuth ? (
          <Ionicons name="calendar-outline" size={20} color="#666" style={styles.authIcon} />
        ) : (
          <Ionicons name="calendar-outline" size={20} color="#666" />
        )}
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}

      {/* Android : dialog calendrier natif (hors Modal pour fiabilité) */}
      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={ANDROID_DATE_DISPLAY}
          maximumDate={getMaxDateOfBirth()}
          minimumDate={getMinDateOfBirth()}
          onChange={onPickerChange}
          positiveButton={{ label: 'OK', textColor: '#2E7D32' }}
          negativeButton={{ label: 'Annuler', textColor: '#666' }}
        />
      ) : null}

      {/* iOS : feuille modale + roue */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Date de naissance</Text>
                <TouchableOpacity onPress={closePicker} hitSlop={12}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalHint}>Vous devez avoir au moins 18 ans.</Text>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                locale="fr-FR"
                maximumDate={getMaxDateOfBirth()}
                minimumDate={getMinDateOfBirth()}
                onChange={onPickerChange}
                style={styles.iosPicker}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closePicker}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={confirmIos}>
                  <Text style={styles.confirmBtnText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  signupTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 10,
  },
  authInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 52,
    gap: 8,
  },
  authIcon: {
    marginRight: 4,
  },
  triggerError: {
    borderColor: '#dc2626',
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  placeholder: {
    color: '#999',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  modalHint: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  iosPicker: {
    height: 220,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
});

export default DateOfBirthField;
