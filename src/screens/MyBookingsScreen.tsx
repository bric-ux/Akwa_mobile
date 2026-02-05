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

const MyBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
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

      // Charger les demandes de modification en attente pour les véhicules
      const vehicleRequestsMap: { [key: string]: any } = {};
      for (const booking of userVehicleBookings) {
        if (booking.id) {
          try {
            const request = await getVehicleBookingPendingRequest(booking.id);
            if (request) {
              vehicleRequestsMap[booking.id] = request;
            }
          } catch (err) {
            console.error('Erreur chargement demande modification véhicule:', err);
          }
        }
      }
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

    const formatPrice = (amount: number) => {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(amount);
    };

    return (
      <View style={styles.vehicleBookingCard}>
        <View style={styles.vehicleBookingHeader}>
          <View style={styles.vehicleBookingTitleRow}>
            {vehicleImage ? (
              <Image source={{ uri: vehicleImage }} style={styles.vehicleBookingImage} resizeMode="cover" />
            ) : (
              <View style={[styles.vehicleBookingImage, styles.vehicleBookingImagePlaceholder]}>
                <Ionicons name="car-outline" size={32} color="#ccc" />
              </View>
            )}
            <View style={styles.vehicleBookingInfo}>
              <Text style={styles.vehicleBookingTitle}>
                {vehicle?.title || `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Véhicule'}
              </Text>
              <Text style={styles.vehicleBookingLocation}>
                📍 {vehicle?.location?.name || 'Localisation inconnue'}
              </Text>
              <View style={styles.vehicleBookingDateRow}>
                <Ionicons name="calendar-outline" size={14} color="#666" />
                <Text style={styles.vehicleBookingDateText}>
                  {formatDateWithTime(booking.start_date, booking.start_datetime)} - {formatDateWithTime(booking.end_date, booking.end_datetime)}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.vehicleBookingStatusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.vehicleBookingStatusText}>{getStatusText(status)}</Text>
          </View>
        </View>
        <View style={styles.vehicleBookingDetails}>
          <View style={styles.vehicleBookingPriceRow}>
            <Text style={styles.vehicleBookingPriceLabel}>Total</Text>
            <Text style={styles.vehicleBookingPriceValue}>{formatPrice(booking.total_price)}</Text>
          </View>
        </View>
        {/* Afficher la demande de modification en cours */}
        {vehiclePendingRequests[booking.id] && (
          <View style={styles.vehicleModificationRequestBanner}>
            <Ionicons name="time-outline" size={18} color="#f39c12" />
            <View style={styles.vehicleModificationRequestContent}>
              <Text style={styles.vehicleModificationRequestTitle}>Demande de modification en cours</Text>
              <Text style={styles.vehicleModificationRequestText}>
                En attente de réponse du propriétaire
              </Text>
            </View>
          </View>
        )}

        <View style={styles.vehicleBookingActions}>
          <TouchableOpacity
            style={styles.vehicleBookingActionButton}
            onPress={() => {
              if (vehicle?.id) {
                navigation.navigate('VehicleDetails' as never, { vehicleId: vehicle.id } as never);
              }
            }}
          >
            <Ionicons name="eye-outline" size={18} color="#2E7D32" />
            <Text style={styles.vehicleBookingActionText}>Voir véhicule</Text>
          </TouchableOpacity>
          {canModifyVehicleBooking(booking) && !vehiclePendingRequests[booking.id] && (
            <TouchableOpacity
              style={styles.vehicleBookingModifyButton}
              onPress={() => handleVehicleModifyBooking(booking)}
            >
              <Ionicons name="create-outline" size={18} color="#2563eb" />
              <Text style={styles.vehicleBookingModifyText}>Modifier</Text>
            </TouchableOpacity>
          )}
          {(status === 'pending' || status === 'confirmed' || status === 'in_progress') && (
            <TouchableOpacity
              style={styles.vehicleBookingCancelButton}
              onPress={() => {
                setSelectedVehicleBookingForCancellation(booking);
                setVehicleCancellationModalVisible(true);
              }}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
              <Text style={styles.vehicleBookingCancelText}>Annuler</Text>
            </TouchableOpacity>
          )}
          {status === 'completed' && canReviewVehicleMap[booking.id] && (
            <TouchableOpacity
              style={styles.vehicleBookingReviewButton}
              onPress={() => {
                setSelectedVehicleBookingForReview(booking);
                setVehicleReviewModalVisible(true);
              }}
            >
              <Ionicons name="star-outline" size={18} color="#fbbf24" />
              <Text style={styles.vehicleBookingReviewText}>Évaluer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleBookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vehicleBookingTitleRow: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  vehicleBookingImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  vehicleBookingImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleBookingInfo: {
    flex: 1,
  },
  vehicleBookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vehicleBookingLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  vehicleBookingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleBookingDateText: {
    fontSize: 12,
    color: '#666',
  },
  vehicleBookingStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  vehicleBookingStatusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  vehicleBookingDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  vehicleBookingPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleBookingPriceLabel: {
    fontSize: 14,
    color: '#666',
  },
  vehicleBookingPriceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  vehicleBookingActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 8,
  },
  vehicleBookingActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  vehicleBookingActionText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 6,
  },
  vehicleBookingCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  vehicleBookingCancelText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 6,
  },
  vehicleBookingReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  vehicleBookingReviewText: {
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '600',
    marginLeft: 6,
  },
  vehicleBookingModifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  vehicleBookingModifyText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginLeft: 6,
  },
  vehicleModificationRequestBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
    gap: 10,
  },
  vehicleModificationRequestContent: {
    flex: 1,
  },
  vehicleModificationRequestTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  vehicleModificationRequestText: {
    fontSize: 12,
    color: '#78350f',
  },
});

export default MyBookingsScreen;