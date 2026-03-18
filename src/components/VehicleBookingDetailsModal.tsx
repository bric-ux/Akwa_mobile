import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VehicleBooking } from '../types';
import { getCommissionRates } from '../lib/commissions';
import { supabase } from '../services/supabase';
import { VEHICLE_COLORS } from '../constants/colors';
import InvoiceDisplay from './InvoiceDisplay';
import VehicleCancellationModal from './VehicleCancellationModal';
import VehicleModificationModal from './VehicleModificationModal';
import HostVehicleModificationRequestCard from './HostVehicleModificationRequestCard';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';

interface VehicleBookingDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  booking: VehicleBooking | null;
  isOwner?: boolean;
}

const VehicleBookingDetailsModal: React.FC<VehicleBookingDetailsModalProps> = ({
  visible,
  onClose,
  booking,
  isOwner = true,
}) => {
  const { getBookingPendingRequest } = useVehicleBookingModifications();
  const [cancellationModalVisible, setCancellationModalVisible] = useState(false);
  const [modificationModalVisible, setModificationModalVisible] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  
  // ✅ PRIORITÉ ABSOLUE: Récupérer les données stockées depuis booking_calculation_details
  // IMPORTANT: Tous les hooks doivent être déclarés AVANT tout return conditionnel
  const [calculationDetails, setCalculationDetails] = useState<any>(null);
  const [loadingCalcDetails, setLoadingCalcDetails] = useState(false);

  useEffect(() => {
    if (booking) {
      loadPayment();
      if (isOwner) {
        loadPendingRequest();
      }
    }
  }, [booking, isOwner]);

  useEffect(() => {
    const fetchCalculationDetails = async () => {
      if (!booking?.id) return;
      
      setLoadingCalcDetails(true);
      try {
        const { data, error } = await supabase
          .from('booking_calculation_details')
          .select('*')
          .eq('booking_id', booking.id)
          .eq('booking_type', 'vehicle')
          .single();

        if (!error && data) {
          setCalculationDetails(data);
          console.log('✅ [VehicleBookingDetailsModal] Détails de calcul récupérés depuis la base:', data);
        } else {
          console.log('⚠️ [VehicleBookingDetailsModal] Pas de détails de calcul stockés, fallback sur recalcul');
        }
      } catch (err) {
        console.error('Erreur récupération détails calcul:', err);
      } finally {
        setLoadingCalcDetails(false);
      }
    };

    fetchCalculationDetails();
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

  const loadPayment = async () => {
    if (!booking) return;
    try {
      if (__DEV__) console.log('🔍 [VehicleBookingDetailsModal] Chargement payment pour booking:', booking.id);
      const { data, error } = await supabase
        .from('vehicle_payments')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('❌ [VehicleBookingDetailsModal] Erreur chargement payment:', error);
      } else {
        if (__DEV__) console.log('✅ [VehicleBookingDetailsModal] Payment chargé:', {
          hasPayment: !!data,
          paymentMethod: data?.payment_method,
          bookingPaymentMethod: booking.payment_method,
          finalPaymentMethod: data?.payment_method || booking.payment_method || 'AUCUN'
        });
        
        // Si pas de payment mais qu'on a un payment_method dans booking, l'utiliser
        if (!data && booking.payment_method) {
          if (__DEV__) console.log('⚠️ [VehicleBookingDetailsModal] Pas de payment mais payment_method dans booking:', booking.payment_method);
        }
      }
      
      setPayment(data);
    } catch (error) {
      console.error('Erreur lors du chargement du paiement:', error);
    }
  };

  if (!booking) {
    if (__DEV__) console.log('❌ [VehicleBookingDetailsModal] Pas de booking, modal ne s\'affiche pas');
    return null;
  }

  if (__DEV__) console.log('✅ [VehicleBookingDetailsModal] Modal rendu avec booking:', {
    id: booking.id,
    status: booking.status,
    hasVehicle: !!booking.vehicle,
    hasRenter: !!booking.renter,
    hasOwner: !!booking.vehicle?.owner,
    isOwner
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateWithTime = (dateString: string, dateTimeString?: string) => {
    const tz = 'Africa/Abidjan';
    const date = new Date(dateTimeString ?? dateString);
    const dateFormatted = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: tz,
    });
    if (dateTimeString) {
      const timeFormatted = date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: tz,
      });
      return `${dateFormatted} à ${timeFormatted}`;
    }
    return dateFormatted;
  };

  const getEffectiveStatus = (): string => {
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
    const statusConfig: { [key: string]: { color: string; label: string; icon: string } } = {
      pending: { color: '#f59e0b', label: 'En attente', icon: 'time-outline' },
      confirmed: { color: '#10b981', label: 'Confirmée', icon: 'checkmark-circle-outline' },
      in_progress: { color: '#3b82f6', label: 'En cours', icon: 'checkmark-circle-outline' },
      cancelled: { color: '#ef4444', label: 'Annulée', icon: 'close-circle-outline' },
      completed: { color: '#2563eb', label: 'Terminée', icon: 'checkmark-circle-outline' },
    };

    const config = statusConfig[status] || { color: '#6b7280', label: status, icon: 'help-circle-outline' };
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon as any} size={16} color="#fff" />
        <Text style={styles.statusBadgeText}>{config.label}</Text>
      </View>
    );
  };

  const effectiveStatus = getEffectiveStatus();
  const vehicle = booking.vehicle;
  const renter = booking.renter;
  const owner = vehicle?.owner;

  // Debug: vérifier que les données sont présentes
  if (__DEV__) console.log('🔍 [VehicleBookingDetailsModal] Données booking:', {
    hasBooking: !!booking,
    hasVehicle: !!vehicle,
    hasRenter: !!renter,
    hasOwner: !!owner,
    vehicleId: vehicle?.id,
    renterId: renter?.user_id,
    ownerId: owner?.user_id,
    status: booking.status,
    isOwner
  });

  // ✅ UTILISER UNIQUEMENT LES DONNÉES STOCKÉES - AUCUN RECALCUL
  // Récupérer TOUTES les valeurs depuis calculationDetails si disponible
  const rentalDays = booking.rental_days || 0;
  const rentalHours = booking.rental_hours || 0;
  const daysPrice = calculationDetails?.days_price ?? 0;
  const hoursPrice = calculationDetails?.hours_price ?? 0;
  const basePrice = calculationDetails?.base_price ?? 0;
  const priceAfterDiscount = calculationDetails?.price_after_discount ?? 0;
  const driverFee = calculationDetails?.driver_fee ?? 0;
  const priceAfterDiscountWithDriver = calculationDetails?.base_price_with_driver ?? 0;
  const renterServiceFee = calculationDetails?.service_fee ?? 0;
  const renterServiceFeeHT = calculationDetails?.service_fee_ht ?? 0;
  const renterServiceFeeVAT = calculationDetails?.service_fee_vat ?? 0;
  const ownerCommission = calculationDetails?.host_commission ?? 0;
  const ownerCommissionHT = calculationDetails?.host_commission_ht ?? 0;
  const ownerCommissionVAT = calculationDetails?.host_commission_vat ?? 0;
  const ownerNetAmount = calculationDetails?.host_net_amount ?? booking.host_net_amount ?? 0;
  const totalPrice = calculationDetails?.total_price ?? booking.total_price ?? 0;
  
  const securityDeposit = booking.security_deposit || 0;
  
  if (__DEV__ && calculationDetails) {
    console.log('✅ [VehicleBookingDetailsModal] Utilisation UNIQUEMENT des données stockées:', {
      driver_fee: driverFee,
      total_price: totalPrice,
      host_net_amount: ownerNetAmount,
    });
  }

  // Déterminer le type de réduction appliquée et le pourcentage
  const getDiscountInfo = () => {
    if (!booking.discount_amount || booking.discount_amount <= 0 || !booking.vehicle) {
      return null;
    }

    const rentalDays = booking.rental_days || 0;
    const vehicle = booking.vehicle;

    // Vérifier si c'est une réduction long séjour
    if (
      vehicle.long_stay_discount_enabled &&
      vehicle.long_stay_discount_min_days &&
      vehicle.long_stay_discount_percentage &&
      rentalDays >= vehicle.long_stay_discount_min_days
    ) {
      return {
        type: 'long_stay',
        label: 'Réduction long séjour',
        percentage: vehicle.long_stay_discount_percentage,
        minDays: vehicle.long_stay_discount_min_days,
      };
    }

    // Vérifier si c'est une réduction normale
    if (
      vehicle.discount_enabled &&
      vehicle.discount_min_days &&
      vehicle.discount_percentage &&
      rentalDays >= vehicle.discount_min_days
    ) {
      return {
        type: 'normal',
        label: 'Réduction',
        percentage: vehicle.discount_percentage,
        minDays: vehicle.discount_min_days,
      };
    }

    return null;
  };

  const discountInfo = getDiscountInfo();


  const handleViewLicenseDocument = async (documentUrl: string) => {
    try {
      await Linking.openURL(documentUrl);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le document.');
    }
  };

  if (__DEV__) console.log('🎯 [VehicleBookingDetailsModal] RENDU - visible:', visible, 'booking:', booking?.id, 'status:', booking?.status);

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
              <Ionicons name="document-text-outline" size={24} color="#1e293b" />
              <Text style={styles.headerTitle}>Détails de la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.bookingId}>
            Réservation #{(booking as any).vehicle_booking_code || (booking as any).booking_code || booking.id || ''}
          </Text>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >

            {/* Statut */}
            <View style={styles.section}>
              {getStatusBadge(effectiveStatus)}
            </View>

            {/* Demande de modification en attente - uniquement pour le propriétaire */}
            {isOwner && pendingRequest && (
              <View style={styles.modificationRequestSection}>
                <HostVehicleModificationRequestCard
                  request={pendingRequest}
                  renterName={booking.renter
                    ? `${booking.renter.first_name || ''} ${booking.renter.last_name || ''}`.trim()
                    : 'Locataire'}
                  vehicleTitle={vehicle
                    ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()
                    : 'Véhicule'}
                  onUpdated={() => {
                    loadPendingRequest();
                    onClose(); // Fermer le modal pour recharger la liste
                  }}
                />
              </View>
            )}

            {/* Véhicule */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="car-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>Véhicule</Text>
              </View>
              <View style={styles.vehicleInfo}>
                {vehicle?.images?.[0] && (
                  <Image
                    source={{ uri: vehicle.images[0] }}
                    style={styles.vehicleImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.vehicleDetails}>
                  <Text style={styles.vehicleName}>
                    {vehicle?.brand} {vehicle?.model}
                  </Text>
                  <Text style={styles.vehicleYear}>
                    {vehicle?.year ? String(vehicle.year) : ''} {vehicle?.year && vehicle?.fuel_type ? '•' : ''} {vehicle?.fuel_type || ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dates */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>Période de location</Text>
              </View>
              <View style={styles.dateGrid}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Prise du véhicule</Text>
                  <Text style={styles.dateValue}>
                    {formatDateWithTime(booking.start_date, booking.start_datetime)}
                  </Text>
                </View>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Rendu du véhicule</Text>
                  <Text style={styles.dateValue}>
                    {formatDateWithTime(booking.end_date, booking.end_datetime)}
                  </Text>
                </View>
              </View>
              <View style={styles.separator} />
              <View style={styles.durationRow}>
                <Text style={styles.durationLabel}>Durée</Text>
                <Text style={styles.durationValue}>
                  {rentalDays} jour{rentalDays > 1 ? 's' : ''}
                  {rentalHours > 0 && ` et ${rentalHours} heure${rentalHours > 1 ? 's' : ''}`}
                </Text>
              </View>
              {booking.created_at && (
                <View style={[styles.durationRow, { marginTop: 8 }]}>
                  <Text style={styles.durationLabel}>Date de réservation</Text>
                  <Text style={styles.durationValue}>
                    {new Date(booking.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Client/Locataire ou Propriétaire */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-outline" size={20} color="#1e293b" />
                <Text style={styles.cardTitle}>{isOwner ? 'Locataire' : 'Propriétaire'}</Text>
              </View>
              <View style={styles.personInfo}>
                <View style={styles.avatarContainer}>
                  {(isOwner ? renter?.avatar_url : owner?.avatar_url) ? (
                    <Image
                      source={{ uri: isOwner ? renter?.avatar_url : owner?.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#9ca3af" />
                    </View>
                  )}
                </View>
                <View style={styles.personDetails}>
                  <Text style={styles.personName}>
                    {isOwner
                      ? `${renter?.first_name || ''} ${renter?.last_name || ''}`.trim() || 'Locataire'
                      : `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || 'Propriétaire'}
                  </Text>
                  {(isOwner ? renter?.email : (owner?.email && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed'))) && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={16} color="#6b7280" />
                      <Text style={styles.contactText}>
                        {isOwner ? renter?.email : owner?.email}
                      </Text>
                    </View>
                  )}
                  {(isOwner ? renter?.phone : (owner?.phone && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed'))) && (
                    <View style={styles.contactRow}>
                      <Ionicons name="call-outline" size={16} color="#6b7280" />
                      <Text style={styles.contactText}>
                        {isOwner ? renter?.phone : owner?.phone}
                      </Text>
                    </View>
                  )}
                  {!isOwner && booking.status !== 'confirmed' && booking.status !== 'in_progress' && booking.status !== 'completed' && (
                    <Text style={styles.infoText}>
                      Les coordonnées du propriétaire seront disponibles après confirmation de la réservation
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Informations permis de conduire */}
            {(booking.has_license !== undefined || booking.license_document_url || booking.license_documents?.length > 0) && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="document-text-outline" size={20} color="#1e293b" />
                  <Text style={styles.cardTitle}>Permis de conduire</Text>
                </View>
                <View style={styles.licenseInfo}>
                  {booking.has_license !== undefined && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Possède un permis</Text>
                      <Text style={styles.infoValue}>{booking.has_license ? 'Oui' : 'Non'}</Text>
                    </View>
                  )}
                  {booking.license_years && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Années de permis</Text>
                      <Text style={styles.infoValue}>{String(booking.license_years || 0)} an(s)</Text>
                    </View>
                  )}
                  {booking.license_number && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Numéro de permis</Text>
                      <Text style={styles.infoValue}>{booking.license_number}</Text>
                    </View>
                  )}
                  
                  {/* Document du permis - visible uniquement pour le propriétaire */}
                  {isOwner && (booking.license_document_url || booking.license_documents?.length > 0) && (
                    <>
                      <View style={styles.separator} />
                      <Text style={styles.documentLabel}>Document du permis</Text>
                      {(() => {
                        const licenseDoc = booking.license_documents?.[0];
                        const documentUrl = licenseDoc?.document_url || booking.license_document_url;
                        
                        if (!documentUrl) return null;
                        
                        return (
                          <View style={styles.documentContainer}>
                            <View style={styles.documentInfo}>
                              <Ionicons name="document-text-outline" size={20} color={VEHICLE_COLORS.primary} />
                              <View style={styles.documentDetails}>
                                <Text style={styles.documentName}>Permis de conduire</Text>
                                <Text style={styles.documentSubtext}>
                                  Document téléchargé par le locataire
                                  {licenseDoc?.verified && (
                                    <Text style={styles.verifiedText}> ✓ Vérifié</Text>
                                  )}
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.viewDocumentButton}
                              onPress={() => handleViewLicenseDocument(documentUrl)}
                            >
                              <Ionicons name="eye-outline" size={18} color={VEHICLE_COLORS.primary} />
                              <Text style={styles.viewDocumentText}>Voir</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Message */}
            {booking.message_to_owner && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="chatbubble-outline" size={20} color="#1e293b" />
                  <Text style={styles.cardTitle}>Message</Text>
                </View>
                <Text style={styles.messageText}>{booking.message_to_owner}</Text>
              </View>
            )}

            {/* Informations de réduction */}
            {discountInfo && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="pricetag-outline" size={20} color="#1e293b" />
                  <Text style={styles.cardTitle}>Réduction appliquée</Text>
                </View>
                <View style={styles.discountInfoContainer}>
                  <View style={styles.discountRow}>
                    <Text style={styles.discountInfoLabel}>Type de réduction:</Text>
                    <Text style={styles.discountInfoValue}>{discountInfo.label}</Text>
                  </View>
                  <View style={styles.discountRow}>
                    <Text style={styles.discountInfoLabel}>Pourcentage:</Text>
                    <Text style={styles.discountInfoValue}>{discountInfo.percentage}%</Text>
                  </View>
                  <View style={styles.discountRow}>
                    <Text style={styles.discountInfoLabel}>Montant de la réduction:</Text>
                    <Text style={[styles.discountInfoValue, styles.discountAmount]}>
                      -{booking.discount_amount?.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Facture - uniquement pour les réservations confirmées, en cours ou terminées (pas annulées) */}
            {(booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed') && booking.status !== 'cancelled' && (
              <View style={styles.card}>
                <InvoiceDisplay
                  type={isOwner ? 'host' : 'traveler'}
                  serviceType="vehicle"
                  booking={{
                    id: booking.id,
                    start_date: booking.start_date,
                    end_date: booking.end_date,
                    start_datetime: booking.start_datetime, // Ajouté pour afficher les heures
                    end_datetime: booking.end_datetime, // Ajouté pour afficher les heures
                    total_price: booking.total_price,
                    created_at: booking.created_at,
                    discount_amount: booking.discount_amount,
                    discount_applied: booking.discount_applied,
                    payment_method: payment?.payment_method || booking.payment_method || undefined,
                    status: booking.status,
                    rental_days: booking.rental_days, // Passer rental_days pour le calcul correct
                    rental_hours: booking.rental_hours || 0, // Passer rental_hours pour l'affichage
                    hourly_rate: booking.hourly_rate || 0, // Passer hourly_rate de la réservation
                    vehicle: {
                      rules: booking.vehicle?.rules || [],
                      cancellation_policy: booking.vehicle?.cancellation_policy ?? undefined,
                      discount_enabled: booking.vehicle?.discount_enabled,
                      discount_min_days: booking.vehicle?.discount_min_days,
                      discount_percentage: booking.vehicle?.discount_percentage,
                      long_stay_discount_enabled: booking.vehicle?.long_stay_discount_enabled,
                      long_stay_discount_min_days: booking.vehicle?.long_stay_discount_min_days,
                      long_stay_discount_percentage: booking.vehicle?.long_stay_discount_percentage,
                      with_driver: booking.vehicle?.with_driver, // Ajouté pour afficher si avec chauffeur
                    },
                  } as any}
                  pricePerUnit={booking.daily_rate || 0}
                  paymentMethod={payment?.payment_method || booking.payment_method || undefined}
                  travelerName={isOwner ? `${renter?.first_name || ''} ${renter?.last_name || ''}`.trim() : undefined}
                  travelerEmail={isOwner ? renter?.email : undefined}
                  travelerPhone={isOwner ? renter?.phone : undefined}
                  hostName={isOwner ? `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() : undefined}
                  hostEmail={isOwner ? owner?.email : undefined}
                  hostPhone={isOwner ? owner?.phone : undefined}
                  propertyOrVehicleTitle={`${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim()}
                />
              </View>
            )}


            {/* Bouton Modifier pour le locataire - réservations en attente, confirmées ou en cours */}
            {!isOwner && (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.modifyButton}
                onPress={() => setModificationModalVisible(true)}
              >
                <Ionicons name="create-outline" size={18} color="#2563eb" />
                <Text style={styles.modifyButtonText}>Modifier les dates</Text>
              </TouchableOpacity>
            )}

            {/* Bouton Annuler pour le propriétaire - réservations confirmées ou en cours */}
            {isOwner && (booking.status === 'confirmed' || booking.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setCancellationModalVisible(true)}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.cancelButtonText}>Annuler la réservation</Text>
              </TouchableOpacity>
            )}

            {/* Bouton Annuler pour le locataire - réservations en attente, confirmées ou en cours */}
            {!isOwner && (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setCancellationModalVisible(true)}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.cancelButtonText}>
                  {booking.status === 'pending' ? 'Annuler la demande' : 'Annuler la réservation'}
                </Text>
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

      {/* Modal d'annulation */}
      {booking && (
        <VehicleCancellationModal
          visible={cancellationModalVisible}
          onClose={() => setCancellationModalVisible(false)}
          booking={booking}
          isOwner={isOwner}
          onCancelled={() => {
            setCancellationModalVisible(false);
            onClose();
          }}
        />
      )}

      {/* Modal de modification */}
      {booking && !isOwner && (
        <VehicleModificationModal
          visible={modificationModalVisible}
          onClose={() => setModificationModalVisible(false)}
          booking={booking}
          onModified={() => {
            setModificationModalVisible(false);
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
  bookingId: {
    fontSize: 10,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingTop: 8,
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modificationRequestSection: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  vehicleInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleImage: {
    width: 80,
    height: 64,
    borderRadius: 8,
  },
  vehicleDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  vehicleYear: {
    fontSize: 14,
    color: '#6b7280',
  },
  dateGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  personInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  licenseInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginTop: 8,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  documentDetails: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  documentSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  verifiedText: {
    color: '#10b981',
    fontWeight: '600',
  },
  viewDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: VEHICLE_COLORS.primary,
  },
  viewDocumentText: {
    fontSize: 14,
    fontWeight: '500',
    color: VEHICLE_COLORS.primary,
  },
  messageText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  modifyButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  commissionText: {
    color: '#ef4444',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  netLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  netValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeFooterButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  priceInfo: {
    padding: 16,
  },
  discountInfoContainer: {
    marginTop: 8,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  discountInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  discountInfoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  discountAmount: {
    color: '#10b981',
  },
  discountLabel: {
    color: '#10b981',
  },
  discountValue: {
    color: '#10b981',
    fontWeight: '600',
  },
});

export default VehicleBookingDetailsModal;

