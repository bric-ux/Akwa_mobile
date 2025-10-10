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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { HostApplication } from '../hooks/useHostApplications';
import { supabase } from '../services/supabase';

const AdminApplicationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getAllHostApplications, updateApplicationStatus, loading } = useAdmin();
  
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<HostApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reviewing' | 'approved' | 'rejected'>('all');
  const [identityDoc, setIdentityDoc] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

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
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement document identité:', error);
        setIdentityDoc(null);
        return;
      }

      setIdentityDoc(data);
    } catch (error) {
      console.error('Erreur:', error);
      setIdentityDoc(null);
    }
  };

  // Charger les candidatures quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadApplications();
      }
    }, [user])
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
              const result = await updateApplicationStatus(applicationId, status, adminNotes || undefined);
              if (result.success) {
                Alert.alert('Succès', `Candidature ${actionText}ée avec succès`);
                setAdminNotes('');
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
        style={styles.applicationCard}
        onPress={() => {
          setSelectedApp(application);
          setShowDetails(true);
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
        </View>
      </TouchableOpacity>
    );
  };

  const renderApplicationDetails = () => {
    if (!selectedApp || !showDetails) return null;

    const statusInfo = getStatusBadge(selectedApp.status);

    return (
      <View style={styles.detailsModal}>
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>Détails de la candidature</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setShowDetails(false);
              setSelectedApp(null);
              setAdminNotes('');
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
          </View>

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
          </View>

          {/* Notes administratives */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionTitle}>📝 Notes administratives</Text>
            
            <TextInput
              style={styles.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Ajouter des notes pour cette candidature..."
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
                  onPress={() => handleStatusUpdate(selectedApp.id, 'reviewing')}
                  disabled={loading}
                >
                  <Ionicons name="eye-outline" size={16} color="#3498db" />
                  <Text style={styles.actionButtonText}>Mettre en révision</Text>
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
      </View>
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
          <Text style={styles.statValue}>{applications.filter(app => app.status === 'reviewing').length}</Text>
          <Text style={styles.statLabel}>En révision</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{applications.filter(app => app.status === 'approved').length}</Text>
          <Text style={styles.statLabel}>Approuvées</Text>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
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
});

export default AdminApplicationsScreen;