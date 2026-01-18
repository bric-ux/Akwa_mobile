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
import { useHostBookings, HostBooking } from '../hooks/useHostBookings';
import { useAuth } from '../services/AuthContext';
import { useMyProperties } from '../hooks/useMyProperties';
import { supabase } from '../services/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import CancellationDialog from '../components/CancellationDialog';
import HostCancellationDialog from '../components/HostCancellationDialog';
import BookingContactButton from '../components/BookingContactButton';
import GuestReviewModal from '../components/GuestReviewModal';
import GuestProfileModal from '../components/GuestProfileModal';
import HostBookingDetailsModal from '../components/HostBookingDetailsModal';
import { useGuestReviews } from '../hooks/useGuestReviews';

const HostBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getHostBookings, updateBookingStatus, loading, error } = useHostBookings();
  const { getMyProperties } = useMyProperties();
  const { canReviewGuest } = useGuestReviews();
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress'>('all');
  const [cancellationDialogVisible, setCancellationDialogVisible] = useState(false);
  const [selectedBookingForCancellation, setSelectedBookingForCancellation] = useState<HostBooking | null>(null);
  const [hostCancellationDialogVisible, setHostCancellationDialogVisible] = useState(false);
  const [selectedBookingForHostCancellation, setSelectedBookingForHostCancellation] = useState<HostBooking | null>(null);
  const [guestReviewModalVisible, setGuestReviewModalVisible] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<HostBooking | null>(null);
  const [canReview, setCanReview] = useState<Record<string, boolean>>({});
  const [guestProfileModalVisible, setGuestProfileModalVisible] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [bookingDetailsModalVisible, setBookingDetailsModalVisible] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<HostBooking | null>(null);

  const loadData = async () => {
    try {
      console.log('🔄 [HostBookingsScreen] Début du chargement des données...');
      
      // Charger toutes les propriétés de l'hôte
      const properties = await getMyProperties();
      console.log('🏠 [HostBookingsScreen] Propriétés chargées:', properties.length);
      setAllProperties(properties);

      // Charger les réservations
      const hostBookings = await getHostBookings();
      console.log('📦 [HostBookingsScreen] Réservations chargées:', hostBookings.length);
      setBookings(hostBookings);
      
      // Vérifier quelles réservations peuvent être évaluées
      const reviewChecks: Record<string, boolean> = {};
      for (const booking of hostBookings) {
        if (booking.status === 'completed' && booking.guest_id && booking.properties?.id) {
          const canReview = await canReviewGuest(booking.id);
          reviewChecks[booking.id] = canReview;
        }
      }
      setCanReview(reviewChecks);
      
      console.log('✅ [HostBookingsScreen] Chargement terminé avec succès');
    } catch (err: any) {
      console.error('❌ [HostBookingsScreen] Erreur lors du chargement:', err);
      console.error('❌ [HostBookingsScreen] Détails de l\'erreur:', {
        message: err?.message,
        stack: err?.stack,
        error: err
      });
    }
  };

  const loadBookings = async () => {
    await loadData();
  };

  // Charger les données quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadData();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const handleStatusUpdate = async (booking: HostBooking, status: 'confirmed' | 'cancelled') => {
    if (status === 'cancelled' && (booking.status === 'confirmed' || booking.status === 'in_progress')) {
      // Pour les réservations confirmées ou en cours, utiliser le dialogue d'annulation avec pénalité pour hôte
      setSelectedBookingForHostCancellation(booking);
      setHostCancellationDialogVisible(true);
      return;
    }
    
    // Pour les confirmations ou les refus de réservations pending, utiliser l'ancien système
    Alert.alert(
      status === 'confirmed' ? t('hostBookings.confirmBooking') : t('hostBookings.cancelBooking'),
      status === 'confirmed' ? t('hostBookings.confirmBookingConfirm') : t('hostBookings.cancelBookingConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: status === 'confirmed' ? t('hostBookings.confirm') : t('hostBookings.cancel'),
          style: status === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              console.log('🔄 [HostBookingsScreen] Mise à jour réservation:', booking.id, 'vers:', status);
              const result = await updateBookingStatus(booking.id, status);
              console.log('📊 [HostBookingsScreen] Résultat mise à jour:', result);
              
              if (result.success) {
                Alert.alert(
                  t('common.success'),
                  status === 'confirmed' ? t('hostBookings.bookingConfirmed') : t('hostBookings.bookingCancelled'),
                  [{ text: t('common.ok'), onPress: () => loadBookings() }]
                );
              } else {
                const errorMessage = result.error || t('hostBookings.updateError');
                console.error('❌ [HostBookingsScreen] Erreur mise à jour:', errorMessage);
                Alert.alert(t('common.error'), errorMessage);
              }
            } catch (error: any) {
              console.error('❌ [HostBookingsScreen] Erreur inattendue:', error);
              Alert.alert(t('common.error'), error?.message || t('common.errorOccurred'));
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
        return t('hostBookings.pending');
      case 'confirmed':
        return t('hostBookings.confirmed');
      case 'cancelled':
        return t('hostBookings.cancelled');
      case 'completed':
        return t('hostBookings.completed');
      case 'in_progress':
        return t('hostBookings.inProgress');
      default:
        return status;
    }
  };

  const isBookingInProgress = (booking: HostBooking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkIn = new Date(booking.check_in_date);
    checkIn.setHours(0, 0, 0, 0);
    const checkOut = new Date(booking.check_out_date);
    checkOut.setHours(0, 0, 0, 0);
    
    return booking.status === 'confirmed' && checkIn <= today && checkOut >= today;
  };


  // Fonction pour obtenir toutes les propriétés avec leurs réservations
  const getPropertiesWithBookings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Créer une map des réservations par propriété
    const bookingsByProperty = new Map<string, HostBooking[]>();
    bookings.forEach(booking => {
      if (!booking.properties || !booking.properties.id) return;
      const propertyId = booking.properties.id;
      if (!bookingsByProperty.has(propertyId)) {
        bookingsByProperty.set(propertyId, []);
      }
      bookingsByProperty.get(propertyId)!.push(booking);
    });

    // Filtrer les doublons de propriétés (au cas où)
    const uniqueProperties = Array.from(
      new Map(allProperties.map(prop => [prop.id, prop])).values()
    );

    // Créer la liste de toutes les propriétés avec leurs stats
    const propertiesWithStats = uniqueProperties.map(property => {
      const propertyBookings = bookingsByProperty.get(property.id) || [];
      
      const stats = {
        total: propertyBookings.length,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
        inProgress: 0,
      };

      let isCurrentlyOccupied = false;

      propertyBookings.forEach(booking => {
        stats.total++;
        if (booking.status === 'pending') stats.pending++;
        if (booking.status === 'confirmed') stats.confirmed++;
        if (booking.status === 'cancelled') stats.cancelled++;
        if (booking.status === 'completed') stats.completed++;
        
        // Vérifier si en cours
        try {
          const checkIn = new Date(booking.check_in_date);
          checkIn.setHours(0, 0, 0, 0);
          const checkOut = new Date(booking.check_out_date);
          checkOut.setHours(0, 0, 0, 0);
          
          if (booking.status === 'confirmed' && checkIn <= today && checkOut >= today) {
            stats.inProgress++;
            isCurrentlyOccupied = true;
          }
        } catch (dateError) {
          console.error('Erreur lors du traitement des dates:', dateError);
        }
      });

      return {
        property: {
          id: property.id,
          title: property.title,
          price_per_night: property.price_per_night,
          images: property.images || [],
          property_photos: property.property_photos || [],
          location: property.locations ? {
            id: property.locations.id,
            name: property.locations.name,
            type: property.locations.type,
            latitude: property.locations.latitude,
            longitude: property.locations.longitude,
            parent_id: property.locations.parent_id
          } : undefined,
          locations: property.locations
        },
        bookings: propertyBookings,
        stats,
        isCurrentlyOccupied,
        isAvailable: propertyBookings.length === 0,
      };
    });

    // Trier : d'abord les occupées, puis celles avec réservations, puis les disponibles
    const sorted = propertiesWithStats.sort((a, b) => {
      if (a.isCurrentlyOccupied && !b.isCurrentlyOccupied) return -1;
      if (!a.isCurrentlyOccupied && b.isCurrentlyOccupied) return 1;
      if (a.stats.total > 0 && b.stats.total === 0) return -1;
      if (a.stats.total === 0 && b.stats.total > 0) return 1;
      return b.stats.total - a.stats.total;
    });

    console.log('🏠 Propriétés chargées:', sorted.length);
    sorted.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.property?.title || 'Sans titre'} - ${p.stats.total} réservation(s) - ${p.isAvailable ? 'Disponible' : p.isCurrentlyOccupied ? 'Occupée' : 'Avec réservations'}`);
    });

    return sorted;
  };

  const propertiesWithBookings = getPropertiesWithBookings();
  
  // Obtenir les réservations de la propriété sélectionnée
  const getSelectedPropertyBookings = () => {
    if (!selectedPropertyId) return [];
    
    const propertyBookings = bookings.filter(b => b.properties?.id === selectedPropertyId);
    
    return propertyBookings.filter(booking => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'in_progress') return isBookingInProgress(booking);
      return booking.status === selectedFilter;
    });
  };

  const selectedPropertyBookings = getSelectedPropertyBookings();
  const selectedProperty = propertiesWithBookings.find(p => p.property?.id === selectedPropertyId);

  // Fonction pour obtenir l'URL de la photo principale d'une propriété
  const getPropertyMainImageUrl = (property: any): string => {
    if (!property) return 'https://via.placeholder.com/150';

    // Priorité 1: property_photos (photos catégorisées) triées par display_order
    if (property.property_photos && Array.isArray(property.property_photos) && property.property_photos.length > 0) {
      const sortedPhotos = [...property.property_photos].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
      return sortedPhotos[0].url;
    }

    // Priorité 2: images array
    if (property.images && Array.isArray(property.images) && property.images.length > 0) {
      return property.images[0];
    }

    // Fallback: placeholder
    return 'https://via.placeholder.com/150';
  };

  const renderBookingCard = ({ item }: { item: HostBooking }) => (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.propertyInfo}>
          <Image
            source={{ uri: getPropertyMainImageUrl(item.properties) }}
            style={styles.propertyImage}
            resizeMode="cover"
          />
          <View style={styles.propertyDetails}>
            <View style={styles.propertyTitleRow}>
              <Text style={styles.propertyTitle} numberOfLines={2}>
                {item.properties?.title || t('messages.property')}
              </Text>
            </View>
            <Text style={styles.propertyLocation}>
              {item.properties?.location?.name || item.properties?.locations?.name || t('hostBookings.unknownLocation')}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.guest_profile ? `${item.guest_profile.first_name} ${item.guest_profile.last_name}` : t('hostBookings.unknownGuest')}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>
            {formatDate(item.check_in_date)} - {formatDate(item.check_out_date)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="people" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.guests_count} {item.guests_count > 1 ? t('hostBookings.guests') : t('hostBookings.guest')}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.total_price.toLocaleString('fr-FR')} CFA
          </Text>
        </View>
      </View>

      {item.message_to_host && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>{t('hostBookings.guestMessage')}</Text>
          <Text style={styles.messageText}>{item.message_to_host}</Text>
        </View>
      )}

      {/* Boutons d'action */}
      <View style={styles.actionButtonsContainer}>
        {/* Bouton Détails */}
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => {
            setSelectedBookingForDetails(item);
            setBookingDetailsModalVisible(true);
          }}
        >
          <Ionicons name="document-text-outline" size={16} color="#e67e22" />
          <Text style={styles.detailsButtonText}>Détails</Text>
        </TouchableOpacity>

        {/* Bouton Contacter le voyageur - disponible pour toutes les réservations sauf annulées */}
        {item.status !== 'cancelled' && item.guest_id && item.properties?.id && (
          <>
            <BookingContactButton
              bookingId={item.id}
              propertyId={item.properties.id}
              otherParticipantId={item.guest_id}
              otherParticipantName={item.guest_profile ? `${item.guest_profile.first_name} ${item.guest_profile.last_name}` : undefined}
              isHost={false}
              variant="outline"
              size="small"
            />
            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() => {
                setSelectedGuestId(item.guest_id);
                setGuestProfileModalVisible(true);
              }}
            >
              <Ionicons name="person-outline" size={16} color="#2563eb" />
              <Text style={styles.viewProfileButtonText}>Voir profil</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {(() => {
        // Vérifier si le séjour a déjà commencé
        const checkInDate = new Date(item.check_in_date);
        checkInDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const hasAlreadyStarted = checkInDate <= today;

        const shouldShowButtons = item.status === 'pending';
        
        if (shouldShowButtons) {
          console.log('🔘 [HostBookingsScreen] Boutons d\'action pour réservation:', {
            bookingId: item.id,
            status: item.status,
            hasAlreadyStarted,
            checkInDate: item.check_in_date,
            today: today.toISOString()
          });
        }

        return shouldShowButtons && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => {
                console.log('✅ [HostBookingsScreen] Bouton Confirmer cliqué pour réservation:', item.id);
                handleStatusUpdate(item, 'confirmed');
              }}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>{t('hostBookings.confirm')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => {
                console.log('❌ [HostBookingsScreen] Bouton Refuser cliqué pour réservation:', item.id);
                handleStatusUpdate(item, 'cancelled');
              }}
            >
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>{t('hostBookings.reject')}</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Bouton Annuler pour les réservations confirmées ou en cours */}
      {(item.status === 'confirmed' || item.status === 'in_progress') && (
        <View style={styles.cancelButtonContainer}>
          <TouchableOpacity
            style={styles.cancelBookingButton}
            onPress={() => {
              setSelectedBookingForHostCancellation(item);
              setHostCancellationDialogVisible(true);
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#e74c3c" />
            <Text style={styles.cancelBookingButtonText}>Annuler la réservation</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bouton Évaluer l'invité (seulement pour les réservations terminées) */}
      {item.status === 'completed' && 
       item.guest_id && 
       item.properties?.id && 
       canReview[item.id] && (
        <View style={styles.reviewButtonContainer}>
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => {
              setSelectedBookingForReview(item);
              setGuestReviewModalVisible(true);
            }}
          >
            <Ionicons name="star" size={16} color="#FFA500" />
            <Text style={styles.reviewButtonText}>Évaluer l'invité</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );


  // Si l'utilisateur n'est pas connecté, afficher le bouton de connexion
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>{t('auth.loginRequired')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('hostBookings.loginRequiredDesc')}
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Auth' as never)}
          >
            <Text style={styles.exploreButtonText}>{t('auth.login')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>{t('hostBookings.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {!selectedPropertyId ? (
        // Vue liste des propriétés
        <>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e67e22" />
              <Text style={styles.loadingText}>{t('hostBookings.loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
              <Text style={styles.emptyTitle}>{t('hostBookings.loadingError')}</Text>
              <Text style={styles.emptySubtitle}>
                {error || t('hostBookings.loadingErrorDesc')}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRefresh}
              >
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : allProperties.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="home-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>{t('hostBookings.noProperties') || 'Aucune propriété'}</Text>
              <Text style={styles.emptySubtitle}>
                {t('hostBookings.noPropertiesDesc') || 'Vous n\'avez pas encore de propriété. Ajoutez-en une pour commencer à recevoir des réservations.'}
              </Text>
            </View>
          ) : propertiesWithBookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>{t('hostBookings.noBookings') || 'Aucune réservation'}</Text>
              <Text style={styles.emptySubtitle}>
                {t('hostBookings.noBookingsDesc') || 'Vous n\'avez pas encore de réservation pour vos propriétés.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={propertiesWithBookings}
              keyExtractor={(item, index) => item.property?.id ? `${item.property.id}-${index}` : `property-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.propertyCard,
                    item.isCurrentlyOccupied && styles.propertyCardOccupied
                  ]}
                  onPress={() => setSelectedPropertyId(item.property?.id || null)}
                >
                  <View style={styles.propertyCardImageContainer}>
                    <Image
                      source={{ uri: getPropertyMainImageUrl(item.property) }}
                      style={styles.propertyCardImage}
                      resizeMode="cover"
                      onError={(error) => {
                        console.error('Erreur chargement image propriété:', error.nativeEvent.error);
                      }}
                    />
                  </View>
                  <View style={styles.propertyCardContent}>
                    <View style={styles.propertyCardHeader}>
                      <Text style={styles.propertyCardTitle} numberOfLines={2}>
                        {item.property?.title || t('messages.property')}
                      </Text>
                      {item.isCurrentlyOccupied ? (
                        <View style={styles.occupiedBadgeSmall}>
                          <Ionicons name="time" size={12} color="#fff" />
                          <Text style={styles.occupiedBadgeSmallText}>{t('hostBookings.occupied')}</Text>
                        </View>
                      ) : item.isAvailable ? (
                        <View style={styles.availableBadgeSmall}>
                          <Ionicons name="checkmark-circle" size={12} color="#fff" />
                          <Text style={styles.availableBadgeSmallText}>{t('hostBookings.available')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.propertyCardLocation}>
                      {item.property?.location?.name || item.property?.locations?.name || t('hostBookings.unknownLocation')}
                    </Text>
                    
                    <View style={styles.statusInfo}>
                      {item.isAvailable ? (
                        <View style={styles.statusRow}>
                          <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                          <Text style={[styles.statusTextSimple, styles.statusTextAvailable]}>
                            {t('hostBookings.available')}
                          </Text>
                        </View>
                      ) : item.isCurrentlyOccupied ? (
                        <View style={styles.statusRow}>
                          <Ionicons name="time" size={18} color="#e67e22" />
                          <Text style={[styles.statusTextSimple, styles.statusTextOccupied]}>
                            {t('hostBookings.occupied')}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.statusRow}>
                          <Ionicons name="calendar-outline" size={18} color="#666" />
                          <Text style={styles.statusTextSimple}>
                            {item.stats.total} {item.stats.total > 1 ? t('hostBookings.reservations') : t('hostBookings.reservation')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.chevronIcon} />
                </TouchableOpacity>
              )}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={['#e67e22']}
                  tintColor="#e67e22"
                />
              }
              contentContainerStyle={styles.listContainer}
            />
          )}
        </>
      ) : (
        // Vue détaillée des réservations d'une propriété
        <>
          {/* En-tête avec bouton retour */}
          <View style={styles.propertyHeader}>
            <TouchableOpacity
              style={styles.backToPropertiesButton}
              onPress={() => {
                setSelectedPropertyId(null);
                setSelectedFilter('all');
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#e67e22" />
              <Text style={styles.backToPropertiesText}>Retour aux propriétés</Text>
            </TouchableOpacity>
          </View>

          {/* Informations de la propriété */}
          {selectedProperty && (
            <View style={styles.selectedPropertyInfo}>
              <View style={styles.selectedPropertyImageContainer}>
                <Image
                  source={{ uri: getPropertyMainImageUrl(selectedProperty.property) }}
                  style={styles.selectedPropertyImage}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('Erreur chargement image propriété sélectionnée:', error.nativeEvent.error);
                  }}
                />
              </View>
              <View style={styles.selectedPropertyDetails}>
                <Text style={styles.selectedPropertyTitle}>
                  {selectedProperty.property?.title || t('messages.property')}
                </Text>
                <Text style={styles.selectedPropertyLocation}>
                  {selectedProperty.property?.location?.name || selectedProperty.property?.locations?.name || t('hostBookings.unknownLocation')}
                </Text>
              </View>
            </View>
          )}

          {/* Filtres */}
          <View style={styles.filtersContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filtersScrollContent}
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
              <ActivityIndicator size="large" color="#e67e22" />
              <Text style={styles.loadingText}>{t('hostBookings.loading')}</Text>
            </View>
          ) : (
            <FlatList
              data={selectedPropertyBookings}
              renderItem={renderBookingCard}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={['#e67e22']}
                  tintColor="#e67e22"
                />
              }
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons 
                    name={selectedProperty?.isAvailable ? "calendar-outline" : "calendar-outline"} 
                    size={64} 
                    color="#ccc" 
                  />
                  <Text style={styles.emptyTitle}>
                    {selectedProperty?.isAvailable 
                      ? t('hostBookings.propertyAvailable') 
                      : t('hostBookings.noBookings')
                    }
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {selectedProperty?.isAvailable 
                      ? t('hostBookings.propertyAvailableDesc')
                      : selectedFilter === 'all' 
                        ? t('hostBookings.noBookingsForProperty')
                        : t('hostBookings.noBookingsForPropertyStatus', { status: getStatusText(selectedFilter).toLowerCase() })
                    }
                  </Text>
                </View>
              )}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </>
      )}

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
            total_price: selectedBookingForCancellation.total_price,
            status: selectedBookingForCancellation.status,
            property: {
              title: selectedBookingForCancellation.properties?.title || 'Propriété',
              price_per_night: selectedBookingForCancellation.properties?.price_per_night || 0,
            },
          }}
          onCancelled={() => {
            loadBookings();
            setCancellationDialogVisible(false);
            setSelectedBookingForCancellation(null);
          }}
        />
      )}

      {selectedBookingForReview && (
        <GuestReviewModal
          visible={guestReviewModalVisible}
          onClose={() => {
            setGuestReviewModalVisible(false);
            setSelectedBookingForReview(null);
          }}
          bookingId={selectedBookingForReview.id}
          guestId={selectedBookingForReview.guest_id}
          guestName={selectedBookingForReview.guest_profile 
            ? `${selectedBookingForReview.guest_profile.first_name} ${selectedBookingForReview.guest_profile.last_name}`.trim() 
            : 'Invité'}
          propertyId={selectedBookingForReview.properties?.id || ''}
          onReviewSubmitted={() => {
            loadBookings();
            setGuestReviewModalVisible(false);
            setSelectedBookingForReview(null);
          }}
        />
      )}

      <GuestProfileModal
        visible={guestProfileModalVisible}
        onClose={() => {
          setGuestProfileModalVisible(false);
          setSelectedGuestId(null);
        }}
        guestId={selectedGuestId || ''}
      />

      <HostBookingDetailsModal
        visible={bookingDetailsModalVisible}
        onClose={() => {
          setBookingDetailsModalVisible(false);
          setSelectedBookingForDetails(null);
        }}
        booking={selectedBookingForDetails}
      />

      <HostCancellationDialog
        visible={hostCancellationDialogVisible}
        onClose={() => {
          setHostCancellationDialogVisible(false);
          setSelectedBookingForHostCancellation(null);
        }}
        booking={selectedBookingForHostCancellation}
        onCancelled={() => {
          loadBookings();
          setHostCancellationDialogVisible(false);
          setSelectedBookingForHostCancellation(null);
        }}
      />
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
  filtersScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    minWidth: 80,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#e67e22',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  listContainer: {
    padding: 20,
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
  propertyInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  propertyImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  propertyImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  propertyDetails: {
    flex: 1,
  },
  propertyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 6,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  occupiedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  occupiedIndicatorText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  bookingDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  contactButtonContainer: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  viewProfileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    gap: 6,
  },
  viewProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
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
    lineHeight: 24,
  },
  exploreButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 28,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  propertyCardOccupied: {
    borderWidth: 2,
    borderColor: '#e67e22',
    backgroundColor: '#fff5e6',
  },
  propertyCardImageContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  propertyCardImage: {
    width: '100%',
    height: '100%',
  },
  propertyCardContent: {
    flex: 1,
    padding: 12,
  },
  propertyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  propertyCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  occupiedBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  occupiedBadgeSmallText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  availableBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  availableBadgeSmallText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  propertyCardLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusInfo: {
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTextSimple: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusTextAvailable: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusTextOccupied: {
    color: '#e67e22',
    fontWeight: '600',
  },
  chevronIcon: {
    marginRight: 12,
    alignSelf: 'center',
  },
  reviewButtonContainer: {
    marginTop: 12,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFA500',
    backgroundColor: '#fff',
    gap: 8,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA500',
  },
  cancelButtonContainer: {
    marginTop: 12,
  },
  cancelBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  cancelBookingButtonText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
  },
  propertyHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backToPropertiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToPropertiesText: {
    fontSize: 16,
    color: '#e67e22',
    fontWeight: '600',
  },
  selectedPropertyInfo: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    padding: 20,
    flexDirection: 'row',
    gap: 15,
  },
  selectedPropertyImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  selectedPropertyImage: {
    width: '100%',
    height: '100%',
  },
  selectedPropertyDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  selectedPropertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  selectedPropertyLocation: {
    fontSize: 14,
    color: '#666',
  },
  retryButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HostBookingsScreen;
