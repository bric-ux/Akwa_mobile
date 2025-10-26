import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useHostApplications, HostApplication } from '../hooks/useHostApplications';
import { getAmenityIcon } from '../utils/amenityIcons';
import { useAmenities } from '../hooks/useAmenities';

const ApplicationDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { applicationId } = (route.params as any) || {};
  const { getApplicationById, deleteApplication, loading } = useHostApplications();
  const { amenities } = useAmenities();
  
  const [application, setApplication] = useState<HostApplication | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  
  // Fonction pour obtenir le nom de l'équipement à partir de son ID
  const getAmenityName = (amenityId: string): string => {
    const amenity = amenities.find(a => a.id === amenityId);
    return amenity ? amenity.name : amenityId;
  };

  useEffect(() => {
    if (applicationId) {
      loadApplicationDetails();
    }
  }, [applicationId]);

  const loadApplicationDetails = async () => {
    try {
      setLoadingDetails(true);
      const data = await getApplicationById(applicationId);
      if (data) {
        setApplication(data);
      } else {
        Alert.alert('Erreur', 'Impossible de charger les détails de la candidature');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
      navigation.goBack();
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDelete = () => {
    if (!application) return;

    Alert.alert(
      'Supprimer la candidature',
      `Êtes-vous sûr de vouloir supprimer la candidature pour "${application.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteApplication(application.id);
              if (result.success) {
                Alert.alert('Succès', 'Candidature supprimée avec succès', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Erreur', result.error || 'Erreur lors de la suppression');
              }
            } catch (error) {
              Alert.alert('Erreur', 'Erreur lors de la suppression');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ffc107';
      case 'reviewing':
        return '#17a2b8';
      case 'approved':
        return '#28a745';
      case 'rejected':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'reviewing':
        return 'En révision';
      case 'approved':
        return 'Approuvée';
      case 'rejected':
        return 'Rejetée';
      default:
        return status;
    }
  };

  if (loadingDetails || !application) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Détails</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la candidature</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={24} color="#dc3545" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statut */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
            <Text style={styles.statusText}>{getStatusText(application.status)}</Text>
          </View>
          {application.status === 'reviewing' && (
            <View style={styles.reviewingIndicator}>
              <Ionicons name="refresh" size={16} color="#ffc107" />
              <Text style={styles.reviewingText}>Candidature en cours d'examen</Text>
            </View>
          )}
        </View>

        {/* Informations sur la propriété */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 Informations sur la propriété</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Titre:</Text>
            <Text style={styles.infoValue}>{application.title}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Description:</Text>
            <Text style={styles.infoValue}>{application.description}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type:</Text>
            <Text style={styles.infoValue}>{application.property_type}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Localisation:</Text>
            <Text style={styles.infoValue}>{application.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Capacité:</Text>
            <Text style={styles.infoValue}>{application.max_guests} voyageurs</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Chambres:</Text>
            <Text style={styles.infoValue}>{application.bedrooms}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Salles de bain:</Text>
            <Text style={styles.infoValue}>{application.bathrooms}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Prix par nuit:</Text>
            <Text style={styles.infoValue}>{formatPrice(application.price_per_night)} FCFA</Text>
          </View>

          {application.minimum_nights && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nuitées minimum:</Text>
              <Text style={styles.infoValue}>{application.minimum_nights}</Text>
            </View>
          )}

          {application.cleaning_fee !== undefined && application.cleaning_fee !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Frais de ménage:</Text>
              <Text style={styles.infoValue}>{formatPrice(application.cleaning_fee)} FCFA</Text>
            </View>
          )}

          {application.taxes !== undefined && application.taxes !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Taxes:</Text>
              <Text style={styles.infoValue}>{formatPrice(application.taxes)} FCFA</Text>
            </View>
          )}

          {application.amenities && application.amenities.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Équipements:</Text>
              <View style={styles.amenitiesContainer}>
                {application.amenities.map((amenityId, index) => {
                  const amenityName = getAmenityName(amenityId);
                  const amenityIcon = getAmenityIcon(amenityName);
                  return (
                    <View key={index} style={styles.amenityBadge}>
                      <Text style={styles.amenityIcon}>{amenityIcon}</Text>
                      <Text style={styles.amenityText}>{amenityName}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {application.auto_booking !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Réservation automatique:</Text>
              <Text style={styles.infoValue}>{application.auto_booking ? '✅ Oui' : '❌ Non'}</Text>
            </View>
          )}

          {application.cancellation_policy && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Politique d'annulation:</Text>
              <Text style={styles.infoValue}>{application.cancellation_policy}</Text>
            </View>
          )}
        </View>

        {/* Réductions */}
        {application.discount_enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Réductions</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Réductions activées:</Text>
              <Text style={styles.infoValue}>✅ Oui</Text>
            </View>

            {application.discount_min_nights && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nuitées minimum pour réduction:</Text>
                <Text style={styles.infoValue}>{application.discount_min_nights}</Text>
              </View>
            )}

            {application.discount_percentage && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pourcentage de réduction:</Text>
                <Text style={styles.infoValue}>{application.discount_percentage}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Guide de l'hôte */}
        {application.host_guide && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Guide de l'hôte</Text>
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>{application.host_guide}</Text>
            </View>
          </View>
        )}

        {/* Photos */}
        {application.categorized_photos && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {(() => {
                try {
                  const photos = typeof application.categorized_photos === 'string'
                    ? JSON.parse(application.categorized_photos)
                    : application.categorized_photos;
                  
                  return photos.map((photo: any, index: number) => (
                    <View key={index} style={styles.photoContainer}>
                      <Image
                        source={{ uri: photo.url || photo.uri }}
                        style={styles.photo}
                        resizeMode="cover"
                      />
                      <Text style={styles.photoCategory}>{photo.category || 'Autre'}</Text>
                    </View>
                  ));
                } catch (e) {
                  return null;
                }
              })()}
            </ScrollView>
          </View>
        )}

        {/* Informations personnelles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Informations personnelles</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nom complet:</Text>
            <Text style={styles.infoValue}>{application.full_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{application.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Téléphone:</Text>
            <Text style={styles.infoValue}>{application.phone}</Text>
          </View>

          {application.experience && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expérience:</Text>
              <Text style={styles.infoValue}>{application.experience}</Text>
            </View>
          )}
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Dates</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Soumis le:</Text>
            <Text style={styles.infoValue}>{formatDate(application.created_at)}</Text>
          </View>

          {application.reviewed_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Examiné le:</Text>
              <Text style={styles.infoValue}>{formatDate(application.reviewed_at)}</Text>
            </View>
          )}

          {application.updated_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mis à jour le:</Text>
              <Text style={styles.infoValue}>{formatDate(application.updated_at)}</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        {application.revision_message && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💬 Message de révision</Text>
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>{application.revision_message}</Text>
            </View>
          </View>
        )}

        {application.admin_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Notes de l'administrateur</Text>
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>{application.admin_notes}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {application.status === 'reviewing' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                navigation.navigate('BecomeHost' as never, { editApplicationId: application.id } as never);
              }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Modifier la candidature</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statusSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  reviewingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  reviewingText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#856404',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  amenityBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amenityIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  amenityText: {
    fontSize: 12,
    color: '#1976d2',
  },
  photosScroll: {
    marginTop: 12,
  },
  photoContainer: {
    marginRight: 12,
    width: 120,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  photoCategory: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  editButton: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ApplicationDetailsScreen;

