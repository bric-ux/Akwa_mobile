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
import { useBookings, Booking } from '../hooks/useBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import InvoiceDisplay from '../components/InvoiceDisplay';
import { formatPrice } from '../utils/priceCalculator';

type PropertyBookingDetailsRouteProp = RouteProp<RootStackParamList, 'PropertyBookingDetails'>;

const PropertyBookingDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyBookingDetailsRouteProp>();
  const { bookingId } = route.params;
  const { user } = useAuth();
  const { getUserBookings } = useBookings();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostInfo, setHostInfo] = useState<{
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

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
          type: 'property_generate_traveler_pdf',
          data: {
            bookingId: booking.id,
            propertyTitle: booking.properties?.title || '',
            checkIn: booking.check_in_date,
            checkOut: booking.check_out_date,
            guestsCount: booking.guests_count,
            totalPrice: booking.total_price,
            pricePerNight: booking.properties?.price_per_night || 0,
            cleaningFee: booking.properties?.cleaning_fee || 0,
            serviceFee: booking.properties?.service_fee,
            taxes: booking.properties?.taxes,
            paymentMethod: payment?.payment_method || booking.payment_method,
            hostName: hostInfo ? `${hostInfo.first_name} ${hostInfo.last_name}` : undefined,
            hostPhone: hostInfo?.phone,
            discountApplied: booking.discount_applied,
            discountAmount: booking.discount_amount,
            houseRules: booking.properties?.house_rules,
            checkInTime: booking.properties?.check_in_time,
            checkOutTime: booking.properties?.check_out_time,
            cancellationPolicy: booking.properties?.cancellation_policy,
          }
        }
      });

      if (error) {
        console.error('❌ [PropertyBookingDetails] Erreur génération PDF:', error);
        throw error;
      }

      console.log('📄 [PropertyBookingDetails] Réponse PDF:', { hasPdf: !!data?.pdf, dataKeys: data ? Object.keys(data) : [] });

      if (data?.pdf) {
        try {
          // Sauvegarder le PDF dans un fichier temporaire
          const fileName = `facture-${booking.id.substring(0, 8)}.pdf`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          
          console.log('💾 [PropertyBookingDetails] Écriture fichier:', fileUri);
          
          await FileSystem.writeAsStringAsync(fileUri, data.pdf, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('✅ [PropertyBookingDetails] Fichier écrit avec succès');
          
          // Vérifier que le fichier existe
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          console.log('📁 [PropertyBookingDetails] Info fichier:', fileInfo);
          
          if (!fileInfo.exists) {
            throw new Error('Le fichier n\'a pas été créé');
          }
          
          // Partager le PDF
          const isAvailable = await Sharing.isAvailableAsync();
          console.log('📤 [PropertyBookingDetails] Sharing disponible:', isAvailable);
          
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
          console.error('❌ [PropertyBookingDetails] Erreur fichier:', fileError);
          Alert.alert('Erreur', `Erreur lors de la sauvegarde: ${fileError.message}`);
        }
      } else {
        console.error('❌ [PropertyBookingDetails] Pas de PDF dans la réponse');
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
          
          {/* Propriété */}
          {booking.properties?.title && (
            <View style={styles.infoRow}>
              <Ionicons name="home-outline" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Propriété</Text>
                <Text style={styles.infoValue}>{booking.properties.title}</Text>
                {booking.properties.locations?.name && (
                  <Text style={styles.infoSubtext}>
                    📍 {booking.properties.locations.name}
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
                {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
              </Text>
              <Text style={styles.infoSubtext}>
                {nights} nuit{nights > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Voyageurs */}
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Voyageurs</Text>
              <Text style={styles.infoValue}>
                {booking.adults_count} adulte{booking.adults_count > 1 ? 's' : ''}
                {booking.children_count > 0 && `, ${booking.children_count} enfant${booking.children_count > 1 ? 's' : ''}`}
                {booking.infants_count > 0 && `, ${booking.infants_count} bébé${booking.infants_count > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>

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
                  {formatPrice(booking.cancellation_penalty)}
                </Text>
              </View>
            )}
            
            {booking.cancellation_penalty !== undefined && (
              <View style={styles.cancellationInfo}>
                <Text style={styles.cancellationLabel}>Remboursement :</Text>
                <Text style={styles.cancellationRefund}>
                  {formatPrice(booking.total_price - (booking.cancellation_penalty || 0))}
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
    backgroundColor: '#2E7D32',
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

