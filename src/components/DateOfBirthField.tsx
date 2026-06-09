import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  InteractionManager,
  Platform,
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

const MONTH_NAMES_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function formatDatePreview(date: Date): string {
  const d = date.getDate();
  const m = MONTH_NAMES_FR[date.getMonth()] ?? '';
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

const DateOfBirthField: React.FC<Props> = ({
  value,
  onChange,
  onErrorChange,
  error,
  label,
  hint,
  placeholder = 'Choisir une date',
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
    setTempDate(getDefaultDateOfBirthPickerValue(value));
    InteractionManager.runAfterInteractions(() => {
      setShowPicker(true);
    });
  };

  const closePicker = () => {
    setShowPicker(false);
  };

  const onIosPickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(clampDateOfBirth(selectedDate));
  };

  const onAndroidPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    closePicker();
    if (event.type === 'dismissed' || !selectedDate) return;
    applyDate(selectedDate);
  };

  const confirm = () => {
    applyDate(tempDate);
    closePicker();
  };

  const isAuth = variant === 'auth';
  const hasError = !!error;
  const pickerValue = clampDateOfBirth(tempDate);

  const displayValue = useMemo(() => {
    if (value) return value;
    return placeholder;
  }, [value, placeholder]);

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
        accessibilityHint="Ouvre le sélecteur jour, mois et année"
      >
        {isAuth ? (
          <Ionicons name="calendar-outline" size={20} color="#666" style={styles.authIcon} />
        ) : (
          <Ionicons name="calendar-outline" size={20} color="#666" />
        )}
        <Text style={[styles.triggerText, !value && styles.placeholder]}>{displayValue}</Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}

      {Platform.OS === 'android' && showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          maximumDate={getMaxDateOfBirth()}
          minimumDate={getMinDateOfBirth()}
          onChange={onAndroidPickerChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closePicker} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Date de naissance</Text>
                <TouchableOpacity onPress={closePicker} hitSlop={12} accessibilityLabel="Fermer">
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalHint}>
                Faites défiler le jour, le mois et l&apos;année. Vous devez avoir au moins 18 ans.
              </Text>

              <View style={styles.previewBox}>
                <Ionicons name="calendar" size={22} color="#2E7D32" />
                <View style={styles.previewTexts}>
                  <Text style={styles.previewMain}>{formatDatePreview(pickerValue)}</Text>
                  <Text style={styles.previewSub}>{formatDateDdMmYyyy(pickerValue)}</Text>
                </View>
              </View>

              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={pickerValue}
                  mode="date"
                  display="spinner"
                  locale="fr-FR"
                  maximumDate={getMaxDateOfBirth()}
                  minimumDate={getMinDateOfBirth()}
                  onChange={onIosPickerChange}
                  style={styles.picker}
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closePicker}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
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
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 24,
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
    lineHeight: 20,
    marginBottom: 12,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  previewTexts: {
    flex: 1,
    gap: 2,
  },
  previewMain: {
    fontSize: 17,
    fontWeight: '700',
    color: '#14532d',
    textTransform: 'capitalize',
  },
  previewSub: {
    fontSize: 14,
    color: '#166534',
  },
  pickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'android' ? 200 : 220,
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'android' ? 200 : 220,
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
