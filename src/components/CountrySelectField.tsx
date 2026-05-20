import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  InteractionManager,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHONE_AUTH_COUNTRIES, type CountryDial } from '../lib/phoneAuth';
import { resolveProfileCountryLabel } from '../lib/phoneAuth';

type Props = {
  value: string;
  onChange: (countryName: string, country: CountryDial) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  countries?: CountryDial[];
};

const CountrySelectField: React.FC<Props> = ({
  value,
  onChange,
  label = 'Pays',
  hint,
  placeholder = 'Choisir un pays',
  countries = PHONE_AUTH_COUNTRIES,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const displayLabel = value ? resolveProfileCountryLabel(value) || value : placeholder;

  const selected =
    countries.find(
      (c) =>
        c.name === value ||
        c.name === resolveProfileCountryLabel(value) ||
        c.code === value?.trim().toUpperCase(),
    ) ?? null;

  const openPicker = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      setPickerOpen(true);
    });
  }, []);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.trigger}
        onPress={openPicker}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Ouvre la liste des pays"
      >
        {selected ? (
          <Text style={styles.flag}>{selected.flag}</Text>
        ) : (
          <Ionicons name="globe-outline" size={20} color="#666" />
        )}
        <Text style={[styles.triggerText, !value && styles.placeholder]}>{displayLabel}</Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </TouchableOpacity>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

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
              <Text style={styles.modalTitle}>Pays</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.list}
              renderItem={({ item }) => {
                const active =
                  item.name === value ||
                  item.name === resolveProfileCountryLabel(value) ||
                  item.code === value?.trim().toUpperCase();
                return (
                  <TouchableOpacity
                    style={[styles.countryRow, active && styles.countryRowActive]}
                    onPress={() => {
                      onChange(item.name, item);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <Text style={styles.countryName}>{item.name}</Text>
                    {active ? <Ionicons name="checkmark" size={20} color="#2E7D32" /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  trigger: {
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
  flag: { fontSize: 20 },
  triggerText: { flex: 1, fontSize: 16, color: '#333' },
  placeholder: { color: '#999' },
  hint: { fontSize: 12, color: '#6b7280' },
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
  list: { flexGrow: 0 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  countryRowActive: { backgroundColor: '#e8f5e9' },
  countryFlag: { fontSize: 22 },
  countryName: { fontSize: 16, color: '#374151', flex: 1 },
});

export default CountrySelectField;
