import React from 'react';
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
  const { createOrGetConversation } = useMessaging();

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
        booking.properties.id,
        booking.properties.host_id, // host_id
        user.id                     // guest_id
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

  const hasAlreadyStarted = () => {
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkInDate <= today;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f39c12';
      case 'confirmed':
        return '#27ae60';
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
        return 'En attente';
      case 'confirmed':
        return 'Confirmée';
      case 'cancelled':
        return 'Annulée';
      case 'completed':
        return 'Terminée';
      default:
        return status;
    }
  };

  const nights = Math.ceil(
    (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
    / (1000 * 60 * 60 * 24)
  );

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

  return (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => onViewProperty(booking.property_id)}
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
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Text style={styles.statusText}>
              {getStatusText(booking.status)}
            </Text>
          </View>
        </View>
      </View>

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
            {formatPrice(booking.total_price)}
          </Text>
          {booking.discount_applied && booking.original_total && (
            <Text style={styles.originalPrice}>
              {formatPrice(booking.original_total)}
            </Text>
          )}
        </View>
      </View>

      {booking.message_to_host && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message à l'hôte :</Text>
          <Text style={styles.messageText}>{booking.message_to_host}</Text>
        </View>
      )}

      <View style={styles.bookingActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onViewProperty(booking.property_id)}
        >
          <Ionicons name="eye-outline" size={16} color="#2E7D32" />
          <Text style={styles.actionButtonText}>Voir</Text>
        </TouchableOpacity>

        {/* Bouton Contacter l'hôte - disponible pour toutes les réservations sauf annulées */}
        {booking.status !== 'cancelled' && booking.properties?.host_id && booking.properties?.id && (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={handleContactHost}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#e67e22" />
            <Text style={[styles.actionButtonText, styles.contactButtonText]}>
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
            <Text style={[styles.actionButtonText, styles.reviewButtonText]}>
              Avis
            </Text>
          </TouchableOpacity>
        )}

        {(booking.status === 'pending' || booking.status === 'confirmed') && !isBookingPast(booking.check_out_date) && !hasAlreadyStarted() && (
          <>
            {onModifyBooking && (
              <TouchableOpacity
                style={[styles.actionButton, styles.modifyButton]}
                onPress={() => onModifyBooking(booking)}
              >
                <Ionicons name="create-outline" size={16} color="#3498db" />
                <Text style={[styles.actionButtonText, styles.modifyButtonText]}>
                  Modifier
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => onCancelBooking(booking)}
            >
              <Ionicons name="close-outline" size={16} color="#e74c3c" />
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
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
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
});

export default BookingCard;
