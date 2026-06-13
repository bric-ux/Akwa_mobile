import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MediaThumb from '../MediaThumb';
import { getPropertyCoverUrl, getVehicleCoverUrl, isVideoUrl } from '../../utils/media';
import type { AdminRecentBookingItem } from '../../hooks/useAdmin';

type Props = {
  item: AdminRecentBookingItem | null;
  visible: boolean;
  onClose: () => void;
  onViewProperty: (propertyId: string) => void;
  onViewVehicle: (vehicleId: string) => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPrice = (price?: number | null) =>
  typeof price === 'number'
    ? new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
      }).format(price)
    : '—';

const getReference = (item: AdminRecentBookingItem) => {
  if (item.kind === 'vehicle') {
    return item.booking.vehicle_booking_code || item.booking.id?.slice(0, 8) || '—';
  }
  return item.booking.booking_code || item.booking.id?.slice(0, 8) || '—';
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'confirmed':
      return { bg: '#22c55e', label: 'Confirmée' };
    case 'pending':
      return { bg: '#f59e0b', label: 'En attente' };
    case 'cancelled':
      return { bg: '#ef4444', label: 'Annulée' };
    case 'completed':
      return { bg: '#3b82f6', label: 'Terminée' };
    case 'in_progress':
      return { bg: '#3b82f6', label: 'En cours' };
    default:
      return { bg: '#64748b', label: status };
  }
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#64748b" />
      <View style={styles.infoRowText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ContactSection({
  title,
  person,
}: {
  title: string;
  person?: { first_name?: string; last_name?: string; email?: string; phone?: string };
}) {
  if (!person) return null;
  const name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
  if (!name && !person.email && !person.phone) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!name && <Text style={styles.contactName}>{name}</Text>}
      {!!person.email && (
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${person.email}`)}>
          <Text style={styles.contactLink}>{person.email}</Text>
        </TouchableOpacity>
      )}
      {!!person.phone && (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${person.phone}`)}>
          <Text style={styles.contactLink}>{person.phone}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const AdminRecentBookingDetailsModal: React.FC<Props> = ({
  item,
  visible,
  onClose,
  onViewProperty,
  onViewVehicle,
}) => {
  const insets = useSafeAreaInsets();
  const topInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : insets.top;

  if (!item) return null;

  const booking = item.booking;
  const statusStyle = getStatusStyle(booking.status || '');
  const reference = getReference(item);

  let coverUri: string | null = null;
  let title = '';
  let listingId: string | null = null;
  let listingLabel = '';
  let onViewListing: (() => void) | null = null;

  if (item.kind === 'property') {
    const property = booking.property;
    coverUri = property ? getPropertyCoverUrl(property) : null;
    title = property?.title || 'Logement';
    listingId = property?.id || null;
    listingLabel = 'Voir le logement';
    if (listingId) onViewListing = () => onViewProperty(listingId!);
  } else {
    const vehicle = booking.vehicle;
    coverUri = vehicle ? getVehicleCoverUrl(vehicle) : null;
    title =
      `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() ||
      vehicle?.title ||
      'Véhicule';
    listingId = vehicle?.id || null;
    listingLabel = 'Voir le véhicule';
    if (listingId) onViewListing = () => onViewVehicle(listingId!);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.header, { paddingTop: Math.max(topInset, 12) }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {item.kind === 'vehicle' ? 'Réservation véhicule' : 'Réservation logement'}
          </Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          {coverUri ? (
            <TouchableOpacity
              style={styles.coverWrap}
              onPress={onViewListing || undefined}
              disabled={!onViewListing}
            >
              <MediaThumb
                uri={coverUri}
                style={styles.cover}
                resizeMode="cover"
                isVideo={isVideoUrl(coverUri)}
              />
              {onViewListing && (
                <View style={styles.coverOverlay}>
                  <Text style={styles.coverOverlayText}>Voir l'annonce</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={styles.heroMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={styles.statusBadgeText}>{statusStyle.label}</Text>
            </View>
            <Text style={styles.reference}>#{reference}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          {onViewListing && (
            <TouchableOpacity style={styles.viewListingButton} onPress={onViewListing}>
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.viewListingButtonText}>{listingLabel}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Récapitulatif</Text>
            {item.kind === 'property' ? (
              <>
                <InfoRow
                  icon="calendar-outline"
                  label="Dates"
                  value={`${formatDate(booking.check_in_date)} → ${formatDate(booking.check_out_date)}`}
                />
                <InfoRow
                  icon="people-outline"
                  label="Voyageurs"
                  value={String(booking.guests_count ?? '—')}
                />
              </>
            ) : (
              <InfoRow
                icon="calendar-outline"
                label="Dates"
                value={`${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}`}
              />
            )}
            <InfoRow icon="cash-outline" label="Total" value={formatPrice(booking.total_price)} />
            {!!booking.payment_method && (
              <InfoRow icon="card-outline" label="Paiement" value={booking.payment_method} />
            )}
            <Text style={styles.createdAt}>Créée le {formatDateTime(booking.created_at)}</Text>
          </View>

          {item.kind === 'property' ? (
            <>
              <ContactSection title="Voyageur" person={booking.guest} />
              <ContactSection title="Hôte" person={booking.property?.host} />
            </>
          ) : (
            <>
              <ContactSection title="Locataire" person={booking.renter} />
              <ContactSection title="Propriétaire" person={booking.vehicle?.owner} />
            </>
          )}

          {!!booking.special_requests && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Demandes spéciales</Text>
              <Text style={styles.specialRequests}>{booking.special_requests}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  content: {
    padding: 16,
  },
  coverWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cover: {
    width: '100%',
    height: 180,
  },
  coverOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  coverOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  reference: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  viewListingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  viewListingButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  infoRowText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  createdAt: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  contactLink: {
    fontSize: 14,
    color: '#2563eb',
    marginBottom: 4,
  },
  specialRequests: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});

export default AdminRecentBookingDetailsModal;
