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
import { useAuth } from '../services/AuthContext';
import { useReviews } from '../hooks/useReviews';
import BookingCard from '../components/BookingCard';
import ReviewModal from '../components/ReviewModal';
import CancellationDialog from '../components/CancellationDialog';
import BookingModificationModal from '../components/BookingModificationModal';
import { useBookingModifications } from '../hooks/useBookingModifications';

const MyBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getUserBookings, cancelBooking, loading, error } = useBookings();
  const { canUserReviewProperty } = useReviews();
  const { getBookingPendingRequest } = useBookingModifications();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress'>('all');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);
  const [canReviewMap, setCanReviewMap] = useState<Record<string, boolean>>({});
  const [cancellationDialogVisible, setCancellationDialogVisible] = useState(false);
  const [selectedBookingForCancellation, setSelectedBookingForCancellation] = useState<Booking | null>(null);
  const [modificationModalVisible, setModificationModalVisible] = useState(false);
  const [selectedBookingForModification, setSelectedBookingForModification] = useState<Booking | null>(null);

  const isStayCompleted = (checkOutDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkout = new Date(checkOutDate);
    checkout.setHours(0, 0, 0, 0);
    return checkout < today;
  };

  const loadBookings = async () => {
    try {
      const userBookings = await getUserBookings();
      setBookings(userBookings);
      
      // Vérifier quelles réservations peuvent être notées
      // Seulement les réservations confirmées ou terminées dont le séjour est terminé
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

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return isBookingInProgress(booking);
    return booking.status === selectedFilter;
  });

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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune réservation</Text>
      <Text style={styles.emptySubtitle}>
        {selectedFilter === 'all' 
          ? 'Vous n\'avez pas encore de réservations'
          : `Aucune réservation ${getStatusText(selectedFilter).toLowerCase()}`
        }
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => {
          // Naviguer vers l'onglet Home
          (navigation as any).navigate('Home', { screen: 'HomeTab' });
        }}
      >
        <Text style={styles.exploreButtonText}>Explorer les propriétés</Text>
      </TouchableOpacity>
    </View>
  );

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes réservations</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Lien vers les réservations de véhicules */}
      <TouchableOpacity
        style={styles.vehicleBookingsLink}
        onPress={() => navigation.navigate('MyVehicleBookings' as never)}
      >
        <Ionicons name="car-outline" size={20} color="#2E7D32" />
        <Text style={styles.vehicleBookingsLinkText}>Voir mes réservations de véhicules</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

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
          data={filteredBookings}
          renderItem={renderBookingItem}
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
  vehicleBookingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 8,
  },
  vehicleBookingsLinkText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

export default MyBookingsScreen;