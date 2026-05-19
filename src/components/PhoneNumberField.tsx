import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHONE_AUTH_COUNTRIES, type CountryDial } from '../lib/phoneAuth';

type Props = {
  dial: string;
  local: string;
  onDialChange: (dial: string) => void;
  onLocalChange: (local: string) => void;
  countries?: CountryDial[];
};

const PhoneNumberField: React.FC<Props> = ({
  dial,
  local,
  onDialChange,
  onLocalChange,
  countries = PHONE_AUTH_COUNTRIES,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = countries.find((c) => c.dial === dial) ?? countries.find((c) => c.code === 'CI')!;

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.dialButton} onPress={() => setPickerOpen(true)}>
        <Text style={styles.dialFlag}>{selected.flag}</Text>
        <Text style={styles.dialText}>{selected.dial}</Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>
      <TextInput
        style={styles.localInput}
        value={local}
        onChangeText={onLocalChange}
        placeholder="07 00 00 00 00"
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholderTextColor="#999"
      />

      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pays / indicatif</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countries}
              keyExtractor={(item) => item.code}
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
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
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
  },
  dialFlag: { fontSize: 18 },
  dialText: { fontSize: 15, fontWeight: '600', color: '#333' },
  localInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
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
    maxHeight: '70%',
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
