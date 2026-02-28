import React, { useState, useEffect } from 'react';
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
import { useBookings, Booking } from '../hooks/useBookings';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { VehicleBooking } from '../types';
import { useAuth } from '../services/AuthContext';
import { useReviews } from '../hooks/useReviews';
import { useVehicleReviews } from '../hooks/useVehicleReviews';
import BookingCard from '../components/BookingCard';
import ReviewModal from '../components/ReviewModal';
import VehicleReviewModal from '../components/VehicleReviewModal';
import CancellationDialog from '../components/CancellationDialog';
import VehicleCancellationModal from '../components/VehicleCancellationModal';
import BookingModificationModal from '../components/BookingModificationModal';
import VehicleModificationModal from '../components/VehicleModificationModal';
import { useBookingModifications } from '../hooks/useBookingModifications';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';
import ContactOwnerButton from '../components/ContactOwnerButton';
import { useCurrency } from '../hooks/useCurrency';

const MyBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { currency, rates } = useCurrency();
  const { getUserBookings, cancelBooking, loading: propertiesLoading, error } = useBookings();
  const { getMyBookings: getVehicleBookings, loading: vehiclesLoading } = useVehicleBookings();
  const { canUserReviewProperty } = useReviews();
  const { canReviewVehicle } = useVehicleReviews();
  const { getBookingPendingRequest } = useBookingModifications();
  const { getBookingPendingRequest: getVehicleBookingPendingRequest } = useVehicleBookingModifications();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicleBookings, setVehicleBookings] = useState<VehicleBooking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'vehicles'>('properties');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress'>('all');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [vehicleReviewModalVisible, setVehicleReviewModalVisible] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);
  const [selectedVehicleBookingForReview, setSelectedVehicleBookingForReview] = useState<VehicleBooking | null>(null);
  const [canReviewMap, setCanReviewMap] = useState<Record<string, boolean>>({});
  const [canReviewVehicleMap, setCanReviewVehicleMap] = useState<Record<string, boolean>>({});
  const [cancellationDialogVisible, setCancellationDialogVisible] = useState(false);
  const [vehicleCancellationModalVisible, setVehicleCancellationModalVisible] = useState(false);
  const [selectedBookingForCancellation, setSelectedBookingForCancellation] = useState<Booking | null>(null);
  const [selectedVehicleBookingForCancellation, setSelectedVehicleBookingForCancellation] = useState<VehicleBooking | null>(null);
  const [modificationModalVisible, setModificationModalVisible] = useState(false);
  const [vehicleModificationModalVisible, setVehicleModificationModalVisible] = useState(false);
  const [selectedBookingForModification, setSelectedBookingForModification] = useState<Booking | null>(null);
  const [selectedVehicleBookingForModification, setSelectedVehicleBookingForModification] = useState<VehicleBooking | null>(null);
  const [vehiclePendingRequests, setVehiclePendingRequests] = useState<{ [key: string]: any }>({});
  const loading = propertiesLoading || vehiclesLoading;

  const canModifyVehicleBooking = (booking: VehicleBooking) => {
    if (booking.status === 'cancelled' || booking.status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) return false;
    return booking.status === 'pending' || booking.status === 'confirmed';
  };

  const isStayCompleted = (checkOutDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOutDate);
    checkout.setHours(0, 0, 0, 0);
    return checkout < today;
  };

  const getVehicleBookingStatus = (booking: VehicleBooking): string => {
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

  const loadBookings = async () => {
    try {
      // Charger les deux types de réservations en parallèle
      const [userBookings, userVehicleBookings] = await Promise.all([
        getUserBookings(),
        getVehicleBookings()
      ]);
      
      setBookings(userBookings);
      setVehicleBookings(userVehicleBookings);
      
      // Vérifier quelles réservations de propriétés peuvent être notées
      const canReviewPromises = userBookings
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
      
      const canReviewResults = await Promise.all(canReviewPromises);
      const canReviewMapResult: Record<string, boolean> = {};
      canReviewResults.forEach(({ bookingId, canReview }) => {
        canReviewMapResult[bookingId] = canReview;
      });
      setCanReviewMap(canReviewMapResult);

      // Vérifier quelles réservations de véhicules peuvent être notées
      const canReviewVehiclePromises = userVehicleBookings
        .filter(booking => {
          const status = getVehicleBookingStatus(booking);
          return status === 'completed' && booking.status !== 'cancelled';
        })
        .map(async (booking) => {
          if (booking.vehicle?.id && booking.id) {
            const canReview = await canReviewVehicle(booking.id);
            return { bookingId: booking.id, canReview };
          }
          return { bookingId: booking.id, canReview: false };
        });
      
      const canReviewVehicleResults = await Promise.all(canReviewVehiclePromises);
      const canReviewVehicleMapResult: Record<string, boolean> = {};
      canReviewVehicleResults.forEach(({ bookingId, canReview }) => {
        canReviewVehicleMapResult[bookingId] = canReview;
      });
      setCanReviewVehicleMap(canReviewVehicleMapResult);

      // Charger les demandes de modification en attente pour les véhicules (optimisé avec Promise.all)
      const vehicleRequestsPromises = userVehicleBookings
        .filter(booking => booking.id)
        .map(async (booking) => {
          try {
            const request = await getVehicleBookingPendingRequest(booking.id!);
            return { bookingId: booking.id!, request };
          } catch (err) {
            console.error('Erreur chargement demande modification véhicule:', err);
            return { bookingId: booking.id!, request: null };
          }
        });
      
      const vehicleRequestsResults = await Promise.all(vehicleRequestsPromises);
      const vehicleRequestsMap: { [key: string]: any } = {};
      vehicleRequestsResults.forEach(({ bookingId, request }) => {
        if (request) {
          vehicleRequestsMap[bookingId] = request;
        }
      });
      setVehiclePendingRequests(vehicleRequestsMap);
    } catch (err) {
      console.error('Erreur lors du chargement des réservations:', err);
    }
  };

  // Charger les réservations quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
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

  const handleCancelBooking = (booking: Booking) => {
    // Vérifier si la réservation peut être annulée
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

    // Ouvrir le dialogue d'annulation avec pénalité
    setSelectedBookingForCancellation(booking);
    setCancellationDialogVisible(true);
  };

  const handleViewProperty = (propertyId: string) => {
    navigation.navigate('PropertyDetails', { propertyId });
  };

  const handleLeaveReview = (booking: Booking) => {
    setSelectedBookingForReview(booking);
    setReviewModalVisible(true);
  };

  const handleModifyBooking = async (booking: Booking) => {
    // Vérifier si la réservation peut être modifiée
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      Alert.alert('Impossible de modifier', 'Cette réservation ne peut plus être modifiée.');
      return;
    }

    // Vérifier si le checkout est passé
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(booking.check_out_date);
    checkout.setHours(0, 0, 0, 0);
    
    // Ne peut pas modifier si le checkout est passé (réservation terminée)
    if (checkout < today) {
      Alert.alert('Impossible de modifier', 'Cette réservation est terminée et ne peut plus être modifiée.');
      return;
    }

    // Peut modifier si le checkout est aujourd'hui ou dans le futur
    // Cela inclut les réservations futures (check-in futur) et en cours (check-in passé mais checkout futur)
    
    // Vérifier s'il y a une demande en cours
    try {
      const pendingRequest = await getBookingPendingRequest(booking.id);
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
    
    setSelectedBookingForModification(booking);
    setModificationModalVisible(true);
  };

  const handleModificationRequested = () => {
    loadBookings();
    setModificationModalVisible(false);
    setSelectedBookingForModification(null);
  };

  const handleReviewSubmitted = () => {
    loadBookings(); // Recharger pour mettre à jour l'état
  };

  const handleVehicleModifyBooking = async (booking: VehicleBooking) => {
    try {
      const pendingRequest = await getVehicleBookingPendingRequest(booking.id);
      if (pendingRequest) {
        Alert.alert(
          'Demande en cours',
          'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse du propriétaire ou annuler la demande existante.'
        );
        return;
      }
    } catch (error) {
      console.error('Erreur vérification demande:', error);
    }
    
    setSelectedVehicleBookingForModification(booking);
    setVehicleModificationModalVisible(true);
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

  const isBookingInProgress = (booking: Booking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(booking.check_out_date);
    checkOut.setHours(0, 0, 0, 0);
    
    return booking.status === 'confirmed' && checkIn <= today && checkOut >= today;
  };

  const isVehicleBookingInProgress = (booking: VehicleBooking) => {
    const status = getVehicleBookingStatus(booking);
    return status === 'in_progress';
  };

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return isBookingInProgress(booking);
    return booking.status === selectedFilter;
  });

  const filteredVehicleBookings = vehicleBookings.filter(booking => {
    const status = getVehicleBookingStatus(booking);
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return status === 'in_progress';
    return status === selectedFilter;
  });

  // Obtenir les items à afficher selon l'onglet actif
  const getDisplayItems = () => {
    if (activeTab === 'properties') return filteredBookings;
    return filteredVehicleBookings;
  };

  const displayItems = getDisplayItems();
  const totalCount = bookings.length + vehicleBookings.length;

  const renderBookingItem = ({ item: booking }: { item: Booking }) => (
    <BookingCard
      booking={booking}
      onViewProperty={handleViewProperty}
      onCancelBooking={handleCancelBooking}
      onLeaveReview={handleLeaveReview}
      onModifyBooking={handleModifyBooking}
      canReview={canReviewMap[booking.id] || false}
    />
  );

  const renderVehicleBookingItem = ({ item: booking }: { item: VehicleBooking }) => {
    const vehicle = booking.vehicle;
    const vehicleImages = vehicle?.images || vehicle?.vehicle_photos?.map((p: any) => p.url) || [];
    const vehicleImage = vehicleImages[0];
    const status = getVehicleBookingStatus(booking);
    const statusLabel = status === 'pending' && (booking as any).payment_method === 'card'
      ? 'Paiement en attente'
      : getStatusText(status);
    const statusColor = status === 'pending' ? '#f59e0b' : status === 'confirmed' ? '#10b981' : status === 'in_progress' ? '#3b82f6' : status === 'completed' ? '#6366f1' : '#ef4444';
    
    const rentalDays = booking.rental_days || 0;
    const rentalHours = booking.rental_hours || 0;
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    const formatDateWithTime = (dateStr: string, datetimeStr?: string | null) => {
      if (datetimeStr) {
        const dt = new Date(datetimeStr);
        return `${formatDate(dateStr)} à ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
      }
      return formatDate(dateStr);
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
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amountXof);
    };

    const handleViewDetails = () => {
      (navigation as any).navigate('VehicleBookingDetails', { bookingId: booking.id });
    };

    return (
      <TouchableOpacity
        style={styles.vehicleBookingCard}
        onPress={handleViewDetails}
        activeOpacity={0.8}
      >
        <View style={styles.vehicleBookingHeader}>
          <View style={styles.vehicleInfo}>
            {vehicleImage ? (
              <Image source={{ uri: vehicleImage }} style={styles.vehicleImage} resizeMode="cover" />
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
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Afficher la demande de modification en cours */}
        {vehiclePendingRequests[booking.id] && (
          <View style={styles.modificationRequestBanner}>
            <Ionicons name="time-outline" size={18} color="#f39c12" />
            <View style={styles.modificationRequestContent}>
              <Text style={styles.modificationRequestTitle}>Demande de modification en cours</Text>
              <Text style={styles.modificationRequestDates}>
                En attente de réponse du propriétaire
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bookingDetails}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              {formatPrice(booking.total_price)}
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

          {status === 'completed' && canReviewVehicleMap[booking.id] && (
            <TouchableOpacity
              style={[styles.actionButton, styles.reviewButton]}
              onPress={() => {
                setSelectedVehicleBookingForReview(booking);
                setVehicleReviewModalVisible(true);
              }}
            >
              <Ionicons name="star-outline" size={16} color="#FFD700" />
              <Text style={[styles.actionButtonText, styles.reviewButtonText]}>
                Avis
              </Text>
            </TouchableOpacity>
          )}

          {canModifyVehicleBooking(booking) && !vehiclePendingRequests[booking.id] && (
            <>
              {handleVehicleModifyBooking && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.modifyButton]}
                  onPress={() => handleVehicleModifyBooking(booking)}
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
                    setSelectedVehicleBookingForCancellation(booking);
                    setVehicleCancellationModalVisible(true);
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

  const renderEmptyState = () => {
    const hasAnyBookings = totalCount > 0;
    const emptyMessage = activeTab === 'properties' 
      ? 'Aucune réservation de résidence meublée'
      : 'Aucune réservation de véhicule';
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptySubtitle}>
          {selectedFilter === 'all' 
            ? hasAnyBookings 
              ? `Aucune réservation ${activeTab === 'properties' ? 'de résidence' : 'de véhicule'} ${getStatusText(selectedFilter).toLowerCase()}`
              : 'Vous n\'avez pas encore de réservations'
            : `Aucune réservation ${getStatusText(selectedFilter).toLowerCase()}`
          }
        </Text>
        {!hasAnyBookings && (
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => {
              if (activeTab === 'vehicles') {
                (navigation as any).navigate('VehicleSpace', { screen: 'VehiclesTab' });
              } else {
                (navigation as any).navigate('Home', { screen: 'HomeTab' });
              }
            }}
          >
            <Text style={styles.exploreButtonText}>
              {activeTab === 'vehicles' ? 'Découvrir des véhicules' : 'Explorer les propriétés'}
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
            onPress={() => navigation.navigate('Auth')}
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
          style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
          onPress={() => setActiveTab('properties')}
        >
          <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>
            Résidences ({bookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicles' && styles.tabActive]}
          onPress={() => setActiveTab('vehicles')}
        >
          <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
            Véhicules ({vehicleBookings.length})
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
          renderItem={activeTab === 'vehicles' ? renderVehicleBookingItem : renderBookingItem}
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

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ReviewModal
        visible={reviewModalVisible}
        onClose={() => {
          setReviewModalVisible(false);
          setSelectedBookingForReview(null);
        }}
        propertyId={selectedBookingForReview?.property_id || ''}
        bookingId={selectedBookingForReview?.id || ''}
        onReviewSubmitted={handleReviewSubmitted}
      />

      {selectedBookingForCancellation && (
        <CancellationDialog
          visible={cancellationDialogVisible}
          onClose={() => {
            setCancellationDialogVisible(false);
            setSelectedBookingForCancellation(null);
          }}
          booking={{
            id: selectedBookingForCancellation.id,
            check_in_date: selectedBookingForCancellation.check_in_date,
            check_out_date: selectedBookingForCancellation.check_out_date,
            total_price: selectedBookingForCancellation.total_price,
            status: selectedBookingForCancellation.status,
            properties: {
              title: selectedBookingForCancellation.properties?.title || 'Propriété',
              price_per_night: selectedBookingForCancellation.properties?.price_per_night || 0,
              cancellation_policy: selectedBookingForCancellation.properties?.cancellation_policy || null,
            },
          }}
          onCancelled={() => {
            loadBookings();
            setCancellationDialogVisible(false);
            setSelectedBookingForCancellation(null);
          }}
        />
      )}

      {selectedBookingForModification && (
        <BookingModificationModal
          visible={modificationModalVisible}
          onClose={() => {
            setModificationModalVisible(false);
            setSelectedBookingForModification(null);
          }}
          booking={selectedBookingForModification}
          onModificationRequested={handleModificationRequested}
        />
      )}

      {/* Modals pour les véhicules */}
      {selectedVehicleBookingForCancellation && (
        <VehicleCancellationModal
          visible={vehicleCancellationModalVisible}
          onClose={() => {
            setVehicleCancellationModalVisible(false);
            setSelectedVehicleBookingForCancellation(null);
          }}
          booking={selectedVehicleBookingForCancellation}
          isOwner={false}
          onCancelled={() => {
            loadBookings();
            setVehicleCancellationModalVisible(false);
            setSelectedVehicleBookingForCancellation(null);
          }}
        />
      )}

      {selectedVehicleBookingForModification && (
        <VehicleModificationModal
          visible={vehicleModificationModalVisible}
          onClose={() => {
            setVehicleModificationModalVisible(false);
            setSelectedVehicleBookingForModification(null);
          }}
          booking={selectedVehicleBookingForModification}
          onModified={() => {
            loadBookings();
            setVehicleModificationModalVisible(false);
            setSelectedVehicleBookingForModification(null);
          }}
        />
      )}

      {selectedVehicleBookingForReview && selectedVehicleBookingForReview.vehicle && (
        <VehicleReviewModal
          visible={vehicleReviewModalVisible}
          onClose={() => {
            setVehicleReviewModalVisible(false);
            setSelectedVehicleBookingForReview(null);
          }}
          vehicleId={selectedVehicleBookingForReview.vehicle.id}
          bookingId={selectedVehicleBookingForReview.id}
          vehicleTitle={selectedVehicleBookingForReview.vehicle.title || `${selectedVehicleBookingForReview.vehicle.brand || ''} ${selectedVehicleBookingForReview.vehicle.model || ''}`.trim() || 'Véhicule'}
          onReviewSubmitted={() => {
            loadBookings();
            setVehicleReviewModalVisible(false);
            setSelectedVehicleBookingForReview(null);
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
  errorContainer: {
    backgroundColor: '#e74c3c',
    padding: 16,
    margin: 20,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
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
  vehicleBookingCard: {
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
  vehicleBookingHeader: {
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
});

export default MyBookingsScreen;