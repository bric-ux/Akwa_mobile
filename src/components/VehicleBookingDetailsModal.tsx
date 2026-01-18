import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VehicleBooking } from '../types';
import { getCommissionRates } from '../lib/commissions';
import { supabase } from '../services/supabase';
import { VEHICLE_COLORS } from '../constants/colors';

interface VehicleBookingDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  booking: VehicleBooking | null;
  isOwner?: boolean;
}

const VehicleBookingDetailsModal: React.FC<VehicleBookingDetailsModalProps> = ({
  visible,
  onClose,
  booking,
  isOwner = true,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!booking) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string; label: string; icon: string } } = {
      pending: { color: '#f59e0b', label: 'En attente', icon: 'time-outline' },
      confirmed: { color: '#10b981', label: 'Confirmée', icon: 'checkmark-circle-outline' },
      in_progress: { color: '#3b82f6', label: 'En cours', icon: 'checkmark-circle-outline' },
      cancelled: { color: '#ef4444', label: 'Annulée', icon: 'close-circle-outline' },
      completed: { color: '#2563eb', label: 'Terminée', icon: 'checkmark-circle-outline' },
    };

    const config = statusConfig[status] || { color: '#6b7280', label: status, icon: 'help-circle-outline' };
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon as any} size={16} color="#fff" />
        <Text style={styles.statusBadgeText}>{config.label}</Text>
      </View>
    );
  };

  const vehicle = booking.vehicle;
  const renter = booking.renter;
  const owner = vehicle?.owner;

  const commissionRates = getCommissionRates('vehicle');
  const basePrice = (booking.daily_rate || 0) * (booking.rental_days || 0);
  const renterServiceFee = Math.round(basePrice * (commissionRates.travelerFeePercent / 100));
  const ownerCommission = Math.round(basePrice * (commissionRates.hostFeePercent / 100));
  const ownerNetAmount = basePrice - ownerCommission;

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: isOwner ? 'vehicle_generate_owner_pdf' : 'vehicle_generate_renter_pdf',
          data: {
            bookingId: booking.id,
            vehicleTitle: `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim(),
            vehicleBrand: vehicle?.brand || '',
            vehicleModel: vehicle?.model || '',
            vehicleYear: vehicle?.year || '',
            fuelType: vehicle?.fuel_type || '',
            startDate: formatDate(booking.start_date),
            endDate: formatDate(booking.end_date),
            rentalDays: booking.rental_days,
            dailyRate: booking.daily_rate,
            totalPrice: booking.total_price,
            securityDeposit: booking.security_deposit || 0,
            renterName: `${renter?.first_name || ''} ${renter?.last_name || ''}`.trim(),
            renterEmail: renter?.email,
            renterPhone: renter?.phone,
            ownerName: `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim(),
            ownerEmail: owner?.email,
            ownerPhone: owner?.phone || '',
            pickupLocation: booking.pickup_location,
          }
        }
      });

      if (error) throw error;

      if (data?.pdf) {
        // Pour mobile, on ouvre le PDF dans le navigateur
        const base64Data = data.pdf;
        const pdfUrl = `data:application/pdf;base64,${base64Data}`;
        await Linking.openURL(pdfUrl);
        Alert.alert('Succès', 'La facture a été ouverte.');
      }
    } catch (error: any) {
      console.error('Erreur téléchargement PDF:', error);
      Alert.alert('Erreur', 'Impossible de télécharger la facture.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewLicenseDocument = async (documentUrl: string) => {
    try {
      await Linking.openURL(documentUrl);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le document.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="document-text-outline" size={24} color="#1e293b" />
              <Text style={styles.headerTitle}>Détails de la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.bookingId}>Réservation #{booking.id?.slice(0, 8)}</Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Statut */}
            <View style={styles.section}>
              {getStatusBadge(booking.status)}
            </View>

            {/* Véhicule */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="car-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>Véhicule</Text>
              </View>
              <View style={styles.vehicleInfo}>
                {vehicle?.images?.[0] && (
                  <Image
                    source={{ uri: vehicle.images[0] }}
                    style={styles.vehicleImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.vehicleDetails}>
                  <Text style={styles.vehicleName}>
                    {vehicle?.brand} {vehicle?.model}
                  </Text>
                  <Text style={styles.vehicleYear}>
                    {vehicle?.year} • {vehicle?.fuel_type}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dates */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>Période de location</Text>
              </View>
              <View style={styles.dateGrid}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Début</Text>
                  <Text style={styles.dateValue}>{formatDate(booking.start_date)}</Text>
                </View>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Fin</Text>
                  <Text style={styles.dateValue}>{formatDate(booking.end_date)}</Text>
                </View>
              </View>
              <View style={styles.separator} />
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>Durée</Text>
                <Text style={styles.durationValue}>
                  {booking.rental_days} jour{booking.rental_days > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Client/Locataire ou Propriétaire */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>{isOwner ? 'Locataire' : 'Propriétaire'}</Text>
              </View>
              <View style={styles.personInfo}>
                <View style={styles.avatarContainer}>
                  {(isOwner ? renter?.avatar_url : owner?.avatar_url) ? (
                    <Image
                      source={{ uri: isOwner ? renter?.avatar_url : owner?.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#9ca3af" />
                    </View>
                  )}
                </View>
                <View style={styles.personDetails}>
                  <Text style={styles.personName}>
                    {isOwner
                      ? `${renter?.first_name || ''} ${renter?.last_name || ''}`.trim() || 'Locataire'
                      : `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || 'Propriétaire'}
                  </Text>
                  {(isOwner ? renter?.email : (owner?.email && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed'))) && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={16} color="#6b7280" />
                      <Text style={styles.contactText}>
                        {isOwner ? renter?.email : owner?.email}
                      </Text>
                    </View>
                  )}
                  {(isOwner ? renter?.phone : (owner?.phone && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed'))) && (
                    <View style={styles.contactRow}>
                      <Ionicons name="call-outline" size={16} color="#6b7280" />
                      <Text style={styles.contactText}>
                        {isOwner ? renter?.phone : owner?.phone}
                      </Text>
                    </View>
                  )}
                  {!isOwner && booking.status !== 'confirmed' && booking.status !== 'in_progress' && booking.status !== 'completed' && (
                    <Text style={styles.infoText}>
                      Les coordonnées du propriétaire seront disponibles après confirmation de la réservation
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Informations permis de conduire */}
            {(booking.has_license !== undefined || booking.license_document_url || booking.license_documents?.length > 0) && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="document-text-outline" size={20} color="#1e293b" />
                  <Text style={styles.cardTitle}>Permis de conduire</Text>
                </View>
                <View style={styles.licenseInfo}>
                  {booking.has_license !== undefined && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Possède un permis</Text>
                      <Text style={styles.infoValue}>{booking.has_license ? 'Oui' : 'Non'}</Text>
                    </View>
                  )}
                  {booking.license_years && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Années de permis</Text>
                      <Text style={styles.infoValue}>{booking.license_years} an(s)</Text>
                    </View>
                  )}
                  {booking.license_number && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Numéro de permis</Text>
                      <Text style={styles.infoValue}>{booking.license_number}</Text>
                    </View>
                  )}
                  
                  {/* Document du permis - visible uniquement pour le propriétaire */}
                  {isOwner && (booking.license_document_url || booking.license_documents?.length > 0) && (
                    <>
                      <View style={styles.separator} />
                      <Text style={styles.documentLabel}>Document du permis</Text>
                      {(() => {
                        const licenseDoc = booking.license_documents?.[0];
                        const documentUrl = licenseDoc?.document_url || booking.license_document_url;
                        
                        if (!documentUrl) return null;
                        
                        return (
                          <View style={styles.documentContainer}>
                            <View style={styles.documentInfo}>
                              <Ionicons name="document-text-outline" size={20} color={VEHICLE_COLORS.primary} />
                              <View style={styles.documentDetails}>
                                <Text style={styles.documentName}>Permis de conduire</Text>
                                <Text style={styles.documentSubtext}>
                                  Document téléchargé par le locataire
                                  {licenseDoc?.verified && (
                                    <Text style={styles.verifiedText}> ✓ Vérifié</Text>
                                  )}
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.viewDocumentButton}
                              onPress={() => handleViewLicenseDocument(documentUrl)}
                            >
                              <Ionicons name="eye-outline" size={18} color={VEHICLE_COLORS.primary} />
                              <Text style={styles.viewDocumentText}>Voir</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Message */}
            {booking.message_to_owner && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="chatbubble-outline" size={20} color="#1e293b" />
                  <Text style={styles.cardTitle}>Message</Text>
                </View>
                <Text style={styles.messageText}>{booking.message_to_owner}</Text>
              </View>
            )}

            {/* Récapitulatif financier */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="cash-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>Récapitulatif financier</Text>
              </View>
              {isOwner ? (
                <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      {booking.daily_rate?.toLocaleString()} XOF × {booking.rental_days} jours
                    </Text>
                    <Text style={styles.priceValue}>{basePrice.toLocaleString()} XOF</Text>
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      Commission Akwahome ({commissionRates.hostFeePercent}%)
                    </Text>
                    <Text style={[styles.priceValue, styles.commissionText]}>
                      -{ownerCommission.toLocaleString()} XOF
                    </Text>
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.netRow}>
                    <Text style={styles.netLabel}>Votre gain net</Text>
                    <Text style={styles.netValue}>{ownerNetAmount.toLocaleString()} XOF</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      {booking.daily_rate?.toLocaleString()} XOF × {booking.rental_days} jours
                    </Text>
                    <Text style={styles.priceValue}>{basePrice.toLocaleString()} XOF</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Frais de service Akwahome</Text>
                    <Text style={styles.priceValue}>{renterServiceFee.toLocaleString()} XOF</Text>
                  </View>
                  {booking.security_deposit > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Caution (remboursable)</Text>
                      <Text style={styles.priceValue}>
                        {booking.security_deposit?.toLocaleString()} XOF
                      </Text>
                    </View>
                  )}
                  <View style={styles.separator} />
                  <View style={styles.netRow}>
                    <Text style={styles.netLabel}>Total</Text>
                    <Text style={styles.netValue}>
                      {(basePrice + renterServiceFee + (booking.security_deposit || 0)).toLocaleString()} XOF
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Bouton télécharger PDF - uniquement pour les réservations confirmées/terminées */}
            {(booking.status === 'confirmed' || booking.status === 'completed') && (
              <TouchableOpacity
                style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                onPress={handleDownloadPDF}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#1e293b" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#1e293b" />
                    <Text style={styles.downloadButtonText}>Télécharger la facture PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
              <Text style={styles.closeFooterButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  bookingId: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  vehicleInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleImage: {
    width: 80,
    height: 64,
    borderRadius: 8,
  },
  vehicleDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  vehicleYear: {
    fontSize: 14,
    color: '#6b7280',
  },
  dateGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  personInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  licenseInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginTop: 8,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  documentDetails: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  documentSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  verifiedText: {
    color: '#10b981',
    fontWeight: '600',
  },
  viewDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: VEHICLE_COLORS.primary,
  },
  viewDocumentText: {
    fontSize: 14,
    fontWeight: '500',
    color: VEHICLE_COLORS.primary,
  },
  messageText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#fff',
    gap: 8,
    marginTop: 16,
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  commissionText: {
    color: '#ef4444',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  netLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  netValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeFooterButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleBookingDetailsModal;

