import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HostBooking } from '../types';
import InvoiceDisplay from './InvoiceDisplay';
import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import HostCancellationDialog from './HostCancellationDialog';
import { useBookingModifications } from '../hooks/useBookingModifications';
import HostModificationRequestCard from './HostModificationRequestCard';

interface HostBookingDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  booking: HostBooking | null;
}

const HostBookingDetailsModal: React.FC<HostBookingDetailsModalProps> = ({
  visible,
  onClose,
  booking,
}) => {
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [hostCancellationDialogVisible, setHostCancellationDialogVisible] = useState(false);
  const { getBookingPendingRequest } = useBookingModifications();
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  useEffect(() => {
    if (visible && booking) {
      loadPayment();
      loadPendingRequest();
    }
  }, [visible, booking]);

  const loadPendingRequest = async () => {
    if (!booking) return;
    setLoadingRequest(true);
    try {
      const request = await getBookingPendingRequest(booking.id);
      setPendingRequest(request);
    } catch (error) {
      console.error('Erreur lors du chargement de la demande de modification:', error);
    } finally {
      setLoadingRequest(false);
    }
  };

  const loadPayment = async () => {
    if (!booking) return;
    try {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPayment(data);
    } catch (error) {
      console.error('Erreur lors du chargement du paiement:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!booking) return;
    
    // Empêcher le téléchargement pour les réservations annulées
    if (booking.status === 'cancelled') {
      Alert.alert('Erreur', 'Impossible de télécharger la facture pour une réservation annulée.');
      return;
    }
    
    setDownloadingPDF(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'property_generate_host_pdf',
          data: {
            bookingId: booking.id,
            propertyTitle: booking.properties?.title || '',
            checkIn: booking.check_in_date,
            checkOut: booking.check_out_date,
            guestsCount: booking.guests_count,
            totalPrice: booking.total_price,
            pricePerNight: booking.properties?.price_per_night || 0,
            cleaningFee: booking.properties?.cleaning_fee || 0,
            serviceFee: booking.properties?.service_fee || 0,
            taxes: booking.properties?.taxes || 0,
            paymentMethod: payment?.payment_method || booking.payment_method,
            travelerName: booking.guest_profile 
              ? `${booking.guest_profile.first_name} ${booking.guest_profile.last_name}`.trim()
              : undefined,
            travelerEmail: booking.guest_profile?.email,
            travelerPhone: booking.guest_profile?.phone,
            discountApplied: booking.discount_applied,
            discountAmount: booking.discount_amount,
          }
        }
      });

      if (error) {
        console.error('❌ [HostBookingDetailsModal] Erreur génération PDF:', error);
        throw error;
      }

      console.log('📄 [HostBookingDetailsModal] Réponse PDF:', { hasPdf: !!data?.pdf, dataKeys: data ? Object.keys(data) : [] });

      if (data?.pdf) {
        try {
          // Sauvegarder le PDF dans un fichier temporaire
          const fileName = `justificatif-${booking.id.substring(0, 8)}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          
          console.log('💾 [HostBookingDetailsModal] Écriture fichier:', fileUri);
          
          await FileSystem.writeAsStringAsync(fileUri, data.pdf, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('✅ [HostBookingDetailsModal] Fichier écrit avec succès');
          
          // Vérifier que le fichier existe
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          console.log('📁 [HostBookingDetailsModal] Info fichier:', fileInfo);
          
          if (!fileInfo.exists) {
            throw new Error('Le fichier n\'a pas été créé');
          }
          
          // Partager le PDF
          const isAvailable = await Sharing.isAvailableAsync();
          console.log('📤 [HostBookingDetailsModal] Sharing disponible:', isAvailable);
          
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Partager le justificatif',
            });
            Alert.alert('Succès', 'Le justificatif a été généré. Vous pouvez le partager ou l\'enregistrer.');
          } else {
            // Fallback: ouvrir avec Linking
            const canOpen = await Linking.canOpenURL(fileUri);
            if (canOpen) {
              await Linking.openURL(fileUri);
            } else {
              Alert.alert('Succès', 'Le justificatif a été sauvegardé.');
            }
          }
        } catch (fileError: any) {
          console.error('❌ [HostBookingDetailsModal] Erreur fichier:', fileError);
          Alert.alert('Erreur', `Erreur lors de la sauvegarde: ${fileError.message}`);
        }
      } else {
        console.error('❌ [HostBookingDetailsModal] Pas de PDF dans la réponse');
        Alert.alert('Erreur', 'Le PDF n\'a pas pu être généré. Veuillez réessayer.');
      }
    } catch (error: any) {
      console.error('Erreur lors de la génération du PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF. Veuillez réessayer plus tard.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (!booking) return null;

  const isConfirmed = booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'in_progress';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Détails de réservation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {/* Demande de modification en attente */}
            {pendingRequest && (
              <View style={styles.modificationRequestSection}>
                <HostModificationRequestCard
                  request={pendingRequest}
                  guestName={booking.guest_profile 
                    ? `${booking.guest_profile.first_name} ${booking.guest_profile.last_name}`.trim()
                    : 'Voyageur'}
                  propertyTitle={booking.properties?.title || 'Propriété'}
                  onUpdated={() => {
                    loadPendingRequest();
                    onClose(); // Fermer le modal pour recharger la liste
                  }}
                />
              </View>
            )}

            {/* Informations de base */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Propriété</Text>
                <Text style={styles.infoValue}>{booking.properties?.title || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Voyageur</Text>
                <Text style={styles.infoValue}>
                  {booking.guest_profile 
                    ? `${booking.guest_profile.first_name} ${booking.guest_profile.last_name}`.trim()
                    : '-'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dates</Text>
                <Text style={styles.infoValue}>
                  {new Date(booking.check_in_date).toLocaleDateString('fr-FR')} - {new Date(booking.check_out_date).toLocaleDateString('fr-FR')}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Voyageurs</Text>
                <Text style={styles.infoValue}>{booking.guests_count}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Statut</Text>
                <Text style={styles.infoValue}>{booking.status}</Text>
              </View>
            </View>

            {/* Facture - uniquement pour les réservations confirmées ou terminées, pas annulées */}
            {isConfirmed && booking.status !== 'cancelled' && (
              <>
                <View style={styles.section}>
                  <InvoiceDisplay
                    type="host"
                    serviceType="property"
                    booking={booking}
                    pricePerUnit={booking.properties?.price_per_night || 0}
                    cleaningFee={booking.properties?.cleaning_fee || 0}
                    serviceFee={booking.properties?.service_fee}
                    taxes={booking.properties?.taxes}
                    paymentMethod={payment?.payment_method || booking.payment_method}
                    travelerName={booking.guest_profile 
                      ? `${booking.guest_profile.first_name} ${booking.guest_profile.last_name}`.trim()
                      : undefined}
                    travelerEmail={booking.guest_profile?.email}
                    travelerPhone={booking.guest_profile?.phone}
                    propertyOrVehicleTitle={booking.properties?.title}
                  />
                </View>

                {/* Bouton télécharger PDF - uniquement si confirmée ou terminée, pas annulée */}
                {isConfirmed && booking.status !== 'cancelled' && (
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={handleDownloadPDF}
                    disabled={downloadingPDF}
                  >
                    {downloadingPDF ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={20} color="#fff" />
                        <Text style={styles.downloadButtonText}>Télécharger le justificatif (PDF)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Bouton Annuler pour les réservations confirmées ou en cours */}
            {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setHostCancellationDialogVisible(true)}
              >
                <Ionicons name="close-circle-outline" size={20} color="#e74c3c" />
                <Text style={styles.cancelButtonText}>Annuler la réservation</Text>
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

      {/* Dialog d'annulation hôte */}
      {booking && (
        <HostCancellationDialog
          visible={hostCancellationDialogVisible}
          onClose={() => {
            setHostCancellationDialogVisible(false);
          }}
          booking={booking}
          onCancelled={() => {
            setHostCancellationDialogVisible(false);
            onClose();
          }}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    minHeight: '50%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    margin: 20,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeFooterButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    margin: 20,
    gap: 8,
  },
  cancelButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
  modificationRequestSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
});

export default HostBookingDetailsModal;

