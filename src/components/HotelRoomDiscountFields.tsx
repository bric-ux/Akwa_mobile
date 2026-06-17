import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { HOTEL_COLORS } from '../constants/colors';

export interface HotelRoomDiscountValues {
  discount_enabled: boolean;
  discount_min_nights: string;
  discount_percentage: string;
  long_stay_discount_enabled: boolean;
  long_stay_discount_min_nights: string;
  long_stay_discount_percentage: string;
}

export const emptyHotelRoomDiscounts = (): HotelRoomDiscountValues => ({
  discount_enabled: false,
  discount_min_nights: '',
  discount_percentage: '',
  long_stay_discount_enabled: false,
  long_stay_discount_min_nights: '',
  long_stay_discount_percentage: '',
});

export function hotelRoomDiscountsFromRoom(room: {
  discount_enabled?: boolean;
  discount_min_nights?: number | null;
  discount_percentage?: number | null;
  long_stay_discount_enabled?: boolean;
  long_stay_discount_min_nights?: number | null;
  long_stay_discount_percentage?: number | null;
}): HotelRoomDiscountValues {
  return {
    discount_enabled: Boolean(room.discount_enabled),
    discount_min_nights: room.discount_min_nights != null ? String(room.discount_min_nights) : '',
    discount_percentage: room.discount_percentage != null ? String(room.discount_percentage) : '',
    long_stay_discount_enabled: Boolean(room.long_stay_discount_enabled),
    long_stay_discount_min_nights:
      room.long_stay_discount_min_nights != null ? String(room.long_stay_discount_min_nights) : '',
    long_stay_discount_percentage:
      room.long_stay_discount_percentage != null ? String(room.long_stay_discount_percentage) : '',
  };
}

export function parseHotelRoomDiscounts(values: HotelRoomDiscountValues): {
  discount_enabled: boolean;
  discount_min_nights: number | null;
  discount_percentage: number | null;
  long_stay_discount_enabled: boolean;
  long_stay_discount_min_nights: number | null;
  long_stay_discount_percentage: number | null;
} {
  const parseOptionalInt = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const parsePct = (s: string) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  };

  return {
    discount_enabled: values.discount_enabled,
    discount_min_nights: values.discount_enabled ? parseOptionalInt(values.discount_min_nights) : null,
    discount_percentage: values.discount_enabled ? parsePct(values.discount_percentage) : null,
    long_stay_discount_enabled: values.long_stay_discount_enabled,
    long_stay_discount_min_nights: values.long_stay_discount_enabled
      ? parseOptionalInt(values.long_stay_discount_min_nights)
      : null,
    long_stay_discount_percentage: values.long_stay_discount_enabled
      ? parsePct(values.long_stay_discount_percentage)
      : null,
  };
}

interface Props {
  values: HotelRoomDiscountValues;
  onChange: (values: HotelRoomDiscountValues) => void;
}

const SwitchRow: React.FC<{ label: string; value: boolean; onToggle: () => void }> = ({
  label,
  value,
  onToggle,
}) => (
  <TouchableOpacity style={styles.switchRow} onPress={onToggle} activeOpacity={0.8}>
    <View style={[styles.switch, value && styles.switchOn]}>
      <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
    </View>
    <Text style={styles.switchLabel}>{label}</Text>
  </TouchableOpacity>
);

const HotelRoomDiscountFields: React.FC<Props> = ({ values, onChange }) => {
  const set = (patch: Partial<HotelRoomDiscountValues>) => onChange({ ...values, ...patch });

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>Réductions par durée</Text>
      <Text style={styles.hint}>Incitez les séjours plus longs avec des tarifs dégressifs.</Text>

      <SwitchRow
        label="Réduction séjour (nuits minimum)"
        value={values.discount_enabled}
        onToggle={() => set({ discount_enabled: !values.discount_enabled })}
      />
      {values.discount_enabled ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>À partir de (nuits)</Text>
            <TextInput
              style={styles.input}
              value={values.discount_min_nights}
              onChangeText={(v) => set({ discount_min_nights: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
              placeholder="3"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Réduction (%)</Text>
            <TextInput
              style={styles.input}
              value={values.discount_percentage}
              onChangeText={(v) => set({ discount_percentage: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
              placeholder="10"
            />
          </View>
        </View>
      ) : null}

      <SwitchRow
        label="Réduction long séjour"
        value={values.long_stay_discount_enabled}
        onToggle={() => set({ long_stay_discount_enabled: !values.long_stay_discount_enabled })}
      />
      {values.long_stay_discount_enabled ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>À partir de (nuits)</Text>
            <TextInput
              style={styles.input}
              value={values.long_stay_discount_min_nights}
              onChangeText={(v) => set({ long_stay_discount_min_nights: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
              placeholder="7"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Réduction (%)</Text>
            <TextInput
              style={styles.input}
              value={values.long_stay_discount_percentage}
              onChangeText={(v) => set({ long_stay_discount_percentage: v.replace(/\D/g, '') })}
              keyboardType="number-pad"
              placeholder="15"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: HOTEL_COLORS.primary },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  col: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});

export default HotelRoomDiscountFields;
