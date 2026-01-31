import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VehicleBooking } from '../types';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

interface VehicleCancellationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: VehicleBooking | null;
  isOwner: boolean;
  onCancelled: () => void;
}

const cancellationReasons = [
  { value: 'change_plans', label: 'Changement de plans' },
  { value: 'vehicle_unavailable', label: 'Véhicule non disponible' },
  { value: 'maintenance', label: 'Maintenance du véhicule' },
  { value: 'emergency', label: 'Urgence' },
  { value: 'found_alternative', label: "J'ai trouvé une alternative" },
  { value: 'financial_reasons', label: 'Raisons financières' },
  { value: 'family_emergency', label: 'Urgence familiale' },
  { value: 'other', label: 'Autre raison' },
];

const VehicleCancellationModal: React.FC<VehicleCancellationModalProps> = ({
  visible,
  onClose,
  booking,
  isOwner,
  onCancelled,
}) => {
  const { user } = useAuth();
  const { updateBookingStatus } = useVehicleBookings();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  if (!booking) return null;

  const isBookingCompleted = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  };

  const bookingIsCompleted = isBookingCompleted();

  const calculatePenalty = () => {
    // Pour les demandes en attente (pending), pas de pénalité car le paiement n'a pas encore été effectué
    if (booking.status === 'pending') {
      return { 
        penalty: 0, 
        penaltyDescription: 'Aucune pénalité (demande en attente)', 
        refundAmount: 0 
      };
    }

    const now = new Date();
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
    
    // Normaliser les dates pour les comparaisons
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(0, 0, 0, 0);
    
    // Calculer les heures et jours jusqu'au début
    const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysUntilStart = Math.ceil(hoursUntilStart / 24);
    
    // Vérifier si la réservation est en cours
    const isInProgress = startDateNormalized <= today && today <= endDateNormalized;
    
    // Calculer le prix des jours
    const rentalDays = booking.rental_days || 0;
    const rentalHours = booking.rental_hours || 0;
    const daysPrice = (booking.daily_rate || 0) * rentalDays;
    
    // Calculer le prix des heures supplémentaires si applicable
    let hoursPrice = 0;
    if (rentalHours > 0 && booking.vehicle?.hourly_rental_enabled && booking.vehicle?.price_per_hour) {
      hoursPrice = rentalHours * booking.vehicle.price_per_hour;
    }
    
    // Prix de base = prix des jours + prix des heures
    const basePrice = daysPrice + hoursPrice;
    const dailyRate = booking.daily_rate || (daysPrice / (rentalDays || 1));

    if (isInProgress) {
      // Annulation EN COURS de location
      const totalDays = booking.rental_days || 0;
      const daysElapsed = Math.max(0, Math.floor((today.getTime() - startDateNormalized.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingDays = Math.max(0, totalDays - daysElapsed - 1); // -1 car aujourd'hui est déjà entamé
      const remainingDaysAmount = remainingDays * dailyRate;
      
      if (isOwner) {
        // Propriétaire annule en cours : 50% de pénalité sur les jours restants, locataire remboursé 100%
        const penalty = Math.round(remainingDaysAmount * 0.50);
        return { 
          penalty, 
          penaltyDescription: `Annulation en cours de location (50% de pénalité sur ${remainingDays} jour(s) restant(s))`, 
          refundAmount: remainingDaysAmount // Locataire remboursé 100% des jours restants
        };
      } else {
        // Locataire annule en cours : 50% de pénalité sur les jours restants
        const penalty = Math.round(remainingDaysAmount * 0.50);
        return { 
          penalty, 
          penaltyDescription: `Annulation en cours de location (50% de pénalité sur ${remainingDays} jour(s) restant(s))`, 
          refundAmount: Math.round(remainingDaysAmount * 0.50) // Remboursement de 50% des jours restants
        };
      }
    } else if (hoursUntilStart <= 0) {
      // La date de début est passée mais ce n'est pas en cours (cas edge)
      const penalty = Math.round(basePrice * 0.50);
      return { 
        penalty, 
        penaltyDescription: 'La location a déjà commencé', 
        refundAmount: Math.round(basePrice * 0.50) 
      };
    } else if (isOwner) {
      // PROPRIÉTAIRE annule (avant le début)
      if (daysUntilStart > 28) {
        return { 
          penalty: 0, 
          penaltyDescription: 'Annulation gratuite (plus de 28 jours avant)', 
          refundAmount: basePrice // Locataire toujours remboursé 100%
        };
      } else if (daysUntilStart > 7) {
        const penalty = Math.round(basePrice * 0.20);
        return { 
          penalty, 
          penaltyDescription: 'Annulation entre 7 et 28 jours avant (20% de pénalité)', 
          refundAmount: basePrice // Locataire toujours remboursé 100%
        };
      } else if (hoursUntilStart > 48) {
        const penalty = Math.round(basePrice * 0.40);
        return { 
          penalty, 
          penaltyDescription: 'Annulation entre 48h et 7 jours avant (40% de pénalité)', 
          refundAmount: basePrice // Locataire toujours remboursé 100%
        };
      } else {
        const penalty = Math.round(basePrice * 0.50);
        return { 
          penalty, 
          penaltyDescription: 'Annulation 48h ou moins avant le départ (50% de pénalité)', 
          refundAmount: basePrice // Locataire toujours remboursé 100%
        };
      }
    } else {
      // LOCATAIRE annule (avant le début)
      if (daysUntilStart > 7) {
        return { 
          penalty: 0, 
          penaltyDescription: 'Annulation gratuite (plus de 7 jours avant)', 
          refundAmount: basePrice 
        };
      } else if (daysUntilStart > 3) {
        const penalty = Math.round(basePrice * 0.15);
        return { 
          penalty, 
          penaltyDescription: 'Annulation entre 3 et 7 jours avant (15% de pénalité)', 
          refundAmount: basePrice - penalty 
        };
      } else if (hoursUntilStart > 24) {
        const penalty = Math.round(basePrice * 0.30);
        return { 
          penalty, 
          penaltyDescription: 'Annulation entre 24h et 3 jours avant (30% de pénalité)', 
          refundAmount: basePrice - penalty 
        };
      } else {
        const penalty = Math.round(basePrice * 0.50);
        return { 
          penalty, 
          penaltyDescription: 'Annulation 24h ou moins avant le départ (50% de pénalité)', 
          refundAmount: basePrice - penalty 
        };
      }
    }
  };

  const { penalty, penaltyDescription, refundAmount } = calculatePenalty();

  const handleCancel = async () => {
    if (bookingIsCompleted) {
      Alert.alert('Annulation impossible', 'Cette réservation est terminée et ne peut plus être annulée.');
      return;
    }

    if (!selectedReason || !user) {
      Alert.alert('Erreur', 'Veuillez sélectionner une cause d\'annulation');
      return;
    }

    setIsConfirming(true);

    try {
      const reasonLabel = cancellationReasons.find((r) => r.value === selectedReason)?.label || selectedReason;
      const fullReason = reason.trim() ? `${reasonLabel}: ${reason.trim()}` : reasonLabel;

      // Récupérer les informations complètes de la réservation pour les emails
      const { data: bookingData, error: bookingFetchError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles(
            brand,
            model,
            owner_id
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', booking.id)
        .single();

      if (bookingFetchError) {
        throw bookingFetchError;
      }

      // Mettre à jour le statut via Supabase directement
      const { error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: `[Annulé par ${isOwner ? 'le propriétaire' : 'le locataire'}] ${fullReason}`,
          cancellation_penalty: penalty,
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      // Envoyer les emails de notification
      try {
        const vehicleTitle = bookingData?.vehicle 
          ? `${bookingData.vehicle.brand || ''} ${bookingData.vehicle.model || ''}`.trim() 
          : 'Véhicule';
        
        const startDateFormatted = new Date(booking.start_date).toLocaleDateString('fr-FR');
        const endDateFormatted = new Date(booking.end_date).toLocaleDateString('fr-FR');

        // Email à l'autre partie ET au locataire qui annule
        if (isOwner && bookingData?.renter?.email) {
          // Propriétaire annule → Email au locataire
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_booking_cancelled_by_owner',
              to: bookingData.renter.email,
              data: {
                renterName: bookingData.renter.first_name || 'Cher client',
                vehicleTitle: vehicleTitle,
                startDate: startDateFormatted,
                endDate: endDateFormatted,
                reason: fullReason,
                refundAmount: refundAmount, // Utiliser le refundAmount calculé (toujours 100% pour le locataire)
              }
            }
          });
        } else if (!isOwner) {
          // Locataire annule → Email au propriétaire
          if (bookingData?.vehicle?.owner_id) {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('email, first_name')
              .eq('user_id', bookingData.vehicle.owner_id)
              .single();
              
            if (ownerProfile?.email) {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'vehicle_booking_cancelled_by_renter',
                  to: ownerProfile.email,
                  data: {
                    ownerName: ownerProfile.first_name || 'Cher propriétaire',
                    vehicleTitle: vehicleTitle,
                    startDate: startDateFormatted,
                    endDate: endDateFormatted,
                    reason: fullReason,
                    penaltyAmount: penalty,
                  }
                }
              });
            }
          }
          
          // Email au locataire qui annule (confirmation de son annulation)
          if (bookingData?.renter?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_booking_cancelled_by_renter_confirmation',
                to: bookingData.renter.email,
                data: {
                  renterName: bookingData.renter.first_name || 'Cher client',
                  vehicleTitle: vehicleTitle,
                  startDate: startDateFormatted,
                  endDate: endDateFormatted,
                  reason: fullReason,
                  penaltyAmount: penalty,
                  refundAmount: refundAmount, // Utiliser le refundAmount calculé
                }
              }
            });
          }
        }

        // Email à l'admin
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'vehicle_booking_cancelled_admin',
            to: 'contact@akwahome.com',
            data: {
              bookingId: booking.id,
              vehicleTitle: vehicleTitle,
              cancelledBy: isOwner ? 'propriétaire' : 'locataire',
              renterName: bookingData?.renter ? `${bookingData.renter.first_name || ''} ${bookingData.renter.last_name || ''}`.trim() : 'N/A',
              startDate: startDateFormatted,
              endDate: endDateFormatted,
              reason: fullReason,
              penaltyAmount: penalty,
              totalPrice: booking.total_price,
            }
          }
        });
      } catch (emailError) {
        console.error('Erreur envoi email annulation:', emailError);
        // Ne pas faire échouer l'annulation si l'email échoue
      }

      Alert.alert('Succès', 'La réservation a été annulée avec succès.');
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      Alert.alert('Erreur', error.message || "Impossible d'annuler la réservation");
    } finally {
      setIsConfirming(false);
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
              <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
              <Text style={styles.headerTitle}>Annuler la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {bookingIsCompleted ? (
              <View style={styles.warningContainer}>
                <Ionicons name="information-circle" size={48} color="#ef4444" />
                <Text style={styles.warningText}>
                  Cette réservation est terminée et ne peut plus être annulée.
                </Text>
              </View>
            ) : (
              <>
                {/* Informations */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Informations</Text>
                  {booking.status === 'pending' ? (
                    <Text style={styles.infoText}>
                      Cette demande est en attente de confirmation. L'annulation est gratuite car aucun paiement n'a encore été effectué.
                    </Text>
                  ) : (
                    <Text style={styles.infoText}>
                      {penaltyDescription}
                      {'\n\n'}
                      {isOwner ? (
                        <>
                          {penalty > 0 ? (
                            <>
                              Vous serez pénalisé de {penalty.toLocaleString()} XOF.
                              {'\n'}
                              Le locataire sera remboursé intégralement de {refundAmount.toLocaleString()} XOF.
                            </>
                          ) : (
                            <>
                              Aucune pénalité ne sera appliquée.
                              {'\n'}
                              Le locataire sera remboursé intégralement de {refundAmount.toLocaleString()} XOF.
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {penalty > 0 ? (
                            <>
                              Une pénalité de {penalty.toLocaleString()} XOF sera appliquée.
                              {'\n'}
                              Le montant remboursé sera de {refundAmount.toLocaleString()} XOF.
                            </>
                          ) : (
                            <>
                              Aucune pénalité ne sera appliquée.
                              {'\n'}
                              Le montant remboursé sera de {refundAmount.toLocaleString()} XOF.
                            </>
                          )}
                        </>
                      )}
                    </Text>
                  )}
                </View>

                {/* Raison */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Raison de l'annulation *</Text>
                  {cancellationReasons.map((reasonOption) => (
                    <TouchableOpacity
                      key={reasonOption.value}
                      style={[
                        styles.reasonOption,
                        selectedReason === reasonOption.value && styles.reasonOptionSelected,
                      ]}
                      onPress={() => setSelectedReason(reasonOption.value)}
                    >
                      <View style={styles.reasonRadio}>
                        {selectedReason === reasonOption.value && (
                          <View style={styles.reasonRadioSelected} />
                        )}
                      </View>
                      <Text style={styles.reasonLabel}>{reasonOption.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Détails supplémentaires */}
                {selectedReason && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Détails supplémentaires (optionnel)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={reason}
                      onChangeText={setReason}
                      placeholder="Ajoutez des détails sur la raison de l'annulation..."
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          {!bookingIsCompleted && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !selectedReason && styles.confirmButtonDisabled]}
                onPress={handleCancel}
                disabled={!selectedReason || isConfirming}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.confirmButtonText}>Confirmer l'annulation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    maxHeight: '95%',
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  warningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  warningText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
  },
  infoCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reasonOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  reasonLabel: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VehicleCancellationModal;

