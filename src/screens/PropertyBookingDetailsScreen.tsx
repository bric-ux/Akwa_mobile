import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useBookings, Booking } from '../hooks/useBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import InvoiceDisplay from '../components/InvoiceDisplay';
import BookingModificationModal from '../components/BookingModificationModal';
import { useBookingModifications } from '../hooks/useBookingModifications';
import { useCurrency } from '../hooks/useCurrency';

type PropertyBookingDetailsRouteProp = RouteProp<RootStackParamList, 'PropertyBookingDetails'>;

const PropertyBookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyBookingDetailsRouteProp>();
  const { bookingId } = route.params;
  const { user } = useAuth();
  const { currency, rates } = useCurrency();
  const { getUserBookings } = useBookings();
  const { getBookingPendingRequest } = useBookingModifications();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostInfo, setHostInfo] = useState<{
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const [modificationModalVisible, setModificationModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  useEffect(() => {
    if (booking?.id) {
      checkPendingRequest();
    }
  }, [booking?.id]);

  const checkPendingRequest = async () => {
    if (!booking?.id) return;
    try {
      const request = await getBookingPendingRequest(booking.id);
      setPendingRequest(request);
    } catch (error) {
      console.error('Erreur chargement demande modification:', error);
      setPendingRequest(null);
    }
  };

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      
      // Charger la réservation
      const bookings = await getUserBookings();
      const foundBooking = bookings.find(b => b.id === bookingId);
      
      if (!foundBooking) {
        Alert.alert('Erreur', 'Réservation introuvable');
        navigation.goBack();
        return;
      }
      
      setBooking(foundBooking);

      // Charger les infos de l'hôte
      if (foundBooking.properties?.host_id) {
        const { data: hostData } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone')
          .eq('user_id', foundBooking.properties.host_id)
          .single();
        setHostInfo(hostData);
      }

      // Charger les infos de paiement
      const { data: paymentData } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPayment(paymentData);
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la réservation');
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatBookingAmount = (amountXof: number) => {
    const bookingCurrency = (((booking as any)?.payment_currency) || currency) as 'XOF' | 'EUR' | 'USD';
    const bookingRate =
      Number((booking as any)?.exchange_rate) ||
      (bookingCurrency === 'EUR' ? Number(rates.EUR) : bookingCurrency === 'USD' ? Number(rates.USD) : 0);

    if (bookingCurrency === 'EUR' && bookingRate > 0) {
      const eur = amountXof / bookingRate;
      return `${eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
    if (bookingCurrency === 'USD' && bookingRate > 0) {
      const usd = amountXof / bookingRate;
      return `${usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amountXof);
  };

  // Fonction pour déterminer le statut réel à afficher en fonction des dates
  const getEffectiveStatus = (): string => {
    if (!booking) return 'pending';
    
    // Si annulée ou terminée, utiliser le statut de la base
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return booking.status;
    }
    
    // Vérifier si la réservation est en cours
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(booking.check_out_date);
    checkOut.setHours(0, 0, 0, 0);
    
    // Si le checkout est passé, la réservation est terminée
    if (checkOut < today) {
      return 'completed';
    }
    
    // Si le check-in est passé ou aujourd'hui et le checkout est futur, la réservation est en cours
    if (checkIn <= today && checkOut >= today && booking.status === 'confirmed') {
      return 'in_progress';
    }
    
    // Sinon, utiliser le statut de la base de données
    return booking.status;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: '#f39c12', label: 'En attente' },
      confirmed: { color: '#27ae60', label: 'Confirmée' },
      cancelled: { color: '#e74c3c', label: 'Annulée' },
      completed: { color: '#3498db', label: 'Terminée' },
      in_progress: { color: '#3498db', label: 'En cours' },
    };
    
    const config = statusConfig[status] || { color: '#95a5a6', label: status };
    
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusText}>{config.label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement des détails...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.errorText}>Réservation introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isConfirmed = booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'in_progress';
  const isCancelled = booking.status === 'cancelled';
  const nights = Math.ceil(
    (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
    / (1000 * 60 * 60 * 24)
  );

  // Total : utiliser le montant stocké (détails dans InvoiceDisplay via booking_calculation_details) (ne pas recalculer avec le prix actuel de la propriété)
  const totalAmount = booking.total_price ?? 0;
  
  // Frais de ménage pour affichage (fallback) — les détails réels viennent d'InvoiceDisplay / booking_calculation_details
  const calculatedCleaningFee = booking.properties ? (() => {
    const baseCleaningFee = booking.properties.cleaning_fee || 0;
    const isFreeCleaningApplicable = booking.properties.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days;
    return isFreeCleaningApplicable ? 0 : baseCleaningFee;
  })() : 0;

  // Fonction pour vérifier si la réservation peut être modifiée
  const canModifyBooking = () => {
    if (!booking) return false;
    
    // Ne peut pas modifier si annulée ou terminée
    if (booking.status === 'cancelled' || booking.status === 'completed') return false;
    
    // Peut modifier les réservations en attente, confirmées ou en cours
    if (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const checkout = new Date(booking.check_out_date);
      checkout.setHours(0, 0, 0, 0);
      
      // Ne peut pas modifier si le checkout est passé (réservation terminée)
      if (checkout < today) return false;
      
      // Peut modifier si le checkout est aujourd'hui ou dans le futur
      return checkout >= today;
    }
    
    return false;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de réservation</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Statut */}
        <View style={styles.statusContainer}>
          {getStatusBadge(getEffectiveStatus())}
        </View>

        {/* Numéro de réservation (ID en base) */}
        {booking?.id && (
          <View style={[styles.section, { marginBottom: 0 }]}>
            <Text style={styles.sectionTitle}>Numéro de réservation</Text>
            <Text style={styles.reservationId}>#{booking.id}</Text>
          </View>
        )}

        {/* Date de réservation */}
        {(booking as any).created_at && (
          <View style={[styles.section, { marginBottom: 0 }]}>
            <Text style={styles.sectionTitle}>Date de réservation</Text>
            <Text style={styles.infoValue}>
              {new Date((booking as any).created_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}

        {/* Contact de l'hôte */}
        {isConfirmed && hostInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact de l'hôte</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>
                  {hostInfo.first_name} {hostInfo.last_name}
                </Text>
                {hostInfo.phone && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${hostInfo.phone}`)}
                  >
                    <Text style={styles.phoneLink}>
                      📞 {hostInfo.phone}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Message si la réservation n'est pas confirmée */}
        {!isConfirmed && booking.status !== 'cancelled' && (
          <View style={styles.section}>
            <Text style={styles.infoNote}>
              Les coordonnées de l'hôte seront disponibles après confirmation de la réservation
            </Text>
          </View>
        )}

        {/* Informations d'annulation */}
        {booking.status === 'cancelled' && (
          <View style={styles.section}>
            <View style={styles.cancellationHeader}>
              <Ionicons name="close-circle-outline" size={24} color="#e74c3c" />
              <Text style={styles.cancellationTitle}>Réservation annulée</Text>
            </View>
            
            {booking.cancellation_penalty !== undefined && booking.cancellation_penalty > 0 && (
              <View style={styles.cancellationInfo}>
                <Text style={styles.cancellationLabel}>Pénalité d'annulation :</Text>
                <Text style={styles.cancellationPenalty}>
                  {formatBookingAmount(booking.cancellation_penalty)}
                </Text>
              </View>
            )}
            
            {booking.cancellation_penalty !== undefined && (
              <View style={styles.cancellationInfo}>
                <Text style={styles.cancellationLabel}>Remboursement :</Text>
                <Text style={styles.cancellationRefund}>
                  {formatBookingAmount(booking.total_price - (booking.cancellation_penalty || 0))}
                </Text>
              </View>
            )}
            
            {booking.cancellation_reason && (
              <View style={styles.cancellationReason}>
                <Text style={styles.cancellationReasonLabel}>Raison de l'annulation :</Text>
                <Text style={styles.cancellationReasonText}>{booking.cancellation_reason}</Text>
              </View>
            )}
            
            {booking.cancelled_at && (
              <Text style={styles.cancellationDate}>
                Annulée le {new Date(booking.cancelled_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        )}

        {/* Facture - uniquement pour les réservations confirmées ou terminées, pas annulées */}
        {isConfirmed && booking.status !== 'cancelled' && (
          <>
            <View style={styles.section}>
              <InvoiceDisplay
                type="traveler"
                serviceType="property"
                booking={booking}
                pricePerUnit={booking.properties?.price_per_night || 0}
                cleaningFee={booking.properties?.cleaning_fee || 0}
                serviceFee={booking.properties?.service_fee}
                taxes={booking.properties?.taxes}
                paymentMethod={payment?.payment_method || booking.payment_method}
                hostName={hostInfo ? `${hostInfo.first_name} ${hostInfo.last_name}` : undefined}
                hostPhone={hostInfo?.phone}
                propertyOrVehicleTitle={booking.properties?.title}
              />
            </View>

          </>
        )}

        {/* Bouton Modifier - pour les réservations modifiables */}
        {canModifyBooking() && (
          <TouchableOpacity
            style={styles.modifyButton}
            onPress={async () => {
              // Vérifier s'il y a une demande en cours
              if (pendingRequest) {
                Alert.alert(
                  'Demande en cours',
                  'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse de l\'hôte ou annuler la demande existante.',
                  [{ text: 'OK' }]
                );
                return;
              }
              // Vérifier à nouveau au moment du clic
              try {
                const request = await getBookingPendingRequest(booking.id);
                if (request) {
                  setPendingRequest(request);
                  Alert.alert(
                    'Demande en cours',
                    'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse de l\'hôte ou annuler la demande existante.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
              } catch (error) {
                console.error('Erreur vérification demande:', error);
              }
              setModificationModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={20} color="#2563eb" />
            <Text style={styles.modifyButtonText}>
              {booking.status === 'pending' ? 'Modifier la demande' : 'Modifier la réservation'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Voir le logement */}
        {booking.properties?.id && (
          <TouchableOpacity
            style={styles.viewPropertyButton}
            onPress={() => navigation.navigate('PropertyDetails' as never, { propertyId: booking.properties!.id } as never)}
          >
            <Ionicons name="eye-outline" size={20} color="#2E7D32" />
            <Text style={styles.viewPropertyButtonText}>Voir le logement</Text>
          </TouchableOpacity>
        )}

        {/* Modal de modification */}
        {booking && (
          <BookingModificationModal
            visible={modificationModalVisible}
            onClose={() => {
              setModificationModalVisible(false);
              loadBookingDetails(); // Recharger les détails après modification
            }}
            booking={booking}
            onModificationRequested={() => {
              setModificationModalVisible(false);
              loadBookingDetails();
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#e74c3c',
    fontWeight: '600',
  },
  statusContainer: {
    padding: 20,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  reservationId: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  infoSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  priceValue: {
    fontSize: 18,
    color: '#2E7D32',
  },
  discountLabel: {
    color: '#2E7D32',
  },
  discountValue: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  phoneLink: {
    fontSize: 14,
    color: '#2E7D32',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  infoNote: {
    fontSize: 12,
    color: '#3b82f6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
  },
  modifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2563eb',
    gap: 8,
  },
  modifyButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  viewPropertyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2E7D32',
    gap: 8,
  },
  viewPropertyButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '600',
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  cancellationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e74c3c',
  },
  cancellationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  cancellationLabel: {
    fontSize: 14,
    color: '#666',
  },
  cancellationPenalty: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
  },
  cancellationRefund: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  cancellationReason: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  cancellationReasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  cancellationReasonText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  cancellationDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default PropertyBookingDetailsScreen;

