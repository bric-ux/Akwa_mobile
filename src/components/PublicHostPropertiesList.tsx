import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type PublicHostProperty = {
  id: string;
  title: string;
  slug?: string | null;
  price_per_night?: number | null;
  images?: string[] | null;
  locations?: { name?: string } | null;
  property_photos?: Array<{ url: string; is_main?: boolean | null }> | null;
};

function getCover(property: PublicHostProperty): string | null {
  const photos = property.property_photos;
  if (photos?.length) {
    const main = photos.find((p) => p.is_main) ?? photos[0];
    if (main?.url) return main.url;
  }
  return property.images?.[0] ?? null;
}

interface PublicHostPropertiesListProps {
  properties: PublicHostProperty[];
  onSelect: (propertyId: string) => void;
}

export default function PublicHostPropertiesList({
  properties,
  onSelect,
}: PublicHostPropertiesListProps) {
  if (properties.length === 0) {
    return (
      <Text style={styles.empty}>Aucun logement public pour le moment.</Text>
    );
  }

  return (
    <View style={styles.list}>
      {properties.map((property) => {
        const cover = getCover(property);
        return (
          <TouchableOpacity
            key={property.id}
            style={styles.row}
            onPress={() => onSelect(property.id)}
            activeOpacity={0.75}
          >
            {cover ? (
              <Image source={{ uri: cover }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="home-outline" size={24} color="#9ca3af" />
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {property.title}
              </Text>
              {property.locations?.name ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {property.locations.name}
                </Text>
              ) : null}
              {property.price_per_night != null && property.price_per_night > 0 ? (
                <Text style={styles.price}>
                  {property.price_per_night.toLocaleString('fr-FR')} FCFA / nuit
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
  },
  thumbPlaceholder: {
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: '#333' },
  meta: { fontSize: 13, color: '#666', marginTop: 4 },
  price: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginTop: 6 },
  empty: { fontSize: 14, color: '#666', textAlign: 'center', paddingVertical: 16 },
});
