import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  InteractionManager,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHONE_AUTH_COUNTRIES, type CountryDial } from '../lib/phoneAuth';
import {
  AUTH_FORM_PLACEHOLDER_COLOR,
  AUTH_FORM_TEXT_COLOR,
  authFormInputTextStyle,
} from '../lib/authFormInput';

type Props = {
  dial: string;
  local: string;
  onDialChange: (dial: string) => void;
  onLocalChange: (local: string) => void;
  countries?: CountryDial[];
  disabled?: boolean;
};

const PhoneNumberField: React.FC<Props> = ({
  dial,
  local,
  onDialChange,
  onLocalChange,
  countries = PHONE_AUTH_COUNTRIES,
  disabled = false,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = countries.find((c) => c.dial === dial) ?? countries.find((c) => c.code === 'CI')!;

  const openPicker = useCallback(() => {
    if (disabled) return;
    InteractionManager.runAfterInteractions(() => {
      setPickerOpen(true);
    });
  }, [disabled]);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.dialButton, disabled && styles.dialButtonDisabled]}
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Indicatif pays"
        accessibilityHint="Ouvre la liste des indicatifs"
      >
        <Text style={styles.dialFlag}>{selected.flag}</Text>
        <Text style={styles.dialText}>{selected.dial}</Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>
      <TextInput
        style={[styles.localInput, authFormInputTextStyle, disabled && styles.inputDisabled]}
        value={local}
        onChangeText={onLocalChange}
        placeholder="07 00 00 00 00"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholderTextColor={AUTH_FORM_PLACEHOLDER_COLOR}
        importantForAutofill="yes"
        editable={!disabled}
      />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Indicatif pays</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Côte d&apos;Ivoire et pays européens</Text>
            <FlatList
              data={countries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryRow, item.dial === dial && styles.countryRowActive]}
                  onPress={() => {
                    onDialChange(item.dial);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryDial}>{item.dial}</Text>
                  <Text style={styles.countryName}>{item.name}</Text>
                  {item.dial === dial ? (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  dialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 4,
    minWidth: 108,
  },
  dialButtonDisabled: {
    opacity: 0.55,
  },
  dialFlag: { fontSize: 18 },
  dialText: { fontSize: 15, fontWeight: '600', color: AUTH_FORM_TEXT_COLOR },
  localInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: AUTH_FORM_TEXT_COLOR,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
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
    maxHeight: '75%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  modalHint: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  list: { flexGrow: 0 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  countryRowActive: { backgroundColor: '#e8f5e9' },
  countryFlag: { fontSize: 22 },
  countryDial: { fontSize: 16, fontWeight: '600', width: 56 },
  countryName: { fontSize: 15, color: '#374151', flex: 1 },
});

export default PhoneNumberField;
