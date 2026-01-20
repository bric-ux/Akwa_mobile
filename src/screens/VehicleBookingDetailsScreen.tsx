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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
  const [payment, setPayment] = useState<any>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

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
            owner_id,
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
        vehicle: bookingData.vehicle ? 'présent' : 'absent'
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

  const handleDownloadPDF = async () => {
    if (!booking) return;
    
    // Empêcher le téléchargement pour les réservations annulées
    if (booking.status === 'cancelled') {
      Alert.alert('Erreur', 'Impossible de télécharger la facture pour une réservation annulée.');
      return;
    }
    
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
            paymentMethod: payment?.payment_method || booking.payment_method,
          }
        }
      });

      if (error) {
        console.error('❌ [VehicleBookingDetails] Erreur génération PDF:', error);
        throw error;
      }

      console.log('📄 [VehicleBookingDetails] Réponse PDF:', { hasPdf: !!data?.pdf, dataKeys: data ? Object.keys(data) : [] });

      if (data?.pdf) {
        try {
          // Sauvegarder le PDF dans un fichier temporaire
          const fileName = `facture-vehicule-${booking.id.substring(0, 8)}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          
          console.log('💾 [VehicleBookingDetails] Écriture fichier:', fileUri);
          
          await FileSystem.writeAsStringAsync(fileUri, data.pdf, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('✅ [VehicleBookingDetails] Fichier écrit avec succès');
          
          // Vérifier que le fichier existe
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          console.log('📁 [VehicleBookingDetails] Info fichier:', fileInfo);
          
          if (!fileInfo.exists) {
            throw new Error('Le fichier n\'a pas été créé');
          }
          
          // Partager le PDF
          const isAvailable = await Sharing.isAvailableAsync();
          console.log('📤 [VehicleBookingDetails] Sharing disponible:', isAvailable);
          
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Partager la facture',
            });
            Alert.alert('Succès', 'La facture a été générée. Vous pouvez la partager ou l\'enregistrer.');
          } else {
            // Fallback: ouvrir avec Linking
            const canOpen = await Linking.canOpenURL(fileUri);
            if (canOpen) {
              await Linking.openURL(fileUri);
            } else {
              Alert.alert('Succès', 'La facture a été sauvegardée.');
            }
          }
        } catch (fileError: any) {
          console.error('❌ [VehicleBookingDetails] Erreur fichier:', fileError);
          Alert.alert('Erreur', `Erreur lors de la sauvegarde: ${fileError.message}`);
        }
      } else {
        console.error('❌ [VehicleBookingDetails] Pas de PDF dans la réponse');
        Alert.alert('Erreur', 'Le PDF n\'a pas pu être généré. Veuillez réessayer.');
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
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Véhicule</Text>
              <Text style={styles.infoValue}>
                {booking.vehicle?.brand && booking.vehicle?.model
                  ? `${booking.vehicle.brand} ${booking.vehicle.model}`
                  : booking.vehicle?.title || 'Véhicule'}
              </Text>
              {booking.vehicle?.location?.name && (
                <Text style={styles.infoSubtext}>
                  📍 {booking.vehicle.location.name}
                </Text>
              )}
            </View>
          </View>

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
                  total_price: booking.total_price,
                  payment_method: payment?.payment_method || booking.payment_method,
                  status: booking.status,
                }}
                pricePerUnit={booking.daily_rate}
                cleaningFee={0}
                paymentMethod={payment?.payment_method || booking.payment_method}
                propertyOrVehicleTitle={`${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim()}
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
                    <Text style={styles.downloadButtonText}>Télécharger la facture (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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






