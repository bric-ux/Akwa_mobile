import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type PublicOwnerVehicle = {
  id: string;
  title?: string | null;
  brand?: string | null;
  model?: string | null;
  price_per_day?: number | null;
  images?: string[] | null;
};

function vehicleLabel(v: PublicOwnerVehicle) {
  if (v.title?.trim()) return v.title.trim();
  if (v.brand && v.model) return `${v.brand} ${v.model}`;
  return 'Véhicule';
}

interface PublicOwnerVehiclesListProps {
  vehicles: PublicOwnerVehicle[];
  onSelect: (vehicleId: string) => void;
}

export default function PublicOwnerVehiclesList({
  vehicles,
  onSelect,
}: PublicOwnerVehiclesListProps) {
  if (vehicles.length === 0) {
    return (
      <Text style={styles.empty}>Aucun véhicule public pour le moment.</Text>
    );
  }

  return (
    <View style={styles.list}>
      {vehicles.map((vehicle) => {
        const cover = vehicle.images?.[0];
        return (
          <TouchableOpacity
            key={vehicle.id}
            style={styles.row}
            onPress={() => onSelect(vehicle.id)}
            activeOpacity={0.75}
          >
            {cover ? (
              <Image source={{ uri: cover }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="car-outline" size={24} color="#9ca3af" />
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {vehicleLabel(vehicle)}
              </Text>
              {vehicle.price_per_day != null && vehicle.price_per_day > 0 ? (
                <Text style={styles.price}>
                  {vehicle.price_per_day.toLocaleString('fr-FR')} FCFA / jour
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2563eb" />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
  },
  thumbPlaceholder: {
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  price: { fontSize: 14, fontWeight: '600', color: '#2563eb', marginTop: 6 },
  empty: { fontSize: 14, color: '#666', textAlign: 'center', paddingVertical: 16 },
});
