import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useHostApplications, HostApplication } from '../hooks/useHostApplications';

const MyHostApplicationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getApplications, deleteApplication, loading } = useHostApplications();
  
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  const loadApplications = async () => {
    try {
      const data = await getApplications();
      setApplications(data);
    } catch (error) {
      console.error('Erreur lors du chargement des candidatures:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadApplications();
    setRefreshing(false);
  };

  const handleDeleteApplication = (application: HostApplication) => {
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
                Alert.alert('Succès', 'Candidature supprimée avec succès');
                loadApplications();
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
        return 'En cours d\'examen';
      case 'approved':
        return 'Approuvée';
      case 'rejected':
        return 'Rejetée';
      default:
        return status;
    }
  };

  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case 'apartment':
        return '🏢';
      case 'house':
        return '🏠';
      case 'villa':
        return '🏡';
      case 'studio':
        return '🏠';
      case 'guesthouse':
        return '🏨';
      default:
        return '🏠';
    }
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

  const renderApplication = (application: HostApplication) => (
    <TouchableOpacity 
      key={application.id} 
      style={[
        styles.applicationCard,
        application.status === 'reviewing' && styles.reviewingCard
      ]}
      onPress={() => {
        navigation.navigate('ApplicationDetails' as never, { applicationId: application.id } as never);
      }}
    >
      <View style={styles.applicationHeader}>
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyIcon}>
            {getPropertyTypeIcon(application.property_type)}
          </Text>
          <View style={styles.propertyDetails}>
            <Text style={styles.propertyTitle} numberOfLines={1}>
              {application.title}
            </Text>
            <Text style={styles.propertyLocation} numberOfLines={1}>
              📍 {application.location}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
            <Text style={styles.statusText}>
              {getStatusText(application.status)}
            </Text>
          </View>
          {application.status === 'reviewing' && (
            <View style={styles.reviewingIndicator}>
              <Ionicons name="refresh" size={12} color="#ffc107" />
              <Text style={styles.reviewingText}>En révision</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.applicationDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>{application.property_type}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Capacité:</Text>
          <Text style={styles.detailValue}>
            {application.max_guests} invités • {application.bedrooms} chambres • {application.bathrooms} sdb
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Prix:</Text>
          <Text style={styles.detailValue}>
            {application.price_per_night.toLocaleString()} FCFA/nuit
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Soumis le:</Text>
          <Text style={styles.detailValue}>{formatDate(application.created_at)}</Text>
        </View>

        {application.reviewed_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Examiné le:</Text>
            <Text style={styles.detailValue}>{formatDate(application.reviewed_at)}</Text>
          </View>
        )}

        {application.admin_notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes de l'admin:</Text>
            <Text style={styles.notesText}>{application.admin_notes}</Text>
          </View>
        )}

        {/* Afficher l'encart "modifications requises" seulement si le message ne commence pas par "Modifications:" (c'est-à-dire si l'hôte n'a pas encore modifié) */}
        {application.status === 'reviewing' && application.revision_message && !application.revision_message.startsWith('Modifications:') && (
          <View style={styles.revisionContainer}>
            <View style={styles.revisionHeader}>
              <Ionicons name="alert-circle" size={20} color="#856404" />
              <Text style={styles.revisionLabel}>⚠️ Modifications requises</Text>
            </View>
            
            {/* Afficher les champs spécifiques à modifier */}
            {application.fields_to_revise && application.fields_to_revise.length > 0 && (
              <View style={styles.revisionFieldsContainer}>
                <Text style={styles.revisionFieldsLabel}>Champs à modifier :</Text>
                <View style={styles.revisionFieldsList}>
                  {application.fields_to_revise.map((field, index) => {
                    const fieldLabels: Record<string, string> = {
                      'title': 'Titre',
                      'description': 'Description',
                      'property_type': 'Type de propriété',
                      'location': 'Localisation',
                      'price_per_night': 'Prix par nuit',
                      'max_guests': 'Capacité',
                      'bedrooms': 'Chambres',
                      'bathrooms': 'Salles de bain',
                      'images': 'Photos',
                      'amenities': 'Équipements',
                      'minimum_nights': 'Nuitées minimum',
                      'cancellation_policy': 'Politique d\'annulation',
                      'host_guide': 'Guide de l\'hôte',
                      'cleaning_fee': 'Frais de ménage',
                    };
                    return (
                      <View key={index} style={styles.revisionFieldTag}>
                        <Text style={styles.revisionFieldText}>
                          {fieldLabels[field] || field}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
            
            <Text style={styles.revisionText}>{application.revision_message}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                // Navigation vers l'écran d'édition de la candidature
                navigation.navigate('BecomeHost' as never, { editApplicationId: application.id } as never);
              }}
            >
              <Ionicons name="create-outline" size={16} color="#e74c3c" />
              <Text style={styles.editButtonText}>Modifier la candidature</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Afficher le message "Modifications effectuées" si l'hôte a déjà modifié */}
        {application.status === 'reviewing' && application.revision_message && application.revision_message.startsWith('Modifications:') && (
          <View style={[styles.revisionContainer, { backgroundColor: '#e8f5e9', borderLeftColor: '#2E7D32' }]}>
            <View style={styles.revisionHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={[styles.revisionLabel, { color: '#2E7D32' }]}>✅ Modifications soumises</Text>
            </View>
            <Text style={[styles.revisionText, { color: '#1b5e20' }]}>{application.revision_message}</Text>
          </View>
        )}
      </View>

      {application.status === 'reviewing' && !application.revision_message && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              navigation.navigate('BecomeHost' as never, { editApplicationId: application.id } as never);
            }}
          >
            <Ionicons name="create-outline" size={16} color="#e74c3c" />
            <Text style={styles.editButtonText}>Modifier la candidature</Text>
          </TouchableOpacity>
        </View>
      )}

      {(application.status === 'pending' || application.status === 'rejected') && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteApplication(application)}
          >
            <Ionicons name="trash-outline" size={16} color="#dc3545" />
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}

    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Vous devez être connecté pour voir vos candidatures</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Auth' as never)}
        >
          <Text style={styles.loginButtonText}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes candidatures</Text>
        <TouchableOpacity onPress={() => navigation.navigate('BecomeHost' as never)}>
          <Ionicons name="add" size={24} color="#007bff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading && applications.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : applications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucune candidature</Text>
            <Text style={styles.emptySubtitle}>
              Vous n'avez pas encore soumis de candidature pour devenir hôte.
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('BecomeHost' as never)}
            >
              <Text style={styles.createButtonText}>Devenir hôte</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.applicationsList}>
            {applications.map(renderApplication)}
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
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
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
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  createButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applicationsList: {
    paddingVertical: 20,
  },
  applicationCard: {
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
  reviewingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    backgroundColor: '#fffbf0',
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  propertyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  propertyIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  propertyDetails: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    marginLeft: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  reviewingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  reviewingText: {
    fontSize: 10,
    color: '#ffc107',
    fontWeight: '500',
  },
  applicationDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  notesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  revisionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  revisionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  revisionText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  revisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  revisionFieldsContainer: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#fffbf0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  revisionFieldsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 6,
  },
  revisionFieldsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  revisionFieldTag: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  revisionFieldText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e74c3c',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#dc3545',
    marginLeft: 4,
  },
  approvedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  approvedText: {
    fontSize: 14,
    color: '#155724',
    marginLeft: 8,
    flex: 1,
    fontWeight: '600',
  },
  approvedNote: {
    fontSize: 12,
    color: '#856404',
    marginTop: 8,
    marginLeft: 8,
    fontStyle: 'italic',
  },
});

export default MyHostApplicationsScreen;
