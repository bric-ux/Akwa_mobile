import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Booking } from '../hooks/useBookings';
import { useMessaging } from '../hooks/useMessaging';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';
import { useBookingModifications } from '../hooks/useBookingModifications';
import { getCommissionRates } from '../lib/commissions';
import { calculateTotalPrice, type DiscountConfig } from '../hooks/usePricing';
import { useCurrency } from '../hooks/useCurrency';

interface BookingCardProps {
  booking: Booking;
  onViewProperty: (propertyId: string) => void;
  onCancelBooking: (booking: Booking) => void;
  onLeaveReview?: (booking: Booking) => void;
  onModifyBooking?: (booking: Booking) => void;
  canReview?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onViewProperty,
  onCancelBooking,
  onLeaveReview,
  onModifyBooking,
  canReview = false,
}) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { currency, rates } = useCurrency();
  const { createOrGetConversation } = useMessaging();
  const { getBookingPendingRequest, cancelModificationRequest } = useBookingModifications();
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const checkPendingRequest = async () => {
      setLoadingRequest(true);
      const request = await getBookingPendingRequest(booking.id);
      setPendingRequest(request);
      setLoadingRequest(false);
    };
    checkPendingRequest();
  }, [booking.id]);

  const handleContactHost = async () => {
    if (!user || !booking.properties?.host_id || !booking.properties?.id) {
      Alert.alert('Erreur', 'Impossible de contacter l\'hôte. Informations manquantes.');
      return;
    }

    try {
      // Récupérer les infos de l'hôte
      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', booking.properties.host_id)
        .single();
      
      const hostName = hostProfile 
        ? `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || 'Hôte'
        : 'Hôte';
      
      const conversationId = await createOrGetConversation(
        booking.properties.id, // propertyId
        booking.properties.host_id, // hostId
        user.id, // guestId
        undefined // vehicleId (pas de véhicule ici)
      );

      if (conversationId) {
        (navigation as any).navigate('Home', { 
          screen: 'MessagingTab',
          params: { 
            conversationId, 
            propertyId: booking.properties.id,
            bookingId: booking.id,
            recipientName: hostName
          }
        });
      } else {
        Alert.alert('Erreur', 'Impossible de créer la conversation');
      }
    } catch (error: any) {
      console.error('Erreur lors du contact de l\'hôte:', error);
      Alert.alert('Erreur', 'Impossible de contacter l\'hôte');
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isBookingPast = (checkOutDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOutDate);
    checkout.setHours(0, 0, 0, 0);
    return checkout < today;
  };

  const isStayCompleted = (): boolean => {
    return isBookingPast(booking.check_out_date);
  };

  const canModifyBooking = () => {
    // Ne peut pas modifier si annulée ou terminée
    if (booking.status === 'cancelled' || booking.status === 'completed') return false;
    
    // Peut modifier les réservations en attente, confirmées ou en cours
    if (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress') {
      // Ne peut pas modifier si le checkout est passé (réservation terminée)
      if (isBookingPast(booking.check_out_date)) return false;
      
      // Peut modifier si le checkout est aujourd'hui ou dans le futur
      return !isBookingPast(booking.check_out_date);
    }
    
    return false;
  };

  const formatPrice = (amountXof: number) => {
    const bookingCurrency = ((booking as any).payment_currency || currency) as 'XOF' | 'EUR' | 'USD';
    const bookingRate =
      Number((booking as any).exchange_rate) ||
      (bookingCurrency === 'EUR' ? Number(rates.EUR) : bookingCurrency === 'USD' ? Number(rates.USD) : 0);

    if (bookingCurrency === 'EUR' && bookingRate > 0) {
      const eur = amountXof / bookingRate;
      return `${eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
    if (bookingCurrency === 'USD' && bookingRate > 0) {
      const usd = amountXof / bookingRate;
      return `${usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amountXof);
  };

  // Fonction pour déterminer le statut réel à afficher en fonction des dates
  const getEffectiveStatus = (): string => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f39c12';
      case 'confirmed':
        return '#27ae60';
      case 'in_progress':
        return '#3498db';
      case 'cancelled':
        return '#e74c3c';
      case 'completed':
        return '#3498db';
      default:
        return '#95a5a6';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return (booking as any).payment_method === 'card' ? 'En attente d\'acceptation' : 'En attente';
      case 'confirmed':
        return 'Confirmée';
      case 'in_progress':
        return 'En cours';
      case 'cancelled':
        return 'Annulée';
      case 'completed':
        return 'Terminée';
      default:
        return status;
    }
  };

  const effectiveStatus = getEffectiveStatus();

  const nights = useMemo(() => {
    return Math.ceil(
      (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
      / (1000 * 60 * 60 * 24)
    );
  }, [booking.check_in_date, booking.check_out_date]);

  // Calculer le montant total EXACTEMENT comme dans PropertyBookingDetailsScreen
  // Logique: basePrice = pricePerNight * nights
  //          priceAfterDiscount = basePrice - discountAmount
  //          serviceFee = priceAfterDiscount * 12%
  //          total = priceAfterDiscount + serviceFee + cleaningFee + taxes
  const calculateTotalAmount = useMemo((): number => {
    if (!booking.properties) return booking.total_price || 0;
    
    const pricePerNight = booking.properties.price_per_night || 0;
    if (pricePerNight === 0) return booking.total_price || 0;
    
    // TOUJOURS recalculer la réduction pour être sûr d'avoir la bonne valeur
    let discountAmount = 0;
    
    const discountConfig: DiscountConfig = {
      enabled: booking.properties.discount_enabled || false,
      minNights: booking.properties.discount_min_nights || null,
      percentage: booking.properties.discount_percentage || null
    };
    const longStayDiscountConfig: DiscountConfig | undefined = booking.properties.long_stay_discount_enabled ? {
      enabled: booking.properties.long_stay_discount_enabled || false,
      minNights: booking.properties.long_stay_discount_min_nights || null,
      percentage: booking.properties.long_stay_discount_percentage || null
    } : undefined;
    
    try {
      const pricing = calculateTotalPrice(pricePerNight, nights, discountConfig, longStayDiscountConfig);
      discountAmount = pricing.discountAmount || 0;
    } catch (error) {
      console.error('Erreur lors du calcul de la réduction:', error);
      discountAmount = booking.discount_amount || 0;
    }
    
    // Calculer exactement comme InvoiceDisplay
    const basePrice = pricePerNight * nights;
    const priceAfterDiscount = basePrice - discountAmount;
    
    // Calculer les frais de service avec TVA (12% du prix APRÈS réduction + 20% TVA)
    const commissionRates = getCommissionRates('property');
    const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
    const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
    const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
    
    // Frais de ménage (gratuit si applicable)
    const baseCleaningFee = booking.properties.cleaning_fee || 0;
    const isFreeCleaningApplicable = booking.properties.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days;
    const cleaningFee = isFreeCleaningApplicable ? 0 : baseCleaningFee;
    
    // Taxes (taxe de séjour par nuit, donc multiplier par le nombre de nuits)
    const taxesPerNight = booking.properties.taxes || 0;
    const taxes = taxesPerNight * nights;
    
    // Total payé : prix après réduction + frais de service + frais de ménage + taxes
    const calculatedTotal = priceAfterDiscount + effectiveServiceFee + cleaningFee + taxes;
    
    return calculatedTotal;
  }, [booking, nights]);

  const totalAmount = calculateTotalAmount;

  // Calculer aussi le montant de réduction pour l'affichage
  const calculateDiscountAmount = useMemo((): number => {
    if (!booking.properties) return 0;
    
    const basePricePerNight = booking.properties.price_per_night || 0;
    if (basePricePerNight === 0) return 0;
    
    const discountConfig: DiscountConfig = {
      enabled: booking.properties.discount_enabled || false,
      minNights: booking.properties.discount_min_nights || null,
      percentage: booking.properties.discount_percentage || null
    };
    const longStayDiscountConfig: DiscountConfig | undefined = booking.properties.long_stay_discount_enabled ? {
      enabled: booking.properties.long_stay_discount_enabled || false,
      minNights: booking.properties.long_stay_discount_min_nights || null,
      percentage: booking.properties.long_stay_discount_percentage || null
    } : undefined;
    
    try {
      const pricing = calculateTotalPrice(basePricePerNight, nights, discountConfig, longStayDiscountConfig);
      return pricing.discountAmount || 0;
    } catch (error) {
      console.error('Erreur lors du calcul de la réduction:', error);
      return booking.discount_amount || 0;
    }
  }, [booking, nights]);

  const discountAmount = calculateDiscountAmount;
  const originalTotal = booking.properties ? (booking.properties.price_per_night || 0) * nights : booking.total_price || 0;

  // Fonction pour obtenir l'URL de l'image de la propriété
  // Priorité: property_photos (triées par display_order) > images > placeholder
  const getPropertyImageUrl = (): string => {
    const property = booking.properties;
    if (!property) return 'https://via.placeholder.com/300x200';

    // Priorité 1: property_photos (photos catégorisées)
    if (property.property_photos && property.property_photos.length > 0) {
      const sortedPhotos = [...property.property_photos].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
      return sortedPhotos[0].url;
    }

    // Priorité 2: images array
    if (property.images && Array.isArray(property.images) && property.images.length > 0) {
      return property.images[0];
    }

    // Fallback: placeholder
    return 'https://via.placeholder.com/300x200';
  };

  const handleViewDetails = () => {
    (navigation as any).navigate('PropertyBookingDetails', { bookingId: booking.id });
  };

  return (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={handleViewDetails}
      activeOpacity={0.8}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.propertyInfo}>
          <Image
            source={{ 
              uri: getPropertyImageUrl()
            }}
            style={styles.propertyImage}
          />
          <View style={styles.propertyDetails}>
            <Text style={styles.propertyTitle} numberOfLines={2}>
              {booking.properties?.title || 'Propriété non trouvée'}
            </Text>
            <Text style={styles.propertyLocation}>
              📍 {booking.properties?.location?.name || booking.properties?.locations?.name || 'Localisation inconnue'}
            </Text>
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>
                {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
              </Text>
              <Text style={styles.nightsText}>
                {nights} nuit{nights > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(effectiveStatus) }]}>
            <Text style={styles.statusText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {getStatusText(effectiveStatus)}
            </Text>
          </View>
        </View>
      </View>

      {/* Afficher la demande de modification en cours */}
      {pendingRequest && (
        <View style={styles.modificationRequestBanner}>
          <Ionicons name="time-outline" size={18} color="#f39c12" />
          <View style={styles.modificationRequestContent}>
            <Text style={styles.modificationRequestTitle}>Demande de modification en cours</Text>
            <Text style={styles.modificationRequestDates}>
              Nouvelles dates proposées: {formatDate(pendingRequest.requested_check_in)} - {formatDate(pendingRequest.requested_check_out)}
            </Text>
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
                          setPendingRequest(null);
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

      <View style={styles.bookingDetails}>
        <View style={styles.guestsInfo}>
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text style={styles.guestsText}>
            {booking.adults_count} adulte{booking.adults_count > 1 ? 's' : ''}
            {booking.children_count > 0 && `, ${booking.children_count} enfant${booking.children_count > 1 ? 's' : ''}`}
            {booking.infants_count > 0 && `, ${booking.infants_count} bébé${booking.infants_count > 1 ? 's' : ''}`}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>
            {formatPrice(totalAmount)}
          </Text>
        </View>
      </View>

      {booking.message_to_host && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message à l'hôte :</Text>
          <Text style={styles.messageText}>{booking.message_to_host}</Text>
        </View>
      )}

      {/* Informations d'annulation */}
      {booking.status === 'cancelled' && (
        <View style={styles.cancellationContainer}>
          <View style={styles.cancellationHeader}>
            <Ionicons name="close-circle-outline" size={20} color="#e74c3c" />
            <Text style={styles.cancellationTitle}>Réservation annulée</Text>
          </View>
          {booking.cancellation_penalty !== undefined && booking.cancellation_penalty > 0 && (
            <View style={styles.cancellationInfo}>
              <Text style={styles.cancellationLabel}>Pénalité d'annulation :</Text>
              <Text style={styles.cancellationPenalty}>
                {formatPrice(booking.cancellation_penalty)}
              </Text>
            </View>
          )}
          {booking.cancellation_penalty !== undefined && booking.cancellation_penalty >= 0 && (
            <View style={styles.cancellationInfo}>
              <Text style={styles.cancellationLabel}>Remboursement :</Text>
              <Text style={styles.cancellationRefund}>
                {formatPrice(booking.total_price - (booking.cancellation_penalty || 0))}
              </Text>
            </View>
          )}
          {booking.cancellation_reason && (
            <View style={styles.cancellationReason}>
              <Text style={styles.cancellationReasonLabel}>Raison :</Text>
              <Text style={styles.cancellationReasonText}>{booking.cancellation_reason}</Text>
            </View>
          )}
          {booking.cancelled_at && (
            <Text style={styles.cancellationDate}>
              Annulée le {new Date(booking.cancelled_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          )}
        </View>
      )}

      <View style={styles.bookingActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleViewDetails}
        >
          <Ionicons name="receipt-outline" size={16} color="#2E7D32" />
          <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Voir détails</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onViewProperty(booking.property_id)}
        >
          <Ionicons name="eye-outline" size={16} color="#2E7D32" />
          <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Voir propriété</Text>
        </TouchableOpacity>

        {/* Bouton Contacter l'hôte - disponible pour toutes les réservations sauf annulées */}
        {booking.status !== 'cancelled' && booking.properties?.host_id && booking.properties?.id && (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={handleContactHost}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#e67e22" />
            <Text style={[styles.actionButtonText, styles.contactButtonText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              Contacter
            </Text>
          </TouchableOpacity>
        )}

        {canReview && onLeaveReview && (booking.status === 'confirmed' || booking.status === 'completed') && isStayCompleted() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.reviewButton]}
            onPress={() => onLeaveReview(booking)}
          >
            <Ionicons name="star-outline" size={16} color="#FFD700" />
            <Text style={[styles.actionButtonText, styles.reviewButtonText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              Avis
            </Text>
          </TouchableOpacity>
        )}

        {canModifyBooking() && (
          <>
            {onModifyBooking && (
              <TouchableOpacity
                style={[styles.actionButton, styles.modifyButton]}
                onPress={() => onModifyBooking(booking)}
              >
                <Ionicons name="create-outline" size={16} color="#3498db" />
                <Text style={[styles.actionButtonText, styles.modifyButtonText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  Modifier
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => onCancelBooking(booking)}
            >
              <Ionicons name="close-outline" size={16} color="#e74c3c" />
              <Text style={[styles.actionButtonText, styles.cancelButtonText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                Annuler
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  propertyInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  propertyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  propertyDetails: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  nightsText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'flex-end',
    flexShrink: 1,
    maxWidth: '48%',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  guestsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bookingActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    flex: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  contactButton: {
    borderColor: '#e67e22',
  },
  contactButtonText: {
    color: '#e67e22',
  },
  cancelButton: {
    borderColor: '#e74c3c',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
    marginLeft: 4,
  },
  cancelButtonText: {
    color: '#e74c3c',
  },
  reviewButton: {
    borderColor: '#FFD700',
  },
  reviewButtonText: {
    color: '#FFD700',
  },
  modifyButton: {
    borderColor: '#3498db',
  },
  modifyButtonText: {
    color: '#3498db',
  },
  modificationRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    marginTop: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
    gap: 8,
  },
  modificationRequestContent: {
    flex: 1,
  },
  modificationRequestTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f39c12',
    marginBottom: 4,
  },
  modificationRequestDates: {
    fontSize: 12,
    color: '#856404',
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
});

export default BookingCard;
