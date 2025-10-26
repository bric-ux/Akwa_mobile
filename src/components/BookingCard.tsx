import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Booking } from '../hooks/useBookings';

interface BookingCardProps {
  booking: Booking;
  onViewProperty: (propertyId: string) => void;
  onCancelBooking: (booking: Booking) => void;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onViewProperty,
  onCancelBooking,
}) => {
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
              uri: booking.properties?.images?.[0] || 'https://via.placeholder.com/300x200' 
            }}
            style={styles.propertyImage}
          />
          <View style={styles.propertyDetails}>
            <Text style={styles.propertyTitle} numberOfLines={2}>
              {booking.properties?.title || 'Propriété non trouvée'}
            </Text>
            <Text style={styles.propertyLocation}>
              📍 {booking.properties?.cities?.name || 'Localisation inconnue'}
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
          <Text style={styles.actionButtonText}>Voir la propriété</Text>
        </TouchableOpacity>

        {(booking.status === 'pending' || booking.status === 'confirmed') && !isBookingPast(booking.check_out_date) && !hasAlreadyStarted() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => onCancelBooking(booking)}
          >
            <Ionicons name="close-outline" size={16} color="#e74c3c" />
            <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
              Annuler
            </Text>
          </TouchableOpacity>
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
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
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
});

export default BookingCard;
