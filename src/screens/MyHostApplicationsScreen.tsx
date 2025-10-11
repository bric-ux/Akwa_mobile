import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
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
    });
  };

  const renderApplication = (application: HostApplication) => (
    <View key={application.id} style={styles.applicationCard}>
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
      </View>

      {application.status === 'pending' && (
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

      {application.status === 'approved' && (
        <View style={styles.approvedMessage}>
          <Ionicons name="checkmark-circle" size={20} color="#28a745" />
          <Text style={styles.approvedText}>
            Félicitations ! Votre propriété a été approuvée et est maintenant visible sur AkwaHome.
          </Text>
        </View>
      )}
    </View>
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
    paddingVertical: 15,
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
  },
});

export default MyHostApplicationsScreen;
