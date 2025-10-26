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
  TextInput,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { HostApplication } from '../hooks/useHostApplications';
import { supabase } from '../services/supabase';
import { getAmenityIcon } from '../utils/amenityIcons';
import { useAmenities } from '../hooks/useAmenities';

const AdminApplicationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getAllHostApplications, updateApplicationStatus, loading } = useAdmin();
  const { amenities } = useAmenities();
  
  // Fonction pour obtenir le nom de l'équipement à partir de son ID
  const getAmenityName = (amenityId: string): string => {
    const amenity = amenities.find(a => a.id === amenityId);
    return amenity ? amenity.name : amenityId;
  };
  
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<HostApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [revisionMessage, setRevisionMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reviewing' | 'approved' | 'rejected'>('all');
  const [identityDoc, setIdentityDoc] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [photoCategories, setPhotoCategories] = useState<{[key: number]: string}>({});

  const loadApplications = async () => {
    try {
      const allApplications = await getAllHostApplications();
      setApplications(allApplications);
    } catch (error) {
      console.error('Erreur lors du chargement des candidatures:', error);
    }
  };

  const loadIdentityDocument = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('identity_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erreur chargement document identité:', error);
        setIdentityDoc(null);
        return;
      }

      // Prendre le premier document (le plus récent) s'il y en a plusieurs
      setIdentityDoc(data && data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('Erreur:', error);
      setIdentityDoc(null);
    }
  };

  // Charger les candidatures quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadApplications();
      }
    }, [user, profile])
  );

  useEffect(() => {
    if (selectedApp?.user_id) {
      loadIdentityDocument(selectedApp.user_id);
    }
  }, [selectedApp]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  };

  const handleStatusUpdate = async (applicationId: string, status: 'pending' | 'reviewing' | 'approved' | 'rejected') => {
    const application = applications.find(app => app.id === applicationId);
    if (!application) return;

    const actionText = {
      pending: 'mettre en attente',
      reviewing: 'mettre en révision',
      approved: 'approuver',
      rejected: 'refuser'
    }[status];

    Alert.alert(
      `Confirmer l'action`,
      `Êtes-vous sûr de vouloir ${actionText} cette candidature ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          onPress: async () => {
            try {
              // Pour la révision, utiliser le message de révision spécifique
              const messageToSend = status === 'reviewing' ? revisionMessage : adminNotes;
              // Pour l'approbation, inclure les catégories de photos
              const photoCategoriesToSend = status === 'approved' ? photoCategories : undefined;
              const result = await updateApplicationStatus(applicationId, status, messageToSend || undefined, photoCategoriesToSend);
              if (result.success) {
                Alert.alert('Succès', `Candidature ${actionText}ée avec succès`);
                setAdminNotes('');
                setRevisionMessage('');
                setPhotoCategories({});
                setSelectedApp(null);
                setShowDetails(false);
                loadApplications(); // Recharger la liste
              } else {
                Alert.alert('Erreur', 'Impossible de mettre à jour la candidature');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: '#f39c12', text: 'En attente', icon: 'time-outline' },
      reviewing: { color: '#3498db', text: 'En révision', icon: 'eye-outline' },
      approved: { color: '#2E7D32', text: 'Approuvée', icon: 'checkmark-circle-outline' },
      rejected: { color: '#e74c3c', text: 'Refusée', icon: 'close-circle-outline' },
    };
    
    return statusConfig[status as keyof typeof statusConfig] || { color: '#95a5a6', text: 'Inconnu', icon: 'help-outline' };
  };

  const filteredApplications = applications.filter(app => {
    if (filterStatus === 'all') return true;
    return app.status === filterStatus;
  });

  const renderApplicationItem = ({ item: application }: { item: HostApplication }) => {
    const statusInfo = getStatusBadge(application.status);
    
    return (
      <TouchableOpacity
        style={[
          styles.applicationCard,
          application.status === 'reviewing' && styles.reviewingCard
        ]}
        onPress={() => {
          setSelectedApp(application);
          setShowDetails(true);
          setAdminNotes(application.admin_notes || '');
          setRevisionMessage(application.revision_message || '');
        }}
      >
        <View style={styles.applicationHeader}>
          <View style={styles.applicationInfo}>
            <Text style={styles.applicationTitle} numberOfLines={1}>
              {application.title}
            </Text>
            <Text style={styles.applicationLocation} numberOfLines={1}>
              📍 {application.location}
            </Text>
            <Text style={styles.applicationHost} numberOfLines={1}>
              👤 {application.full_name}
            </Text>
            <Text style={styles.applicationEmail} numberOfLines={1}>
              📧 {application.email}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={12} color="#fff" />
            <Text style={styles.statusText}>{statusInfo.text}</Text>
          </View>
        </View>

        <View style={styles.applicationDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>{application.property_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Capacité:</Text>
            <Text style={styles.detailValue}>{application.max_guests} voyageurs</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Prix:</Text>
            <Text style={styles.detailValue}>{formatPrice(application.price_per_night)}/nuit</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{formatDate(application.created_at)}</Text>
          </View>
        </View>

        {application.admin_notes && (
          <View style={styles.adminNotesContainer}>
            <Text style={styles.adminNotesLabel}>Notes admin:</Text>
            <Text style={styles.adminNotesText}>{application.admin_notes}</Text>
          </View>
        )}

        {application.status === 'reviewing' && application.revision_message && (
          <View style={styles.revisionContainer}>
            <View style={styles.revisionHeader}>
              <Ionicons name="alert-circle" size={16} color="#856404" />
              <Text style={styles.revisionLabel}>Message de révision envoyé</Text>
            </View>
            <Text style={styles.revisionText}>{application.revision_message}</Text>
          </View>
        )}

        <View style={styles.applicationActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectedApp(application);
              setShowDetails(true);
            }}
          >
            <Ionicons name="eye-outline" size={16} color="#3498db" />
            <Text style={styles.actionButtonText}>Voir détails</Text>
          </TouchableOpacity>
          
          {(() => {
            let photoCount = 0;
            if (application.images && application.images.length > 0) {
              photoCount = application.images.length;
            } else if (application.categorized_photos) {
              try {
                const photos = typeof application.categorized_photos === 'string' 
                  ? JSON.parse(application.categorized_photos) 
                  : application.categorized_photos;
                photoCount = Array.isArray(photos) ? photos.length : 0;
              } catch (e) {
                photoCount = 0;
              }
            }
            return photoCount > 0 ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedApp(application);
                  setShowPhotos(true);
                  setSelectedPhotoIndex(0);
                }}
              >
                <Ionicons name="images-outline" size={16} color="#e67e22" />
                <Text style={styles.actionButtonText}>Photos ({photoCount})</Text>
              </TouchableOpacity>
            ) : null;
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  const renderApplicationDetails = () => {
    if (!selectedApp || !showDetails) return null;

    const statusInfo = getStatusBadge(selectedApp.status);

    return (
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowDetails(false);
          setSelectedApp(null);
          setAdminNotes('');
          setRevisionMessage('');
          setPhotoCategories({});
        }}
      >
        <SafeAreaView style={styles.detailsModal} edges={['top', 'left', 'right']}>
          <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>Détails de la candidature</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setShowDetails(false);
              setSelectedApp(null);
              setAdminNotes('');
              setRevisionMessage('');
              setPhotoCategories({});
            }}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.detailsContent} showsVerticalScrollIndicator={false}>
          {/* Informations sur la propriété */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>🏠 Informations sur la propriété</Text>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Titre:</Text>
              <Text style={styles.detailsValue}>{selectedApp.title}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Description:</Text>
              <Text style={styles.detailsValue}>{selectedApp.description}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Type:</Text>
              <Text style={styles.detailsValue}>{selectedApp.property_type}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Localisation:</Text>
              <Text style={styles.detailsValue}>{selectedApp.location}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Capacité:</Text>
              <Text style={styles.detailsValue}>{selectedApp.max_guests} voyageurs</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Chambres:</Text>
              <Text style={styles.detailsValue}>{selectedApp.bedrooms}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Salles de bain:</Text>
              <Text style={styles.detailsValue}>{selectedApp.bathrooms}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Prix par nuit:</Text>
              <Text style={styles.detailsValue}>{formatPrice(selectedApp.price_per_night)}</Text>
            </View>
            
            {selectedApp.minimum_nights && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Nuitées minimum:</Text>
                <Text style={styles.detailsValue}>{selectedApp.minimum_nights}</Text>
              </View>
            )}
            
            {selectedApp.cleaning_fee !== undefined && selectedApp.cleaning_fee !== null && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Frais de ménage:</Text>
                <Text style={styles.detailsValue}>{formatPrice(selectedApp.cleaning_fee)}</Text>
              </View>
            )}
            
            {selectedApp.taxes !== undefined && selectedApp.taxes !== null && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Taxes:</Text>
                <Text style={styles.detailsValue}>{formatPrice(selectedApp.taxes)}</Text>
              </View>
            )}
            
            {selectedApp.amenities && selectedApp.amenities.length > 0 && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Équipements:</Text>
                <View style={styles.amenitiesList}>
                  {selectedApp.amenities.map((amenityId, index) => {
                    const amenityName = getAmenityName(amenityId);
                    const amenityIcon = getAmenityIcon(amenityName);
                    return (
                      <View key={index} style={styles.amenityBadge}>
                        <Text style={styles.amenityIconText}>{amenityIcon}</Text>
                        <Text style={styles.amenityItem}>{amenityName}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            
            {selectedApp.auto_booking !== undefined && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Réservation automatique:</Text>
                <Text style={styles.detailsValue}>{selectedApp.auto_booking ? 'Oui' : 'Non'}</Text>
              </View>
            )}
            
            {selectedApp.cancellation_policy && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Politique d'annulation:</Text>
                <Text style={styles.detailsValue}>{selectedApp.cancellation_policy}</Text>
              </View>
            )}
            
            {selectedApp.host_guide && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Guide de l'hôte:</Text>
                <Text style={styles.detailsValue}>{selectedApp.host_guide}</Text>
              </View>
            )}
          </View>

          {/* Réductions */}
          {selectedApp.discount_enabled && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsSectionTitle}>💰 Réductions</Text>
              
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Réductions activées:</Text>
                <Text style={styles.detailsValue}>Oui</Text>
              </View>
              
              {selectedApp.discount_min_nights && (
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Nuitées minimum pour réduction:</Text>
                  <Text style={styles.detailsValue}>{selectedApp.discount_min_nights}</Text>
                </View>
              )}
              
              {selectedApp.discount_percentage && (
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Pourcentage de réduction:</Text>
                  <Text style={styles.detailsValue}>{selectedApp.discount_percentage}%</Text>
                </View>
              )}
            </View>
          )}

          {/* Informations personnelles */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>👤 Informations personnelles</Text>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Nom complet:</Text>
              <Text style={styles.detailsValue}>{selectedApp.full_name}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Email:</Text>
              <Text style={styles.detailsValue}>{selectedApp.email}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Téléphone:</Text>
              <Text style={styles.detailsValue}>{selectedApp.phone}</Text>
            </View>
            
            {selectedApp.experience && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Expérience:</Text>
                <Text style={styles.detailsValue}>{selectedApp.experience}</Text>
              </View>
            )}
          </View>

          {/* Document d'identité */}
          {identityDoc && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsSectionTitle}>🆔 Document d'identité</Text>
              
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Type:</Text>
                <Text style={styles.detailsValue}>{identityDoc.document_type}</Text>
              </View>
              
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Numéro:</Text>
                <Text style={styles.detailsValue}>{identityDoc.document_number}</Text>
              </View>
              
              {identityDoc.front_image_url && (
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Image recto:</Text>
                  <Image 
                    source={{ uri: identityDoc.front_image_url }} 
                    style={styles.documentImage}
                    resizeMode="cover"
                  />
                </View>
              )}
              
              {identityDoc.back_image_url && (
                <View style={styles.detailsItem}>
                  <Text style={styles.detailsLabel}>Image verso:</Text>
                  <Image 
                    source={{ uri: identityDoc.back_image_url }} 
                    style={styles.documentImage}
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>
          )}

          {/* Statut et historique */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>📊 Statut et historique</Text>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Statut actuel:</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                <Ionicons name={statusInfo.icon as any} size={12} color="#fff" />
                <Text style={styles.statusText}>{statusInfo.text}</Text>
              </View>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Date de candidature:</Text>
              <Text style={styles.detailsValue}>{formatDate(selectedApp.created_at)}</Text>
            </View>
            
            {selectedApp.reviewed_at && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Date de révision:</Text>
                <Text style={styles.detailsValue}>{formatDate(selectedApp.reviewed_at)}</Text>
              </View>
            )}

            {selectedApp.status === 'reviewing' && selectedApp.revision_message && (
              <View style={styles.detailsItem}>
                <Text style={styles.detailsLabel}>Message envoyé:</Text>
                <Text style={styles.detailsValue}>{selectedApp.revision_message}</Text>
              </View>
            )}
          </View>

          {/* Message de révision */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>📝 Message de révision</Text>
            
            <TextInput
              style={styles.notesInput}
              value={revisionMessage}
              onChangeText={setRevisionMessage}
              placeholder="Message à envoyer à l'hôte pour la révision..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Notes administratives */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>📋 Notes administratives</Text>
            
            <TextInput
              style={styles.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Notes internes pour cette candidature..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Actions */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>⚡ Actions</Text>
            
            <View style={styles.actionButtons}>
              {selectedApp.status !== 'reviewing' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.reviewButton]}
                  onPress={() => {
                    if (!revisionMessage.trim()) {
                      Alert.alert(
                        'Message requis',
                        'Veuillez entrer un message de révision avant de mettre en révision.',
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    handleStatusUpdate(selectedApp.id, 'reviewing');
                  }}
                  disabled={loading}
                >
                  <Ionicons name="eye-outline" size={16} color="#3498db" />
                  <Text style={styles.actionButtonText}>Mettre en révision</Text>
                </TouchableOpacity>
              )}

              {selectedApp.status === 'reviewing' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.reviewButton]}
                  onPress={() => {
                    if (!revisionMessage.trim()) {
                      Alert.alert(
                        'Message requis',
                        'Veuillez entrer un nouveau message de révision.',
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    handleStatusUpdate(selectedApp.id, 'reviewing');
                  }}
                  disabled={loading}
                >
                  <Ionicons name="refresh-outline" size={16} color="#3498db" />
                  <Text style={styles.actionButtonText}>Remettre en révision</Text>
                </TouchableOpacity>
              )}
              
              {selectedApp.status !== 'approved' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleStatusUpdate(selectedApp.id, 'approved')}
                  disabled={loading}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#2E7D32" />
                  <Text style={styles.actionButtonText}>Approuver</Text>
                </TouchableOpacity>
              )}
              
              {selectedApp.status !== 'rejected' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleStatusUpdate(selectedApp.id, 'rejected')}
                  disabled={loading}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#e74c3c" />
                  <Text style={styles.actionButtonText}>Refuser</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      </Modal>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour accéder à l'administration.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderPhotoViewer = () => {
    if (!selectedApp || !showPhotos) return null;

    // Parser les photos catégorisées si disponibles
    let categorizedPhotos: Array<{url: string, category: string, displayOrder: number}> = [];
    let images: string[] = [];
    
    if (selectedApp.categorized_photos) {
      try {
        if (typeof selectedApp.categorized_photos === 'string') {
          categorizedPhotos = JSON.parse(selectedApp.categorized_photos);
        } else if (Array.isArray(selectedApp.categorized_photos)) {
          categorizedPhotos = selectedApp.categorized_photos;
        }
        images = categorizedPhotos.map(p => p.url || p.uri).filter(Boolean);
      } catch (e) {
        console.error('Error parsing categorized_photos:', e);
      }
    }
    
    // Fallback sur images simple si pas de photos catégorisées
    if (images.length === 0 && selectedApp.images) {
      images = selectedApp.images;
    }
    
    if (images.length === 0) return null;

    const currentPhoto = images[selectedPhotoIndex];
    const currentPhotoData = categorizedPhotos[selectedPhotoIndex];

    const CATEGORY_LABELS: Record<string, string> = {
      chambre: '🛏️ Chambre',
      salle_de_bain: '🚿 Salle de bain',
      cuisine: '🍳 Cuisine',
      jardin: '🌳 Jardin',
      salon: '🛋️ Salon',
      exterieur: '🏡 Extérieur',
      terrasse: '☀️ Terrasse',
      balcon: '🪴 Balcon',
      autre: '📷 Autre'
    };

    return (
      <Modal
        visible={showPhotos}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowPhotos(false);
          setSelectedApp(null);
          setSelectedPhotoIndex(0);
        }}
      >
        <SafeAreaView style={styles.photoModal} edges={['top', 'left', 'right']}>
          <View style={styles.photoHeader}>
            <View style={styles.photoHeaderLeft}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowPhotos(false);
                  setSelectedApp(null);
                  setSelectedPhotoIndex(0);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.photoTitle}>Photos de la propriété</Text>
            </View>
          </View>

          <ScrollView style={styles.photoContent} showsVerticalScrollIndicator={false}>
            {/* Image principale */}
            <View style={styles.photoMainContainer}>
              <Image source={{ uri: currentPhoto }} style={styles.photoImage} resizeMode="contain" />
              
              {/* Catégorie de la photo */}
              {currentPhotoData?.category && (
                <View style={styles.photoCategoryBadge}>
                  <Text style={styles.photoCategoryText}>
                    {CATEGORY_LABELS[currentPhotoData.category] || currentPhotoData.category}
                  </Text>
                </View>
              )}
            </View>

            {/* Navigation entre photos */}
            {images.length > 1 && (
              <View style={styles.photoNavigation}>
                <TouchableOpacity
                  style={[styles.navButton, selectedPhotoIndex === 0 && styles.navButtonDisabled]}
                  onPress={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                  disabled={selectedPhotoIndex === 0}
                >
                  <Ionicons name="chevron-back" size={28} color={selectedPhotoIndex === 0 ? "#ccc" : "#333"} />
                </TouchableOpacity>
                
                <Text style={styles.photoCounter}>
                  {selectedPhotoIndex + 1} / {images.length}
                </Text>
                
                <TouchableOpacity
                  style={[styles.navButton, selectedPhotoIndex === images.length - 1 && styles.navButtonDisabled]}
                  onPress={() => setSelectedPhotoIndex(Math.min(images.length - 1, selectedPhotoIndex + 1))}
                  disabled={selectedPhotoIndex === images.length - 1}
                >
                  <Ionicons name="chevron-forward" size={28} color={selectedPhotoIndex === images.length - 1 ? "#ccc" : "#333"} />
                </TouchableOpacity>
              </View>
            )}

            {/* Classification pour l'affichage */}
            <View style={styles.classificationSection}>
              <Text style={styles.sectionTitle}>Classification</Text>
              <View style={styles.categoryGrid}>
                {[
                  { value: 'top_choice', label: '⭐ Top Choice', color: '#e74c3c' },
                  { value: 'premium', label: '💎 Premium', color: '#f39c12' },
                  { value: 'standard', label: '🏠 Standard', color: '#3498db' },
                  { value: 'economique', label: '💰 Économique', color: '#2E7D32' }
                ].map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.classificationButton,
                      photoCategories[selectedPhotoIndex] === category.value && styles.classificationButtonSelected
                    ]}
                    onPress={() => setPhotoCategories(prev => ({
                      ...prev,
                      [selectedPhotoIndex]: category.value
                    }))}
                  >
                    <Text style={[
                      styles.classificationButtonText,
                      photoCategories[selectedPhotoIndex] === category.value && styles.classificationButtonTextSelected
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Note admin */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Note admin (1-5)</Text>
              <View style={styles.ratingButtons}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <TouchableOpacity
                    key={rating}
                    style={[
                      styles.ratingButton,
                      photoCategories[`rating_${selectedPhotoIndex}`] === rating.toString() && styles.ratingButtonSelected
                    ]}
                    onPress={() => setPhotoCategories(prev => ({
                      ...prev,
                      [`rating_${selectedPhotoIndex}`]: rating.toString()
                    }))}
                  >
                    <Text style={[
                      styles.ratingButtonText,
                      photoCategories[`rating_${selectedPhotoIndex}`] === rating.toString() && styles.ratingButtonTextSelected
                    ]}>
                      {rating}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Mise en avant */}
            <View style={styles.featuredSection}>
              <TouchableOpacity
                style={[
                  styles.featuredButton,
                  photoCategories[`featured_${selectedPhotoIndex}`] === 'true' && styles.featuredButtonSelected
                ]}
                onPress={() => setPhotoCategories(prev => ({
                  ...prev,
                  [`featured_${selectedPhotoIndex}`]: prev[`featured_${selectedPhotoIndex}`] === 'true' ? 'false' : 'true'
                }))}
              >
                <Ionicons 
                  name={photoCategories[`featured_${selectedPhotoIndex}`] === 'true' ? 'star' : 'star-outline'} 
                  size={24} 
                  color={photoCategories[`featured_${selectedPhotoIndex}`] === 'true' ? '#fff' : '#f39c12'} 
                />
                <Text style={[
                  styles.featuredButtonText,
                  photoCategories[`featured_${selectedPhotoIndex}`] === 'true' && styles.featuredButtonTextSelected
                ]}>
                  Mettre en avant cette photo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Miniatures */}
            {images.length > 1 && (
              <View style={styles.thumbnailsSection}>
                <Text style={styles.sectionTitle}>Toutes les photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsContainer}>
                  {images.map((photo, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.thumbnail,
                        index === selectedPhotoIndex && styles.selectedThumbnail
                      ]}
                      onPress={() => setSelectedPhotoIndex(index)}
                    >
                      <Image source={{ uri: photo }} style={styles.thumbnailImage} resizeMode="cover" />
                      {index === selectedPhotoIndex && (
                        <View style={styles.selectedThumbnailOverlay}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // Vérifier que l'utilisateur est admin
  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#e74c3c" />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas les permissions nécessaires pour accéder à l'administration.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.loginButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Candidatures d'hôtes</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{applications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{applications.filter(app => app.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#3498db' }]}>{applications.filter(app => app.status === 'reviewing').length}</Text>
          <Text style={styles.statLabel}>En révision</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{applications.filter(app => app.status === 'approved').length}</Text>
          <Text style={styles.statLabel}>Approuvées</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{applications.filter(app => app.status === 'rejected').length}</Text>
          <Text style={styles.statLabel}>Refusées</Text>
        </View>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {['all', 'pending', 'reviewing', 'approved', 'rejected'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(status as any)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === status && styles.filterButtonTextActive,
              ]}
            >
              {status === 'all' ? 'Toutes' :
               status === 'pending' ? 'En attente' :
               status === 'reviewing' ? 'En révision' :
               status === 'approved' ? 'Approuvées' :
               'Refusées'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && applications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des candidatures...</Text>
        </View>
      ) : filteredApplications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="home-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucune candidature</Text>
          <Text style={styles.emptySubtitle}>
            {filterStatus === 'all' 
              ? 'Aucune candidature trouvée'
              : `Aucune candidature ${filterStatus === 'pending' ? 'en attente' :
                 filterStatus === 'reviewing' ? 'en révision' :
                 filterStatus === 'approved' ? 'approuvée' : 'refusée'}`
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredApplications}
          keyExtractor={(item) => item.id}
          renderItem={renderApplicationItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#e74c3c']} />
          }
        />
      )}

      {/* Modal de détails */}
      {renderApplicationDetails()}
      
      {/* Modal de photos */}
      {renderPhotoViewer()}
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
  refreshButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
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
  applicationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    backgroundColor: '#f8f9ff',
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  applicationInfo: {
    flex: 1,
    marginRight: 10,
  },
  applicationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  applicationLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  applicationHost: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  applicationEmail: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  applicationDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  adminNotesContainer: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  adminNotesLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  adminNotesText: {
    fontSize: 14,
    color: '#333',
  },
  revisionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  revisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  revisionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  revisionText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  applicationActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  detailsModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  detailsContent: {
    flex: 1,
    padding: 20,
  },
  detailsSection: {
    marginBottom: 25,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexWrap: 'wrap',
  },
  detailsItem: {
    marginBottom: 12,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  detailsValue: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  notesInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewButton: {
    backgroundColor: '#e3f2fd',
  },
  approveButton: {
    backgroundColor: '#e8f5e8',
  },
  rejectButton: {
    backgroundColor: '#ffeaea',
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityIconText: {
    fontSize: 14,
    marginRight: 4,
  },
  amenityItem: {
    fontSize: 12,
    color: '#1976d2',
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
  loginButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  // Styles pour le photo viewer
  photoModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 0,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  photoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  photoContent: {
    flex: 1,
  },
  photoMainContainer: {
    backgroundColor: '#000',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoCategoryBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  photoCategoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 20,
  },
  navButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  photoCounter: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  classificationSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classificationButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e9ecef',
    marginRight: 8,
    marginBottom: 8,
  },
  classificationButtonSelected: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  classificationButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  classificationButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  ratingSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  featuredSection: {
    padding: 20,
    backgroundColor: '#fff',
  },
  thumbnailsSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  thumbnailsContainer: {
    marginTop: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    marginRight: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  selectedThumbnail: {
    borderColor: '#e74c3c',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  selectedThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Styles pour la catégorisation
  categoryContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  categoryButtonSelected: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  categoryButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  ratingContainer: {
    marginTop: 15,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingButtonSelected: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingButtonTextSelected: {
    color: '#fff',
  },
  featuredContainer: {
    marginTop: 15,
  },
  featuredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#f39c12',
    gap: 8,
  },
  featuredButtonSelected: {
    backgroundColor: '#f39c12',
    borderColor: '#f39c12',
  },
  featuredButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f39c12',
  },
  featuredButtonTextSelected: {
    color: '#fff',
  },
});

export default AdminApplicationsScreen;