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
import { useVehicleBookings, VehicleBooking } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import InvoiceDisplay from '../components/InvoiceDisplay';
import { formatPrice } from '../utils/priceCalculator';
import { getCommissionRates } from '../lib/commissions';
import VehicleModificationModal from '../components/VehicleModificationModal';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';

type VehicleBookingDetailsRouteProp = RouteProp<RootStackParamList, 'VehicleBookingDetails'>;

const VehicleBookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleBookingDetailsRouteProp>();
  const { bookingId } = route.params;
  const { user } = useAuth();
  const { getMyBookings } = useVehicleBookings();
  const { getBookingPendingRequest, cancelModificationRequest } = useVehicleBookingModifications();
  const [cancelling, setCancelling] = useState(false);
  
  const [booking, setBooking] = useState<VehicleBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerInfo, setOwnerInfo] = useState<{
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
      loadPendingRequest();
    }
  }, [booking?.id]);

  const loadPendingRequest = async () => {
    if (!booking?.id) return;
    try {
      const request = await getBookingPendingRequest(booking.id);
      setPendingRequest(request);
    } catch (error) {
      console.error('Erreur chargement demande modification:', error);
    }
  };

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        Alert.alert('Erreur', 'Utilisateur non connecté');
        navigation.goBack();
        return;
      }

      // Charger directement la réservation par ID avec toutes les relations
      console.log('🔍 [VehicleBookingDetails] Chargement réservation ID:', bookingId);
      
      const { data: bookingData, error: bookingError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images,
            cancellation_policy,
            owner_id,
            hourly_rental_enabled,
            price_per_hour,
            with_driver,
            driver_fee,
            security_deposit,
            location:locations (
              id,
              name
            ),
            vehicle_photos (
              id,
              url,
              is_main
            )
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          ),
          license_documents (
            id,
            document_url,
            document_type,
            verified,
            verified_at
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) {
        console.error('❌ [VehicleBookingDetails] Erreur Supabase:', bookingError);
        Alert.alert('Erreur', `Impossible de charger la réservation: ${bookingError.message}`);
        navigation.goBack();
        return;
      }

      if (!bookingData) {
        console.error('❌ [VehicleBookingDetails] Aucune donnée retournée');
        Alert.alert('Erreur', 'Réservation introuvable');
        navigation.goBack();
        return;
      }

      console.log('✅ [VehicleBookingDetails] Réservation chargée:', {
        id: bookingData.id,
        vehicle_id: bookingData.vehicle_id,
        renter_id: bookingData.renter_id,
        vehicle: bookingData.vehicle ? 'présent' : 'absent',
        rental_days: bookingData.rental_days,
        rental_hours: bookingData.rental_hours,
        hourly_rate: bookingData.hourly_rate,
        hourly_rental_enabled: bookingData.vehicle?.hourly_rental_enabled,
        price_per_hour: bookingData.vehicle?.price_per_hour,
        start_datetime: bookingData.start_datetime, // Ajouté pour debug
        end_datetime: bookingData.end_datetime, // Ajouté pour debug
      });

      // Charger les infos du propriétaire séparément si le véhicule existe
      let ownerData = null;
      if (bookingData.vehicle?.owner_id) {
        const { data: owner, error: ownerError } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email, phone, avatar_url')
          .eq('user_id', bookingData.vehicle.owner_id)
          .single();
        
        if (ownerError) {
          console.error('⚠️ [VehicleBookingDetails] Erreur chargement propriétaire:', ownerError);
        } else {
          ownerData = owner;
          console.log('✅ [VehicleBookingDetails] Propriétaire chargé:', owner?.first_name);
        }
      }

      // Vérifier que l'utilisateur est soit le locataire soit le propriétaire
      const isRenter = bookingData.renter_id === user.id;
      const isOwner = bookingData.vehicle?.owner_id === user.id;

      console.log('🔐 [VehicleBookingDetails] Vérification accès:', {
        userId: user.id,
        renterId: bookingData.renter_id,
        ownerId: bookingData.vehicle?.owner_id,
        isRenter,
        isOwner
      });

      if (!isRenter && !isOwner) {
        Alert.alert('Erreur', 'Vous n\'avez pas accès à cette réservation');
        navigation.goBack();
        return;
      }

      // Construire l'objet booking avec les données chargées
      const bookingWithRelations: VehicleBooking = {
        ...bookingData,
        vehicle: bookingData.vehicle ? {
          ...bookingData.vehicle,
          owner: ownerData ? {
            user_id: ownerData.user_id,
            first_name: ownerData.first_name,
            last_name: ownerData.last_name,
            email: ownerData.email,
            phone: ownerData.phone,
            avatar_url: ownerData.avatar_url,
          } : undefined
        } : undefined,
        renter: bookingData.renter || undefined,
      } as VehicleBooking;

      setBooking(bookingWithRelations);

      // Utiliser les infos du propriétaire chargées
      if (ownerData) {
        setOwnerInfo({
          first_name: ownerData.first_name,
          last_name: ownerData.last_name,
          phone: ownerData.phone,
        });
      }

      // Charger les infos de paiement
      const { data: paymentData } = await supabase
        .from('vehicle_payments')
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

  const getEffectiveStatus = (): string => {
    if (!booking) return 'pending';
    if (booking.status === 'cancelled' || booking.status === 'completed') return booking.status;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(booking.start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return 'completed';
    if (startDate <= today && endDate >= today && booking.status === 'confirmed') return 'in_progress';
    return booking.status;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: '#f39c12', label: 'En attente' },
      confirmed: { color: '#27ae60', label: 'Confirmée' },
      in_progress: { color: '#3498db', label: 'En cours' },
      cancelled: { color: '#e74c3c', label: 'Annulée' },
      completed: { color: '#3498db', label: 'Terminée' },
    };
    
    const config = statusConfig[status] || { color: '#95a5a6', label: status };
    
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusText}>{config.label}</Text>
      </View>
    );
  };

  const canModifyBooking = () => {
    if (!booking) return false;
    
    // Ne peut pas modifier si annulée ou terminée
    if (booking.status === 'cancelled' || booking.status === 'completed') return false;
    
    // Ne peut pas modifier si la date de fin est passée
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return false;
    
    const startDate = new Date(booking.start_date);
    startDate.setHours(0, 0, 0, 0);
    
    // Peut modifier si la date de début est dans le futur ou aujourd'hui
    return startDate >= today || booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress';
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

  const isConfirmed = booking.status === 'confirmed' || booking.status === 'completed';
  const commissionRates = getCommissionRates('vehicle', undefined, booking.payment_method === 'card');
  
  // Calculer le prix en tenant compte des heures
  const rentalDays = booking.rental_days || 0;
  const rentalHours = booking.rental_hours || 0;
  const daysPrice = (booking.daily_rate || 0) * rentalDays;
  const hourlyRate = booking.hourly_rate || booking.vehicle?.price_per_hour || 0;
  const hoursPrice = rentalHours > 0 && hourlyRate > 0 ? rentalHours * hourlyRate : 0;
  const basePrice = daysPrice + hoursPrice - (booking.discount_amount || 0); // Prix après réduction
  const renterServiceFee = Math.round(basePrice * (commissionRates.travelerFeePercent / 100));

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
        <View style={[styles.section, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Numéro de réservation</Text>
          <Text style={styles.reservationId}>#{booking.id}</Text>
        </View>

        {/* Afficher la demande de modification en cours */}
        {pendingRequest && (
          <View style={styles.modificationRequestBanner}>
            <Ionicons name="time-outline" size={18} color="#f39c12" />
            <View style={styles.modificationRequestContent}>
              <Text style={styles.modificationRequestTitle}>Demande en attente</Text>
              <Text style={styles.modificationRequestDates}>
                Nouvelles dates proposées: {formatDate(pendingRequest.requested_start_date)} - {formatDate(pendingRequest.requested_end_date)}
              </Text>
              <Text style={styles.modificationRequestInfo}>
                Durée: {pendingRequest.requested_rental_days} jour{pendingRequest.requested_rental_days > 1 ? 's' : ''}
                {pendingRequest.requested_rental_hours && pendingRequest.requested_rental_hours > 0 && ` et ${pendingRequest.requested_rental_hours} heure${pendingRequest.requested_rental_hours > 1 ? 's' : ''}`}
              </Text>
              {pendingRequest.requested_total_price !== booking.total_price && (
                <Text style={styles.modificationRequestInfo}>
                  Prix payé en surplus: {formatPrice(pendingRequest.requested_total_price - booking.total_price)}
                </Text>
              )}
              <TouchableOpacity
                style={styles.cancelModificationButton}
                onPress={async () => {
                  if (cancelling) return;
                  Alert.alert(
                    'Annuler la demande',
                    'Êtes-vous sûr de vouloir annuler cette demande de modification ?',
                    [
                      { text: 'Non', style: 'cancel' },
                      {
                        text: 'Oui',
                        style: 'destructive',
                        onPress: async () => {
                          setCancelling(true);
                          const result = await cancelModificationRequest(pendingRequest.id);
                          if (result.success) {
                            await loadPendingRequest(); // Recharger pour mettre à jour l'affichage
                          }
                          setCancelling(false);
                        },
                      },
                    ]
                  );
                }}
                disabled={cancelling}
              >
                <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.cancelModificationButtonText}>
                  {cancelling ? 'Annulation...' : 'Annuler la demande'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}


        {/* Contact du propriétaire */}
        {isConfirmed && (ownerInfo || booking.vehicle?.owner) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact du propriétaire</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>
                  {ownerInfo 
                    ? `${ownerInfo.first_name || ''} ${ownerInfo.last_name || ''}`.trim()
                    : booking.vehicle?.owner
                    ? `${booking.vehicle.owner.first_name || ''} ${booking.vehicle.owner.last_name || ''}`.trim()
                    : 'Propriétaire'}
                </Text>
                {(ownerInfo?.phone || booking.vehicle?.owner?.phone) && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${ownerInfo?.phone || booking.vehicle?.owner?.phone || ''}`)}
                  >
                    <Text style={styles.phoneLink}>
                      📞 {ownerInfo?.phone || booking.vehicle?.owner?.phone}
                    </Text>
                  </TouchableOpacity>
                )}
                {(ownerInfo?.email || booking.vehicle?.owner?.email) && (
                  <Text style={styles.infoSubtext}>
                    ✉️ {ownerInfo?.email || booking.vehicle?.owner?.email}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Message si la réservation n'est pas confirmée */}
        {!isConfirmed && (
          <View style={styles.section}>
            <Text style={styles.infoNote}>
              Les coordonnées du propriétaire seront disponibles après confirmation de la réservation
            </Text>
          </View>
        )}

        {/* Facture - uniquement pour les réservations confirmées ou terminées (pas annulées) */}
        {isConfirmed && booking.status !== 'cancelled' && (
          <>
            <View style={styles.section}>
              <InvoiceDisplay
                type="traveler"
                serviceType="vehicle"
                booking={{
                  id: booking.id,
                  start_date: booking.start_date,
                  end_date: booking.end_date,
                  start_datetime: booking.start_datetime, // Ajouté pour afficher les heures
                  end_datetime: booking.end_datetime, // Ajouté pour afficher les heures
                  total_price: booking.total_price,
                  discount_amount: booking.discount_amount,
                  discount_applied: booking.discount_applied,
                  payment_method: payment?.payment_method || booking.payment_method,
                  status: booking.status,
                  rental_days: booking.rental_days, // Passer rental_days pour le calcul correct
                  rental_hours: booking.rental_hours || 0, // Passer rental_hours pour l'affichage
                  hourly_rate: booking.hourly_rate || 0, // Passer hourly_rate de la réservation
                  with_driver: booking.with_driver, // Préserver la valeur originale (true/false/null/undefined) pour le calcul
                  security_deposit: booking.security_deposit || booking.vehicle?.security_deposit || 0, // Caution
                  vehicle: {
                    rules: booking.vehicle?.rules || [],
                    cancellation_policy: booking.vehicle?.cancellation_policy ?? undefined,
                    discount_enabled: booking.vehicle?.discount_enabled,
                    discount_min_days: booking.vehicle?.discount_min_days,
                    discount_percentage: booking.vehicle?.discount_percentage,
                    long_stay_discount_enabled: booking.vehicle?.long_stay_discount_enabled,
                    long_stay_discount_min_days: booking.vehicle?.long_stay_discount_min_days,
                    long_stay_discount_percentage: booking.vehicle?.long_stay_discount_percentage,
                    hourly_rental_enabled: booking.vehicle?.hourly_rental_enabled,
                    price_per_hour: booking.vehicle?.price_per_hour,
                    with_driver: booking.vehicle?.with_driver, // Ajouté pour afficher si avec chauffeur
                    driver_fee: booking.vehicle?.driver_fee || 0, // Surplus chauffeur
                    security_deposit: booking.vehicle?.security_deposit || 0, // Caution du véhicule
                  },
                } as any}
                pricePerUnit={booking.daily_rate || 0}
                cleaningFee={0}
                paymentMethod={payment?.payment_method || booking.payment_method}
                propertyOrVehicleTitle={`${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim()}
              />
            </View>

          </>
        )}

        {/* Bouton Modifier - pour les réservations modifiables */}
        {canModifyBooking() && (
          <TouchableOpacity
            style={styles.modifyButton}
            onPress={() => setModificationModalVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="#2563eb" />
            <Text style={styles.modifyButtonText}>
              {booking.status === 'pending' ? 'Modifier la demande' : 'Modifier la réservation'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Voir le véhicule */}
        {booking.vehicle?.id && (
          <TouchableOpacity
            style={styles.viewVehicleButton}
            onPress={() => navigation.navigate('VehicleDetails' as never, { vehicleId: booking.vehicle!.id } as never)}
          >
            <Ionicons name="eye-outline" size={20} color="#2563eb" />
            <Text style={styles.viewVehicleButtonText}>Voir le véhicule</Text>
          </TouchableOpacity>
        )}

        {/* Modal de modification */}
        {booking && (
          <VehicleModificationModal
            visible={modificationModalVisible}
            onClose={() => {
              setModificationModalVisible(false);
              loadBookingDetails(); // Recharger les détails après modification
            }}
            booking={booking}
            onModified={() => {
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
  viewVehicleButton: {
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
    borderColor: '#2563eb',
    gap: 8,
  },
  viewVehicleButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
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
  modificationRequestBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
    gap: 10,
  },
  modificationRequestContent: {
    flex: 1,
  },
  modificationRequestTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  modificationRequestDates: {
    fontSize: 12,
    color: '#78350f',
    marginBottom: 2,
  },
  modificationRequestInfo: {
    fontSize: 12,
    color: '#78350f',
    marginTop: 2,
  },
  cancelModificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    gap: 6,
  },
  cancelModificationButtonText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  discountInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  discountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  discountSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default VehicleBookingDetailsScreen;






