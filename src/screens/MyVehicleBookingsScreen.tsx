import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useBookings, Booking } from '../hooks/useBookings';
import { useAuth } from '../services/AuthContext';
import { VehicleBooking } from '../types';
import { formatPrice } from '../utils/priceCalculator';
import VehicleCancellationModal from '../components/VehicleCancellationModal';
import VehicleModificationModal from '../components/VehicleModificationModal';
import VehicleReviewModal from '../components/VehicleReviewModal';
import BookingCard from '../components/BookingCard';
import ReviewModal from '../components/ReviewModal';
import CancellationDialog from '../components/CancellationDialog';
import BookingModificationModal from '../components/BookingModificationModal';
import { useVehicleReviews } from '../hooks/useVehicleReviews';
import { useReviews } from '../hooks/useReviews';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';
import { useBookingModifications } from '../hooks/useBookingModifications';
import { getCommissionRates } from '../lib/commissions';
import ContactOwnerButton from '../components/ContactOwnerButton';

const MyVehicleBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getMyBookings, loading: vehiclesLoading } = useVehicleBookings();
  const { getUserBookings, loading: propertiesLoading } = useBookings();
  const { canReviewVehicle } = useVehicleReviews();
  const { canUserReviewProperty } = useReviews();
  const { getBookingPendingRequest, cancelModificationRequest } = useVehicleBookingModifications();
  const { getBookingPendingRequest: getPropertyBookingPendingRequest } = useBookingModifications();
  const [cancellingRequests, setCancellingRequests] = useState<{ [key: string]: boolean }>({});
  const [bookings, setBookings] = useState<VehicleBooking[]>([]);
  const [propertyBookings, setPropertyBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<{ [key: string]: any }>({});
  const [activeTab, setActiveTab] = useState<'vehicles' | 'properties'>('vehicles');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress'>('all');
  const [cancellationModalVisible, setCancellationModalVisible] = useState(false);
  const [propertyCancellationDialogVisible, setPropertyCancellationDialogVisible] = useState(false);
  const [selectedBookingForCancellation, setSelectedBookingForCancellation] = useState<VehicleBooking | null>(null);
  const [selectedPropertyBookingForCancellation, setSelectedPropertyBookingForCancellation] = useState<Booking | null>(null);
  const [modificationModalVisible, setModificationModalVisible] = useState(false);
  const [propertyModificationModalVisible, setPropertyModificationModalVisible] = useState(false);
  const [selectedBookingForModification, setSelectedBookingForModification] = useState<VehicleBooking | null>(null);
  const [selectedPropertyBookingForModification, setSelectedPropertyBookingForModification] = useState<Booking | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [propertyReviewModalVisible, setPropertyReviewModalVisible] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<VehicleBooking | null>(null);
  const [selectedPropertyBookingForReview, setSelectedPropertyBookingForReview] = useState<Booking | null>(null);
  const [canReview, setCanReview] = useState<{ [key: string]: boolean }>({});
  const [canReviewProperty, setCanReviewProperty] = useState<Record<string, boolean>>({});
  const loading = vehiclesLoading || propertiesLoading;

  const getBookingStatus = (booking: VehicleBooking): string => {
    if (booking.status === 'cancelled') return 'cancelled';
    if (booking.status === 'pending') return 'pending';
    if (booking.status === 'confirmed') {
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      if (endDate < today) return 'completed';
      if (startDate <= today && today <= endDate) return 'in_progress';
      return 'confirmed';
    }
    return booking.status || 'pending';
  };

  const isStayCompleted = (checkOutDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOutDate);
    checkout.setHours(0, 0, 0, 0);
    return checkout < today;
  };

  const isPropertyBookingInProgress = (booking: Booking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(booking.check_out_date);
    checkOut.setHours(0, 0, 0, 0);
    return booking.status === 'confirmed' && checkIn <= today && checkOut >= today;
  };

  const loadBookings = async () => {
    try {
      // Charger les deux types de réservations en parallèle
      const [userVehicleBookings, userPropertyBookings] = await Promise.all([
        getMyBookings(),
        getUserBookings()
      ]);
      
      setBookings(userVehicleBookings);
      setPropertyBookings(userPropertyBookings);
      
      // Charger les demandes de modification en attente pour chaque réservation de véhicule
      const requestsMap: { [key: string]: any } = {};
      for (const booking of userVehicleBookings) {
        if (booking.id) {
          try {
            const request = await getBookingPendingRequest(booking.id);
            if (request) {
              requestsMap[booking.id] = request;
            }
          } catch (err) {
            console.error('Erreur chargement demande modification:', err);
          }
        }
      }
      setPendingRequests(requestsMap);
      
      // Vérifier pour chaque réservation de véhicule terminée si l'utilisateur peut noter le véhicule
      const canReviewMap: { [key: string]: boolean } = {};
      for (const booking of userVehicleBookings) {
        const status = getBookingStatus(booking);
        if (status === 'completed' && booking.status !== 'cancelled') {
          if (booking.vehicle?.id && booking.id) {
            canReviewMap[booking.id] = await canReviewVehicle(booking.id);
          }
        }
      }
      setCanReview(canReviewMap);

      // Vérifier pour chaque réservation de propriété terminée si l'utilisateur peut noter la propriété
      const canReviewPropertyPromises = userPropertyBookings
        .filter(booking => 
          (booking.status === 'confirmed' || booking.status === 'completed') &&
          isStayCompleted(booking.check_out_date)
        )
        .map(async (booking) => {
          const canReview = await canUserReviewProperty(
            booking.property_id,
            booking.id
          );
          return { bookingId: booking.id, canReview };
        });
      
      const canReviewPropertyResults = await Promise.all(canReviewPropertyPromises);
      const canReviewPropertyMapResult: Record<string, boolean> = {};
      canReviewPropertyResults.forEach(({ bookingId, canReview }) => {
        canReviewPropertyMapResult[bookingId] = canReview;
      });
      setCanReviewProperty(canReviewPropertyMapResult);
    } catch (err) {
      console.error('Erreur lors du chargement des réservations:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadBookings();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'all':
        return 'Toutes';
      case 'pending':
        return 'En attente';
      case 'confirmed':
        return 'Confirmées';
      case 'completed':
        return 'Terminées';
      case 'cancelled':
        return 'Annulées';
      case 'in_progress':
        return 'En cours';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'confirmed':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'completed':
        return '#6366f1';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
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

  const formatDateWithTime = (dateString: string, dateTimeString?: string) => {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    if (dateTimeString) {
      const time = new Date(dateTimeString);
      const timeFormatted = time.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateFormatted} à ${timeFormatted}`;
    }
    return dateFormatted;
  };

  const filteredBookings = bookings.filter(booking => {
    const status = getBookingStatus(booking);
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return status === 'in_progress';
    return status === selectedFilter;
  });

  const filteredPropertyBookings = propertyBookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return isPropertyBookingInProgress(booking);
    return booking.status === selectedFilter;
  });

  // Obtenir les items à afficher selon l'onglet actif
  const getDisplayItems = () => {
    if (activeTab === 'vehicles') return filteredBookings;
    return filteredPropertyBookings;
  };

  const displayItems = getDisplayItems();
  const totalCount = bookings.length + propertyBookings.length;

  const canModifyBooking = (booking: VehicleBooking) => {
    // Ne peut pas modifier si annulée ou terminée
    if (booking.status === 'cancelled' || booking.status === 'completed') return false;
    
    // Ne peut pas modifier si la date de fin est passée
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return false;
    
    // Peut modifier si pending, confirmed ou in_progress et que la date de fin n'est pas passée
    return booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress';
  };

  const renderBookingItem = ({ item: booking }: { item: VehicleBooking }) => {
    const status = getBookingStatus(booking);
    const statusColor = getStatusColor(status);
    const vehicle = booking.vehicle;
    const vehicleImage = vehicle?.images?.[0] || vehicle?.vehicle_photos?.[0]?.url || null;
    const rentalDays = booking.rental_days || 1;
    const rentalHours = booking.rental_hours || 0;
    
    // Calculer le prix des jours
    const daysPrice = (booking.daily_rate || 0) * rentalDays;
    
    // Calculer le prix des heures supplémentaires si applicable
    // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
    const hourlyRate = booking.hourly_rate || vehicle?.price_per_hour || 0;
    let hoursPrice = 0;
    if (rentalHours > 0 && hourlyRate > 0) {
      hoursPrice = rentalHours * hourlyRate;
    }
    
    // Prix de base = prix des jours + prix des heures
    const basePrice = daysPrice + hoursPrice;
    const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
    
    // Ajouter le surplus chauffeur si applicable
    const driverFee = (booking.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
    const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee;
    
    const commissionRates = getCommissionRates('vehicle');
    // IMPORTANT: Calculer les frais de service sur priceAfterDiscountWithDriver (inclut le chauffeur)
    // Frais de service avec TVA (10% + 20% TVA = 12% total)
    const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100));
    const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
    const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
    const totalWithServiceFee = priceAfterDiscountWithDriver + effectiveServiceFee;

    const handleViewDetails = () => {
      (navigation as any).navigate('VehicleBookingDetails', { bookingId: booking.id });
    };

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={handleViewDetails}
        activeOpacity={0.8}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.vehicleInfo}>
            {vehicleImage ? (
              <Image
                source={{ uri: vehicleImage }}
                style={styles.vehicleImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
                <Ionicons name="car-outline" size={32} color="#ccc" />
              </View>
            )}
            <View style={styles.vehicleDetails}>
              <Text style={styles.vehicleTitle} numberOfLines={2}>
                {vehicle?.title || `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Véhicule'}
              </Text>
              <Text style={styles.vehicleLocation}>
                📍 {vehicle?.location?.name || 'Localisation inconnue'}
              </Text>
              <View style={styles.dateContainer}>
                <Text style={styles.dateText}>
                  {formatDateWithTime(booking.start_date, booking.start_datetime)} - {formatDateWithTime(booking.end_date, booking.end_datetime)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{getStatusText(status)}</Text>
            </View>
          </View>
        </View>

        {/* Afficher la demande de modification en cours */}
        {pendingRequests[booking.id] && (
          <View style={styles.modificationRequestBanner}>
            <Ionicons name="time-outline" size={18} color="#f39c12" />
            <View style={styles.modificationRequestContent}>
              <Text style={styles.modificationRequestTitle}>Demande de modification en cours</Text>
              <Text style={styles.modificationRequestDates}>
                Nouvelles dates proposées: {formatDate(pendingRequests[booking.id].requested_start_date)} - {formatDate(pendingRequests[booking.id].requested_end_date)}
              </Text>
              <TouchableOpacity
                style={styles.cancelModificationButton}
                onPress={async () => {
                  const requestId = pendingRequests[booking.id].id;
                  if (cancellingRequests[requestId]) return;
                  Alert.alert(
                    'Annuler la demande',
                    'Êtes-vous sûr de vouloir annuler cette demande de modification ?',
                    [
                      { text: 'Non', style: 'cancel' },
                      {
                        text: 'Oui',
                        style: 'destructive',
                        onPress: async () => {
                          setCancellingRequests(prev => ({ ...prev, [requestId]: true }));
                          const result = await cancelModificationRequest(requestId);
                          if (result.success) {
                            await loadBookings();
                          }
                          setCancellingRequests(prev => ({ ...prev, [requestId]: false }));
                        },
                      },
                    ]
                  );
                }}
                disabled={cancellingRequests[pendingRequests[booking.id].id]}
              >
                <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.cancelModificationButtonText}>
                  {cancellingRequests[pendingRequests[booking.id].id] ? 'Annulation...' : 'Annuler la demande'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.bookingDetails}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              {formatPrice(totalWithServiceFee)}
            </Text>
          </View>
        </View>

        {booking.message_to_owner && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Message au propriétaire :</Text>
            <Text style={styles.messageText}>{booking.message_to_owner}</Text>
          </View>
        )}

        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleViewDetails}
          >
            <Ionicons name="receipt-outline" size={16} color="#2E7D32" />
            <Text style={styles.actionButtonText}>Voir détails</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (vehicle?.id) {
                navigation.navigate('VehicleDetails' as never, { vehicleId: vehicle.id } as never);
              }
            }}
          >
            <Ionicons name="eye-outline" size={16} color="#2E7D32" />
            <Text style={styles.actionButtonText}>Voir véhicule</Text>
          </TouchableOpacity>

          {/* Bouton Contacter le propriétaire */}
          {vehicle && booking.status !== 'cancelled' && vehicle.owner_id && (
            <View style={styles.contactButtonWrapper}>
              <ContactOwnerButton
                vehicle={vehicle}
                variant="outline"
                size="small"
                showIcon={true}
              />
            </View>
          )}

          {status === 'completed' && canReview[booking.id] && (
            <TouchableOpacity
              style={[styles.actionButton, styles.reviewButton]}
              onPress={() => {
                setSelectedBookingForReview(booking);
                setReviewModalVisible(true);
              }}
            >
              <Ionicons name="star-outline" size={16} color="#FFD700" />
              <Text style={[styles.actionButtonText, styles.reviewButtonText]}>
                Avis
              </Text>
            </TouchableOpacity>
          )}

          {canModifyBooking(booking) && (
            <>
              {!pendingRequests[booking.id] && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.modifyButton]}
                  onPress={async () => {
                    try {
                      const pendingRequest = await getBookingPendingRequest(booking.id);
                      if (pendingRequest) {
                        Alert.alert(
                          'Demande en cours',
                          'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse du propriétaire ou annuler la demande existante.'
                        );
                        return;
                      }
                    } catch (error) {
                      console.error('Erreur lors de la vérification de la demande en cours:', error);
                      Alert.alert('Erreur', 'Impossible de vérifier les demandes en cours. Veuillez réessayer.');
                      return;
                    }
                    setSelectedBookingForModification(booking);
                    setModificationModalVisible(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#3498db" />
                  <Text style={[styles.actionButtonText, styles.modifyButtonText]}>
                    Modifier
                  </Text>
                </TouchableOpacity>
              )}
              {(status === 'pending' || status === 'confirmed' || status === 'in_progress') && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setSelectedBookingForCancellation(booking);
                    setCancellationModalVisible(true);
                  }}
                >
                  <Ionicons name="close-outline" size={16} color="#e74c3c" />
                  <Text style={[styles.actionButtonText, styles.cancelButtonText]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const handlePropertyCancelBooking = (booking: Booking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(booking.check_out_date);
    checkOutDate.setHours(0, 0, 0, 0);

    if (booking.status === 'completed') {
      Alert.alert('Impossible d\'annuler', 'Cette réservation est terminée et ne peut plus être annulée.');
      return;
    }

    if (booking.status === 'cancelled') {
      Alert.alert('Réservation annulée', 'Cette réservation est déjà annulée.');
      return;
    }

    if (checkOutDate < today) {
      Alert.alert('Impossible d\'annuler', 'Cette réservation concerne des dates passées et ne peut plus être annulée.');
      return;
    }

    setSelectedPropertyBookingForCancellation(booking);
    setPropertyCancellationDialogVisible(true);
  };

  const handlePropertyModifyBooking = async (booking: Booking) => {
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      Alert.alert('Impossible de modifier', 'Cette réservation ne peut plus être modifiée.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(booking.check_out_date);
    checkout.setHours(0, 0, 0, 0);
    
    if (checkout < today) {
      Alert.alert('Impossible de modifier', 'Cette réservation est terminée et ne peut plus être modifiée.');
      return;
    }
    
    try {
      const pendingRequest = await getPropertyBookingPendingRequest(booking.id);
      if (pendingRequest) {
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
    
    setSelectedPropertyBookingForModification(booking);
    setPropertyModificationModalVisible(true);
  };

  const handlePropertyViewProperty = (propertyId: string) => {
    navigation.navigate('PropertyDetails', { propertyId });
  };

  const handlePropertyLeaveReview = (booking: Booking) => {
    setSelectedPropertyBookingForReview(booking);
    setPropertyReviewModalVisible(true);
  };

  const renderPropertyBookingItem = ({ item: booking }: { item: Booking }) => (
    <BookingCard
      booking={booking}
      onViewProperty={handlePropertyViewProperty}
      onCancelBooking={handlePropertyCancelBooking}
      onLeaveReview={handlePropertyLeaveReview}
      onModifyBooking={handlePropertyModifyBooking}
      canReview={canReviewProperty[booking.id] || false}
    />
  );

  const renderEmptyState = () => {
    const hasAnyBookings = totalCount > 0;
    const emptyMessage = activeTab === 'vehicles' 
      ? 'Aucune réservation de véhicule'
      : 'Aucune réservation de résidence meublée';
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={activeTab === 'properties' ? 'home-outline' : 'car-outline'} size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptySubtitle}>
          {selectedFilter === 'all' 
            ? hasAnyBookings 
              ? `Aucune réservation ${activeTab === 'vehicles' ? 'de véhicule' : 'de résidence'} ${getStatusText(selectedFilter).toLowerCase()}`
              : 'Vous n\'avez pas encore de réservations'
            : `Aucune réservation ${getStatusText(selectedFilter).toLowerCase()}`
          }
        </Text>
        {!hasAnyBookings && (
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => {
              if (activeTab === 'properties') {
                (navigation as any).navigate('Home', { screen: 'HomeTab' });
              } else {
                (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' });
              }
            }}
          >
            <Text style={styles.exploreButtonText}>
              {activeTab === 'properties' ? 'Explorer les résidences' : 'Découvrir des véhicules'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFilterButton = (filter: typeof selectedFilter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptySubtitle}>
            Vous devez être connecté pour voir vos réservations
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Auth' as never)}
          >
            <Text style={styles.exploreButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>Mes réservations</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Onglets */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicles' && styles.tabActive]}
          onPress={() => setActiveTab('vehicles')}
        >
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
            Véhicules ({bookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
          onPress={() => setActiveTab('properties')}
        >
          <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>
            Résidences ({propertyBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContent}>
            {renderFilterButton('all', 'Toutes')}
            {renderFilterButton('in_progress', 'En cours')}
            {renderFilterButton('pending', 'En attente')}
            {renderFilterButton('confirmed', 'Confirmées')}
            {renderFilterButton('completed', 'Terminées')}
            {renderFilterButton('cancelled', 'Annulées')}
          </View>
        </ScrollView>
      </View>

      {/* Liste des réservations */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement des réservations...</Text>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          renderItem={activeTab === 'properties' ? renderPropertyBookingItem : renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2E7D32']}
              tintColor="#2E7D32"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal d'annulation */}
      {selectedBookingForCancellation && (
        <VehicleCancellationModal
          visible={cancellationModalVisible}
          onClose={() => {
            setCancellationModalVisible(false);
            setSelectedBookingForCancellation(null);
          }}
          booking={selectedBookingForCancellation}
          isOwner={false}
          onCancelled={() => {
            loadBookings();
            setCancellationModalVisible(false);
            setSelectedBookingForCancellation(null);
          }}
        />
      )}

      {/* Modal de modification */}
      {selectedBookingForModification && (
        <VehicleModificationModal
          visible={modificationModalVisible}
          onClose={() => {
            setModificationModalVisible(false);
            setSelectedBookingForModification(null);
          }}
          booking={selectedBookingForModification}
          onModified={() => {
            loadBookings();
            setModificationModalVisible(false);
            setSelectedBookingForModification(null);
          }}
        />
      )}

      {/* Modal d'avis véhicule */}
      {selectedBookingForReview && selectedBookingForReview.vehicle && (
        <VehicleReviewModal
          visible={reviewModalVisible}
          onClose={() => {
            setReviewModalVisible(false);
            setSelectedBookingForReview(null);
          }}
          vehicleId={selectedBookingForReview.vehicle.id}
          bookingId={selectedBookingForReview.id}
          vehicleTitle={selectedBookingForReview.vehicle.title || `${selectedBookingForReview.vehicle.brand || ''} ${selectedBookingForReview.vehicle.model || ''}`.trim() || 'Véhicule'}
          onReviewSubmitted={() => {
            loadBookings();
            setReviewModalVisible(false);
            setSelectedBookingForReview(null);
          }}
        />
      )}

      {/* Modals pour les réservations de propriétés */}
      <ReviewModal
        visible={propertyReviewModalVisible}
        onClose={() => {
          setPropertyReviewModalVisible(false);
          setSelectedPropertyBookingForReview(null);
        }}
        propertyId={selectedPropertyBookingForReview?.property_id || ''}
        bookingId={selectedPropertyBookingForReview?.id || ''}
        onReviewSubmitted={() => {
          loadBookings();
          setPropertyReviewModalVisible(false);
          setSelectedPropertyBookingForReview(null);
        }}
      />

      {selectedPropertyBookingForCancellation && (
        <CancellationDialog
          visible={propertyCancellationDialogVisible}
          onClose={() => {
            setPropertyCancellationDialogVisible(false);
            setSelectedPropertyBookingForCancellation(null);
          }}
          booking={{
            id: selectedPropertyBookingForCancellation.id,
            check_in_date: selectedPropertyBookingForCancellation.check_in_date,
            check_out_date: selectedPropertyBookingForCancellation.check_out_date,
            total_price: selectedPropertyBookingForCancellation.total_price,
            status: selectedPropertyBookingForCancellation.status,
            properties: {
              title: selectedPropertyBookingForCancellation.properties?.title || 'Propriété',
              price_per_night: selectedPropertyBookingForCancellation.properties?.price_per_night || 0,
              cancellation_policy: selectedPropertyBookingForCancellation.properties?.cancellation_policy || null,
            },
          }}
          onCancelled={() => {
            loadBookings();
            setPropertyCancellationDialogVisible(false);
            setSelectedPropertyBookingForCancellation(null);
          }}
        />
      )}

      {selectedPropertyBookingForModification && (
        <BookingModificationModal
          visible={propertyModificationModalVisible}
          onClose={() => {
            setPropertyModificationModalVisible(false);
            setSelectedPropertyBookingForModification(null);
          }}
          booking={selectedPropertyBookingForModification}
          onModificationRequested={() => {
            loadBookings();
            setPropertyModificationModalVisible(false);
            setSelectedPropertyBookingForModification(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filtersContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
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
  vehicleInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  vehicleImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  vehicleImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vehicleLocation: {
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
  daysText: {
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
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
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
  actionButtonText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
    marginLeft: 4,
  },
  contactButton: {
    borderColor: '#e67e22',
  },
  contactButtonText: {
    color: '#e67e22',
  },
  contactButtonWrapper: {
    flex: 1,
    minWidth: 100,
  },
  cancelButton: {
    borderColor: '#e74c3c',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default MyVehicleBookingsScreen;

