import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AdminRecentBookingDetailsModal from './AdminRecentBookingDetailsModal';
import type { AdminRecentBookingItem } from '../../hooks/useAdmin';
import type { RootStackParamList } from '../../types';

type Props = {
  items: AdminRecentBookingItem[];
  limit?: number;
  emptyMessage?: string;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(price);

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'confirmed':
      return { bg: '#dcfce7', color: '#166534', label: 'Confirmée' };
    case 'pending':
      return { bg: '#fef3c7', color: '#92400e', label: 'En attente' };
    case 'cancelled':
      return { bg: '#fee2e2', color: '#991b1b', label: 'Annulée' };
    case 'completed':
      return { bg: '#dbeafe', color: '#1e40af', label: 'Terminée' };
    default:
      return { bg: '#f1f5f9', color: '#475569', label: status };
  }
};

const getTitle = (item: AdminRecentBookingItem) => {
  if (item.kind === 'property') {
    return item.booking.property?.title || 'Logement';
  }
  const v = item.booking.vehicle;
  return `${v?.brand || ''} ${v?.model || ''}`.trim() || v?.title || 'Véhicule';
};

const getGuestLabel = (item: AdminRecentBookingItem) => {
  if (item.kind === 'property') {
    const g = item.booking.guest;
    return `Voyageur : ${g?.first_name || ''} ${g?.last_name || ''}`.trim();
  }
  const r = item.booking.renter;
  return `Locataire : ${r?.first_name || ''} ${r?.last_name || ''}`.trim();
};

const AdminRecentBookingsSection: React.FC<Props> = ({
  items,
  limit = 8,
  emptyMessage = 'Aucune réservation récente',
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedItem, setSelectedItem] = useState<AdminRecentBookingItem | null>(null);

  const visibleItems = items.slice(0, limit);

  if (visibleItems.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.list}>
        {visibleItems.map((item) => {
          const statusStyle = getStatusStyle(item.booking.status || '');
          const listingId =
            item.kind === 'property'
              ? item.booking.property?.id
              : item.booking.vehicle?.id;

          return (
            <View key={`${item.kind}-${item.booking.id}`} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => setSelectedItem(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.kindBadge,
                      item.kind === 'vehicle' ? styles.kindBadgeVehicle : styles.kindBadgeProperty,
                    ]}
                  >
                    <Ionicons
                      name={item.kind === 'vehicle' ? 'car-outline' : 'home-outline'}
                      size={12}
                      color={item.kind === 'vehicle' ? '#047857' : '#166534'}
                    />
                    <Text
                      style={[
                        styles.kindBadgeText,
                        item.kind === 'vehicle' ? styles.kindBadgeTextVehicle : styles.kindBadgeTextProperty,
                      ]}
                    >
                      {item.kind === 'vehicle' ? 'Véhicule' : 'Logement'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                  {getTitle(item)}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {getGuestLabel(item)}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
                  <Text style={styles.price}>{formatPrice(item.booking.total_price || 0)}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setSelectedItem(item)}
                >
                  <Ionicons name="eye-outline" size={16} color="#334155" />
                  <Text style={styles.actionButtonText}>Détails</Text>
                </TouchableOpacity>
                {listingId ? (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() =>
                      item.kind === 'property'
                        ? navigation.navigate('PropertyDetails', { propertyId: listingId })
                        : navigation.navigate('VehicleDetails', { vehicleId: listingId })
                    }
                  >
                    <Ionicons name="open-outline" size={16} color="#334155" />
                    <Text style={styles.actionButtonText}>
                      {item.kind === 'vehicle' ? 'Voir le véhicule' : 'Voir le logement'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <AdminRecentBookingDetailsModal
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onViewProperty={(propertyId) => {
          setSelectedItem(null);
          navigation.navigate('PropertyDetails', { propertyId });
        }}
        onViewVehicle={(vehicleId) => {
          setSelectedItem(null);
          navigation.navigate('VehicleDetails', { vehicleId });
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  list: {
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardMain: {
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kindBadgeProperty: {
    backgroundColor: '#dcfce7',
  },
  kindBadgeVehicle: {
    backgroundColor: '#d1fae5',
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  kindBadgeTextProperty: {
    color: '#166534',
  },
  kindBadgeTextVehicle: {
    color: '#047857',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 12,
    color: '#94a3b8',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  emptyWrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});

export default AdminRecentBookingsSection;
