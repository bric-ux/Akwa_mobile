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
  Share,
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

type VehicleBookingDetailsRouteProp = RouteProp<RootStackParamList, 'VehicleBookingDetails'>;

const VehicleBookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleBookingDetailsRouteProp>();
  const { bookingId } = route.params;
  const { user } = useAuth();
  const { getMyBookings } = useVehicleBookings();
  
  const [booking, setBooking] = useState<VehicleBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerInfo, setOwnerInfo] = useState<{
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      
      // Charger la réservation
      const bookings = await getMyBookings();
      const foundBooking = bookings.find(b => b.id === bookingId);
      
      if (!foundBooking) {
        Alert.alert('Erreur', 'Réservation introuvable');
        navigation.goBack();
        return;
      }
      
      setBooking(foundBooking);

      // Charger les infos du propriétaire
      if (foundBooking.vehicle?.owner_id) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone')
          .eq('user_id', foundBooking.vehicle.owner_id)
          .single();
        setOwnerInfo(ownerData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la réservation');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!booking) return;
    
    setDownloadingPDF(true);
    try {
      // Appeler la fonction Supabase pour générer le PDF
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'vehicle_generate_renter_pdf',
          data: {
            bookingId: booking.id,
            vehicleTitle: `${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim(),
            vehicleBrand: booking.vehicle?.brand || '',
            vehicleModel: booking.vehicle?.model || '',
            vehicleYear: booking.vehicle?.year || '',
            fuelType: booking.vehicle?.fuel_type || '',
            startDate: booking.start_date,
            endDate: booking.end_date,
            rentalDays: booking.rental_days,
            dailyRate: booking.daily_rate,
            totalPrice: booking.total_price,
            securityDeposit: booking.security_deposit || 0,
            renterName: user?.user_metadata?.first_name && user?.user_metadata?.last_name
              ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
              : 'Locataire',
            renterEmail: user?.email,
            renterPhone: user?.user_metadata?.phone,
            ownerName: ownerInfo ? `${ownerInfo.first_name} ${ownerInfo.last_name}` : undefined,
            ownerEmail: ownerInfo?.phone,
            ownerPhone: ownerInfo?.phone || '',
            pickupLocation: booking.pickup_location,
          }
        }
      });

      if (error) throw error;

      if (data?.pdf) {
        // Décoder le PDF base64 et le partager
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Créer une URL temporaire pour le PDF
        const url = URL.createObjectURL(blob);
        
        // Partager le PDF
        await Share.share({
          message: `Facture de réservation véhicule ${booking.id.substring(0, 8)}`,
          url: url,
        });
        
        Alert.alert('Succès', 'La facture a été générée. Vous pouvez la partager ou l\'enregistrer.');
      } else {
        Alert.alert('Erreur', 'Impossible de générer le PDF');
      }
    } catch (error: any) {
      console.error('Erreur lors de la génération du PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF. Veuillez réessayer plus tard.');
    } finally {
      setDownloadingPDF(false);
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: '#f39c12', label: 'En attente' },
      confirmed: { color: '#27ae60', label: 'Confirmée' },
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
  const commissionRates = getCommissionRates('vehicle');
  const basePrice = booking.daily_rate * booking.rental_days;
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
          {getStatusBadge(booking.status)}
        </View>

        {/* Informations de la réservation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails de la réservation</Text>
          
          {/* Véhicule */}
          {booking.vehicle && (
            <View style={styles.infoRow}>
              <Ionicons name="car-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Véhicule</Text>
                <Text style={styles.infoValue}>
                  {booking.vehicle.brand} {booking.vehicle.model}
                </Text>
                {booking.vehicle.location?.name && (
                  <Text style={styles.infoSubtext}>
                    📍 {booking.vehicle.location.name}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Dates */}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Dates</Text>
              <Text style={styles.infoValue}>
                {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
              </Text>
              <Text style={styles.infoSubtext}>
                {booking.rental_days} jour{booking.rental_days > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Lieu de prise en charge */}
          {booking.pickup_location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Lieu de prise en charge</Text>
                <Text style={styles.infoValue}>{booking.pickup_location}</Text>
              </View>
            </View>
          )}

          {/* Prix */}
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Montant total</Text>
              <Text style={[styles.infoValue, styles.priceValue]}>
                {formatPrice(booking.total_price)}
              </Text>
            </View>
          </View>
        </View>

        {/* Contact du propriétaire */}
        {isConfirmed && ownerInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact du propriétaire</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>
                  {ownerInfo.first_name} {ownerInfo.last_name}
                </Text>
                {ownerInfo.phone && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`tel:${ownerInfo.phone}`)}
                  >
                    <Text style={styles.phoneLink}>
                      📞 {ownerInfo.phone}
                    </Text>
                  </TouchableOpacity>
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

        {/* Facture */}
        {isConfirmed && (
          <>
            <View style={styles.section}>
              <InvoiceDisplay
                type="traveler"
                serviceType="vehicle"
                booking={{
                  id: booking.id,
                  start_date: booking.start_date,
                  end_date: booking.end_date,
                  total_price: booking.total_price,
                  payment_method: booking.payment_method,
                  status: booking.status,
                }}
                pricePerUnit={booking.daily_rate}
                cleaningFee={0}
                propertyOrVehicleTitle={`${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim()}
              />
            </View>

            {/* Bouton télécharger PDF */}
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
                  <Text style={styles.downloadButtonText}>Télécharger la facture (PDF)</Text>
                </>
              )}
            </TouchableOpacity>
          </>
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
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
});

export default VehicleBookingDetailsScreen;

