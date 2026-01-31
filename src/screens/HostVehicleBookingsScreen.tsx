import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useVehicles } from '../hooks/useVehicles';
import { VehicleBooking } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { VEHICLE_COLORS } from '../constants/colors';
import { getCommissionRates } from '../lib/commissions';
import { Image } from 'react-native';
import { ScrollView } from 'react-native';
import { safeGoBack } from '../utils/navigation';
import VehicleBookingDetailsModal from '../components/VehicleBookingDetailsModal';
import SimpleMessageModal from '../components/SimpleMessageModal';
import VehicleCancellationModal from '../components/VehicleCancellationModal';
import GuestProfileModal from '../components/GuestProfileModal';
import VehicleRenterReviewModal from '../components/VehicleRenterReviewModal';
import { useVehicleRenterReviews } from '../hooks/useVehicleRenterReviews';
import HostVehicleModificationRequestCard from '../components/HostVehicleModificationRequestCard';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';
import { useAuth } from '../services/AuthContext';

type HostVehicleBookingsRouteParams = {
  vehicleId?: string;
};

const HostVehicleBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ HostVehicleBookings: HostVehicleBookingsRouteParams }, 'HostVehicleBookings'>>();
  const { vehicleId } = route.params || {};
  const { t } = useLanguage();
  const { getVehicleBookings, getAllOwnerBookings, updateBookingStatus, loading } = useVehicleBookings();
  const { getMyVehicles } = useVehicles();
  const { canReviewBooking } = useVehicleRenterReviews();
  const { user } = useAuth();
  const { getPendingRequestsForOwner } = useVehicleBookingModifications();
  const [bookings, setBookings] = useState<VehicleBooking[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modificationRequests, setModificationRequests] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'in_progress'>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(vehicleId || null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<VehicleBooking | null>(null);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messageModalData, setMessageModalData] = useState<{
    bookingId: string;
    vehicleId: string;
    otherParticipant: { id: string; name: string; isHost: boolean } | null;
  } | null>(null);
  const [cancellationModalVisible, setCancellationModalVisible] = useState(false);
  const [selectedBookingForCancellation, setSelectedBookingForCancellation] = useState<VehicleBooking | null>(null);
  const [guestProfileModalVisible, setGuestProfileModalVisible] = useState(false);
  const [selectedRenterId, setSelectedRenterId] = useState<string | null>(null);
  const [renterReviewModalVisible, setRenterReviewModalVisible] = useState(false);
  const [selectedBookingForRenterReview, setSelectedBookingForRenterReview] = useState<VehicleBooking | null>(null);
  const [canReviewRenter, setCanReviewRenter] = useState<{ [key: string]: boolean }>({});

  const loadBookings = async () => {
    try {
      // Charger les véhicules
      const vehiclesData = await getMyVehicles();
      setVehicles(vehiclesData);
      
      // Charger les réservations
      let data: VehicleBooking[];
      if (selectedVehicleId) {
        data = await getVehicleBookings(selectedVehicleId);
      } else {
        // Charger toutes les réservations de tous les véhicules du propriétaire
        data = await getAllOwnerBookings();
      }
      setBookings(data);
      
      // Charger les demandes de modification en attente
      if (user?.id) {
        const requests = await getPendingRequestsForOwner(user.id);
        setModificationRequests(requests);
      }
      
      // Vérifier pour chaque réservation terminée si le propriétaire peut noter le locataire
      const canReviewMap: { [key: string]: boolean } = {};
      for (const booking of data) {
        const completed = isBookingCompleted(booking);
        if (completed && booking.status !== 'cancelled' && booking.renter?.user_id && booking.vehicle?.id) {
          canReviewMap[booking.id] = await canReviewBooking(booking.id);
        }
      }
      setCanReviewRenter(canReviewMap);
    } catch (err) {
      console.error('Erreur lors du chargement des réservations:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
    }, [selectedVehicleId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const handleStatusUpdate = async (booking: VehicleBooking, status: 'confirmed' | 'cancelled') => {
    Alert.alert(
      status === 'confirmed' ? 'Confirmer la réservation' : 'Annuler la réservation',
      status === 'confirmed' 
        ? 'Voulez-vous confirmer cette réservation ?'
        : 'Voulez-vous annuler cette réservation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: status === 'confirmed' ? 'Confirmer' : 'Annuler',
          style: status === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const result = await updateBookingStatus(booking.id, status);
              if (result.success) {
                Alert.alert('Succès', 'Réservation mise à jour avec succès');
                loadBookings();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de mettre à jour la réservation');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'confirmed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#666';
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
      case 'in_progress':
        return 'En cours';
      default:
        return status;
    }
  };

  const isBookingInProgress = (booking: VehicleBooking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(booking.start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    return booking.status === 'confirmed' && startDate <= today && endDate >= today;
  };

  const isBookingCompleted = (booking: VehicleBooking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    return endDate < today;
  };

  // Calculer les gains nets pour une réservation
  const calculateNetEarnings = (booking: VehicleBooking) => {
    if (booking.status === 'cancelled') return 0;
    
    // Prix de base = daily_rate × rental_days
    const basePrice = (booking.daily_rate || 0) * (booking.rental_days || 0);
    // Appliquer la réduction si elle existe
    const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
    const commissionRates = getCommissionRates('vehicle');
    // Commission de 2% sur le prix APRÈS réduction
    const ownerCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
    return priceAfterDiscount - ownerCommission;
  };

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return isBookingInProgress(booking);
    if (selectedFilter === 'completed') {
      return isBookingCompleted(booking) && booking.status !== 'cancelled';
    }
    return booking.status === selectedFilter;
  });

  // Obtenir les véhicules avec leurs réservations et statistiques
  const getVehiclesWithBookings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filtrer uniquement les véhicules approuvés pour l'affichage dans les réservations
    const approvedVehicles = vehicles.filter((vehicle: any) => {
      return vehicle.is_approved === true;
    });

    const bookingsByVehicle = new Map<string, VehicleBooking[]>();
    bookings.forEach(booking => {
      if (!booking.vehicle?.id) return;
      const vid = booking.vehicle.id;
      if (!bookingsByVehicle.has(vid)) {
        bookingsByVehicle.set(vid, []);
      }
      bookingsByVehicle.get(vid)!.push(booking);
    });

    const vehiclesWithStats = approvedVehicles.map(vehicle => {
      const vehicleBookings = bookingsByVehicle.get(vehicle.id) || [];
      
      const stats = {
        total: vehicleBookings.length,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
        inProgress: 0,
      };

      let isCurrentlyRented = false;

      vehicleBookings.forEach(booking => {
        const isCancelled = booking.status === 'cancelled';
        
        if (isCancelled) {
          stats.cancelled++;
          return; // Les réservations annulées ne comptent pas comme actives
        }

        // Vérifier si la réservation est en cours (dates chevauchent aujourd'hui)
        // Cette vérification doit être faite AVANT de vérifier si elle est terminée
        if (isBookingInProgress(booking)) {
          stats.inProgress++;
          isCurrentlyRented = true; // Le véhicule est occupé à l'instant T
          // Si en cours, c'est aussi confirmed
          if (booking.status === 'confirmed') {
            stats.confirmed++;
          }
          return;
        }

        // Vérifier si la réservation est terminée
        const isCompleted = isBookingCompleted(booking);
        const endDate = new Date(booking.end_date);
        endDate.setHours(0, 0, 0, 0);
        // Une réservation est terminée si endDate < today OU si endDate === today (sauf si elle est en cours, déjà géré ci-dessus)
        const isEndedToday = endDate.getTime() === today.getTime();
        
        if (isCompleted || isEndedToday) {
          // Les réservations terminées ne comptent pas comme actives
          stats.completed++;
          return; // Ne pas les compter comme actives
        }

        // Les réservations pending ne bloquent pas la disponibilité (elles sont en attente de confirmation)
        // Seules les réservations en cours (isCurrentlyRented) rendent le véhicule indisponible
        if (booking.status === 'pending') {
          stats.pending++;
          // Ne pas mettre hasActiveBookings = true pour pending car elles ne bloquent pas la disponibilité
        } else if (booking.status === 'confirmed') {
          // Vérifier que la réservation confirmed n'est pas encore terminée
          const startDate = new Date(booking.start_date);
          startDate.setHours(0, 0, 0, 0);
          
          // Compter les réservations confirmed pour les statistiques
          if (endDate > today) {
            stats.confirmed++;
            // Ne pas mettre hasActiveBookings = true ici car le véhicule n'est pas encore occupé
            // hasActiveBookings sera true uniquement si isCurrentlyRented est true (réservation en cours)
          } else {
            // Si la date de fin est passée ou égale à aujourd'hui, c'est une réservation terminée
            stats.completed++;
          }
        }
      });

      return {
        vehicle,
        bookings: vehicleBookings,
        stats,
        isCurrentlyRented,
        // Le véhicule est indisponible uniquement s'il est occupé à l'instant T (isCurrentlyRented)
        // Les réservations futures confirmées ne rendent pas le véhicule indisponible
        isAvailable: !isCurrentlyRented,
      };
    });

    return vehiclesWithStats.sort((a, b) => {
      if (a.isCurrentlyRented && !b.isCurrentlyRented) return -1;
      if (!a.isCurrentlyRented && b.isCurrentlyRented) return 1;
      if (a.stats.total > 0 && b.stats.total === 0) return -1;
      if (a.stats.total === 0 && b.stats.total > 0) return 1;
      return b.stats.total - a.stats.total;
    });
  };

  const vehiclesWithBookings = getVehiclesWithBookings();
  const selectedVehicle = vehiclesWithBookings.find(v => v.vehicle?.id === selectedVehicleId);

  const getVehicleMainImageUrl = (vehicle: any): string => {
    if (!vehicle) return 'https://via.placeholder.com/150';
    if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
      return vehicle.images[0];
    }
    if (vehicle.vehicle_photos && Array.isArray(vehicle.vehicle_photos) && vehicle.vehicle_photos.length > 0) {
      return vehicle.vehicle_photos[0].url;
    }
    return 'https://via.placeholder.com/150';
  };

  const renderBooking = ({ item }: { item: VehicleBooking }) => {
    const inProgress = isBookingInProgress(item);
    const completed = isBookingCompleted(item);
    
    // Déterminer le statut à afficher
    let displayStatus = item.status;
    if (completed && item.status !== 'cancelled') {
      displayStatus = 'completed';
    } else if (inProgress) {
      displayStatus = 'in_progress';
    }
    
    const statusColor = getStatusColor(displayStatus);
    const statusText = getStatusText(displayStatus);
    const netEarnings = calculateNetEarnings(item);

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.renterInfo}>
            {item.renter?.avatar_url ? (
              <Image 
                source={{ uri: item.renter.avatar_url }} 
                style={styles.renterAvatar}
              />
            ) : (
              <View style={styles.renterAvatarPlaceholder}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
            <View style={styles.renterDetails}>
              <Text style={styles.renterName}>
                {item.renter?.first_name || 'Locataire'} {item.renter?.last_name || ''}
              </Text>
              {item.renter?.email ? (
                <Text style={styles.renterEmail}>{item.renter.email}</Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {formatDate(item.start_date)} → {formatDate(item.end_date)}
            </Text>
          </View>
          {(item.discount_amount && item.discount_amount > 0) ? (
            <View style={styles.detailRow}>
              <Ionicons name="pricetag-outline" size={16} color="#f59e0b" />
              <Text style={styles.discountDetailText}>
                Réduction: -{item.discount_amount.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#10b981" />
            <Text style={[styles.detailText, styles.netEarnings]}>
              Gain net : {netEarnings.toLocaleString()} FCFA
            </Text>
          </View>
        </View>

        {item.message_to_owner ? (
          <View style={styles.messageSection}>
            <Text style={styles.messageLabel}>Message:</Text>
            <Text style={styles.messageText}>{item.message_to_owner}</Text>
          </View>
        ) : null}

        {/* Afficher la demande de modification en attente directement sur la réservation */}
        {(() => {
          const pendingRequest = modificationRequests.find(req => req.booking_id === item.id);
          if (pendingRequest) {
            const renterName = item.renter
              ? `${item.renter.first_name || ''} ${item.renter.last_name || ''}`.trim()
              : 'Locataire';
            const vehicleTitle = item.vehicle
              ? `${item.vehicle.brand || ''} ${item.vehicle.model || ''}`.trim()
              : 'Véhicule';
            
            return (
              <View style={styles.modificationRequestOnBooking}>
                <HostVehicleModificationRequestCard
                  request={pendingRequest}
                  renterName={renterName}
                  vehicleTitle={vehicleTitle}
                  onUpdated={loadBookings}
                />
              </View>
            );
          }
          return null;
        })()}

        {/* Action buttons */}
        <View style={styles.actionButtonsRow}>
          {/* Détails - toujours visible */}
          <TouchableOpacity
            style={[styles.actionButtonSmall, styles.detailsButton]}
            onPress={() => {
              setSelectedBookingForDetails(item);
              setDetailsModalVisible(true);
            }}
          >
            <Ionicons name="document-text-outline" size={16} color={VEHICLE_COLORS.primary} />
            <Text style={styles.actionButtonSmallText}>Détails</Text>
          </TouchableOpacity>

          {/* Contacter - si le locataire existe */}
          {item.renter?.user_id ? (
            <TouchableOpacity
              style={[styles.actionButtonSmall, styles.contactButton]}
              onPress={() => {
                const renterName = `${item.renter?.first_name || ''} ${item.renter?.last_name || ''}`.trim() || 'Locataire';
                setMessageModalData({
                  bookingId: item.id,
                  vehicleId: item.vehicle?.id || '',
                  otherParticipant: {
                    id: item.renter.user_id,
                    name: renterName,
                    isHost: false,
                  },
                });
                setMessageModalVisible(true);
              }}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#3b82f6" />
              <Text style={[styles.actionButtonSmallText, { color: '#3b82f6' }]}>Contacter</Text>
            </TouchableOpacity>
          ) : null}

          {/* Téléphone - si le locataire a un téléphone */}
          {item.renter?.phone ? (
            <TouchableOpacity
              style={[styles.actionButtonSmall, styles.phoneButton]}
              onPress={() => {
                Linking.openURL(`tel:${item.renter.phone}`);
              }}
            >
              <Ionicons name="call-outline" size={16} color="#10b981" />
            </TouchableOpacity>
          ) : null}

          {/* Voir profil - si le locataire existe */}
          {(item.renter?.user_id || item.renter_id) ? (
            <TouchableOpacity
              style={[styles.actionButtonSmall, styles.viewProfileButton]}
              onPress={() => {
                setSelectedRenterId(item.renter?.user_id || item.renter_id);
                setGuestProfileModalVisible(true);
              }}
            >
              <Ionicons name="person-outline" size={16} color="#2563eb" />
              <Text style={[styles.actionButtonSmallText, { color: '#2563eb' }]}>Profil</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Accepter/Refuser pour pending */}
        {item.status === 'pending' && (
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => handleStatusUpdate(item, 'confirmed')}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleStatusUpdate(item, 'cancelled')}
            >
              <Ionicons name="close-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Annuler pour confirmed ou in_progress */}
        {(item.status === 'confirmed' || displayStatus === 'in_progress') && !completed && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelBookingButton]}
            onPress={() => {
              setSelectedBookingForCancellation(item);
              setCancellationModalVisible(true);
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
            <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Annuler la réservation</Text>
          </TouchableOpacity>
        )}

        {/* Évaluer le locataire pour les réservations terminées */}
        {(completed && item.status !== 'cancelled' && canReviewRenter[item.id] && item.renter?.user_id && item.vehicle?.id) ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.reviewButton]}
            onPress={() => {
              setSelectedBookingForRenterReview(item);
              setRenterReviewModalVisible(true);
            }}
          >
            <Ionicons name="star-outline" size={18} color="#fbbf24" />
            <Text style={[styles.actionButtonText, { color: '#fbbf24' }]}>Évaluer le locataire</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune réservation</Text>
      <Text style={styles.emptySubtitle}>
        {selectedFilter === 'all' 
          ? "Vous n'avez pas encore de réservation pour vos véhicules"
          : `Aucune réservation ${selectedFilter === 'pending' ? 'en attente' : selectedFilter === 'confirmed' ? 'confirmée' : selectedFilter === 'completed' ? 'terminée' : 'annulée'}`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!selectedVehicleId ? (
        // Vue liste des véhicules
        <>
          <View style={styles.header}>
            <View style={styles.placeholder} />
            <Text style={styles.headerTitle}>Réservations de véhicules</Text>
            <View style={styles.placeholder} />
          </View>

          {vehiclesWithBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucun véhicule</Text>
              <Text style={styles.emptySubtitle}>
                Vous n'avez pas encore ajouté de véhicule.
              </Text>
            </View>
          ) : (
            <FlatList
              data={vehiclesWithBookings}
              keyExtractor={(item) => item.vehicle.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.vehicleCard,
                    item.isCurrentlyRented && styles.vehicleCardRented
                  ]}
                  onPress={() => setSelectedVehicleId(item.vehicle.id)}
                >
                  <Image
                    source={{ uri: getVehicleMainImageUrl(item.vehicle) }}
                    style={styles.vehicleCardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.vehicleCardContent}>
                    <View style={styles.vehicleCardHeader}>
                      <Text style={styles.vehicleCardTitle} numberOfLines={2}>
                        {item.vehicle.brand} {item.vehicle.model}
                      </Text>
                      {item.isCurrentlyRented ? (
                        <View style={styles.rentedBadge}>
                          <Text style={styles.rentedBadgeText}>En location</Text>
                        </View>
                      ) : item.stats.pending > 0 && item.isAvailable ? (
                        <View style={[styles.unavailableBadge, { backgroundColor: '#f59e0b' }]}>
                          <Text style={styles.unavailableBadgeText}>En attente ({item.stats.pending})</Text>
                        </View>
                      ) : item.isAvailable ? (
                        <View style={styles.availableBadge}>
                          <Text style={styles.availableBadgeText}>Disponible</Text>
                        </View>
                      ) : (
                        <View style={styles.unavailableBadge}>
                          <Text style={styles.unavailableBadgeText}>Indisponible</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.vehicleCardYear}>{item.vehicle.year}</Text>
                    <View style={styles.vehicleCardStats}>
                      <Text style={styles.vehicleCardStatText}>
                        Total: {item.stats.total}
                      </Text>
                      {item.stats.pending > 0 && (
                        <Text style={[styles.vehicleCardStatText, { color: '#FFA500' }]}>
                          En attente: {item.stats.pending}
                        </Text>
                      )}
                      {item.stats.confirmed > 0 && (
                        <Text style={[styles.vehicleCardStatText, { color: '#4CAF50' }]}>
                          Confirmées: {item.stats.confirmed}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={VEHICLE_COLORS.primary}
                />
              }
            />
          )}
        </>
      ) : (
        // Vue détaillée des réservations d'un véhicule
        <>
          {/* En-tête avec bouton retour */}
          <View style={styles.detailHeader}>
            <TouchableOpacity
              style={styles.backToVehiclesButton}
              onPress={() => {
                setSelectedVehicleId(null);
                setSelectedFilter('all');
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#334155" />
              <Text style={styles.backToVehiclesText}>Retour aux véhicules</Text>
            </TouchableOpacity>
          </View>

          {/* Informations du véhicule */}
          {selectedVehicle && (
            <View style={styles.selectedVehicleInfo}>
              <Image
                source={{ uri: getVehicleMainImageUrl(selectedVehicle.vehicle) }}
                style={styles.selectedVehicleImage}
                resizeMode="cover"
              />
              <View style={styles.selectedVehicleDetails}>
                <Text style={styles.selectedVehicleTitle}>
                  {selectedVehicle.vehicle.brand} {selectedVehicle.vehicle.model}
                </Text>
                <Text style={styles.selectedVehicleYear}>
                  {selectedVehicle.vehicle.year} - {selectedVehicle.vehicle.fuel_type}
                </Text>
              </View>
            </View>
          )}

          {/* Filtres */}
          <View style={styles.filters}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filtersContent}
            >
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'in_progress', label: 'En cours' },
                { key: 'pending', label: 'En attente' },
                { key: 'confirmed', label: 'Confirmées' },
                { key: 'cancelled', label: 'Annulées' },
                { key: 'completed', label: 'Terminées' },
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter.key && styles.filterButtonActive,
                  ]}
                  onPress={() => setSelectedFilter(filter.key as any)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedFilter === filter.key && styles.filterButtonTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Liste des réservations */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredBookings}
              renderItem={renderBooking}
              keyExtractor={(item) => item.id}
              contentContainerStyle={filteredBookings.length === 0 ? styles.emptyContainer : styles.listContainer}
              ListEmptyComponent={renderEmptyState}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={VEHICLE_COLORS.primary}
                />
              }
            />
          )}
        </>
      )}

      {/* Modals */}
      <VehicleBookingDetailsModal
        visible={detailsModalVisible}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedBookingForDetails(null);
        }}
        booking={selectedBookingForDetails}
        isOwner={true}
      />

      {messageModalData && (
        <SimpleMessageModal
          visible={messageModalVisible}
          onClose={() => {
            setMessageModalVisible(false);
            setMessageModalData(null);
          }}
          bookingId={messageModalData.bookingId}
          vehicleId={messageModalData.vehicleId}
          otherParticipant={messageModalData.otherParticipant}
        />
      )}

      <VehicleCancellationModal
        visible={cancellationModalVisible}
        onClose={() => {
          setCancellationModalVisible(false);
          setSelectedBookingForCancellation(null);
        }}
        booking={selectedBookingForCancellation}
        isOwner={true}
        onCancelled={() => {
          loadBookings();
          setCancellationModalVisible(false);
          setSelectedBookingForCancellation(null);
        }}
      />

      <GuestProfileModal
        visible={guestProfileModalVisible}
        onClose={() => {
          setGuestProfileModalVisible(false);
          setSelectedRenterId(null);
        }}
        guestId={selectedRenterId || ''}
      />

      {selectedBookingForRenterReview && selectedBookingForRenterReview.renter && selectedBookingForRenterReview.vehicle && (
        <VehicleRenterReviewModal
          visible={renterReviewModalVisible}
          onClose={() => {
            setRenterReviewModalVisible(false);
            setSelectedBookingForRenterReview(null);
          }}
          bookingId={selectedBookingForRenterReview.id}
          renterId={selectedBookingForRenterReview.renter.user_id}
          renterName={`${selectedBookingForRenterReview.renter.first_name || ''} ${selectedBookingForRenterReview.renter.last_name || ''}`.trim() || 'Locataire'}
          vehicleId={selectedBookingForRenterReview.vehicle.id}
          onReviewSubmitted={() => {
            loadBookings();
            setRenterReviewModalVisible(false);
            setSelectedBookingForRenterReview(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  filters: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filtersContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 0,
  },
  filterButtonActive: {
    backgroundColor: '#1e293b', // slate-800 comme sur le site web
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  renterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  renterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  renterAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renterDetails: {
    flex: 1,
  },
  renterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  renterEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  netEarnings: {
    color: '#10b981',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  discountDetailText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
  },
  messageSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    flex: 1,
    minWidth: 100,
  },
  actionButtonSmallText: {
    fontSize: 13,
    fontWeight: '500',
    color: VEHICLE_COLORS.primary,
  },
  detailsButton: {
    borderColor: VEHICLE_COLORS.primary,
    backgroundColor: '#fff',
  },
  contactButton: {
    borderColor: '#3b82f6',
    backgroundColor: '#fff',
  },
  phoneButton: {
    borderColor: '#10b981',
    backgroundColor: '#fff',
    minWidth: 44,
    flex: 0,
  },
  viewProfileButton: {
    borderColor: '#2563eb',
    backgroundColor: '#fff',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  cancelBookingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  vehicleCardRented: {
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  vehicleCardImage: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  vehicleCardContent: {
    flex: 1,
    padding: 12,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  vehicleCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  rentedBadge: {
    backgroundColor: '#1e293b', // slate-800 comme sur le site web
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rentedBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  availableBadge: {
    backgroundColor: '#22c55e', // green-500 comme sur le site web
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  unavailableBadge: {
    backgroundColor: '#f97316', // orange-500 comme sur le site web
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unavailableBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  modificationRequestOnBooking: {
    marginTop: 12,
    marginBottom: 12,
  },
  vehicleCardYear: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  vehicleCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleCardStatText: {
    fontSize: 12,
    color: '#666',
  },
  propertyHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backToVehiclesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToVehiclesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  selectedVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    gap: 16,
  },
  selectedVehicleImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  selectedVehicleDetails: {
    flex: 1,
  },
  selectedVehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectedVehicleYear: {
    fontSize: 14,
    color: '#666',
  },
});

export default HostVehicleBookingsScreen;





