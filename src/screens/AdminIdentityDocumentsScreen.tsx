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
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { supabase } from '../services/supabase';

interface IdentityDocument {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  uploaded_at: string;
  verified: boolean | null;
  verified_at: string | null;
}

interface UserProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
}

const AdminIdentityDocumentsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  
  const [documents, setDocuments] = useState<IdentityDocument[]>([]);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [selectedDoc, setSelectedDoc] = useState<IdentityDocument | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Charger tous les documents d'identité
      const { data: docs, error: docsError } = await supabase
        .from('identity_documents')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      // Charger les profils des utilisateurs
      const userIds = [...new Set(docs.map(doc => doc.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, phone, created_at')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Créer un mapping des profils
      const userMap: Record<string, UserProfile> = {};
      profiles.forEach(profile => {
        userMap[profile.user_id] = profile;
      });

      setDocuments(docs);
      setUsers(userMap);
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
      Alert.alert('Erreur', 'Impossible de charger les documents d\'identité');
    } finally {
      setLoading(false);
    }
  };

  // Charger les documents quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadDocuments();
      }
    }, [user, profile])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleVerifyDocument = async (docId: string, verified: boolean) => {
    setVerifying(true);
    try {
      const doc = documents.find(d => d.id === docId);
      if (!doc) throw new Error('Document non trouvé');

      const updateData: any = {
        verified: verified,
        verified_at: verified ? new Date().toISOString() : null,
      };

      // Ajouter les notes administratives si elles existent
      if (adminNotes.trim()) {
        updateData.admin_notes = adminNotes.trim();
      }

      const { error } = await supabase
        .from('identity_documents')
        .update(updateData)
        .eq('id', docId);

      if (error) throw error;

      // Mettre à jour le profil utilisateur
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ identity_verified: verified })
        .eq('user_id', doc.user_id);

      if (profileError) throw profileError;

      // Envoyer l'email de notification
      try {
        const user = users[doc.user_id];
        if (user?.email) {
          const emailType = verified ? 'identity_verified' : 'identity_rejected';
          const reason = verified 
            ? 'Document approuvé par l\'administrateur' 
            : 'Document rejeté par l\'administrateur';

          const { error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              type: emailType,
              to: user.email,
              data: {
                firstName: user.first_name,
                reason: reason,
                siteUrl: 'https://akwahome.com' // URL du site web
              }
            }
          });

          if (emailError) {
            console.error('Erreur envoi email:', emailError);
            // Continue même si l'email échoue
          } else {
            console.log('✅ Email de notification envoyé');
          }
        }
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email:', emailError);
        // Continue même si l'email échoue
      }

      // Mettre à jour l'état local
      setDocuments(prev => prev.map(doc => 
        doc.id === docId 
          ? { 
              ...doc, 
              verified, 
              verified_at: verified ? new Date().toISOString() : null,
              admin_notes: adminNotes.trim() || doc.admin_notes
            }
          : doc
      ));

      Alert.alert(
        'Succès',
        `Document ${verified ? 'approuvé' : 'rejeté'} avec succès${verified ? '' : '. Un email a été envoyé à l\'utilisateur.'}`
      );

      setShowModal(false);
      setSelectedDoc(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Erreur lors de la vérification:', error);
      Alert.alert('Erreur', 'Impossible de vérifier le document');
    } finally {
      setVerifying(false);
    }
  };

  const openDocumentModal = (doc: IdentityDocument) => {
    setSelectedDoc(doc);
    setShowModal(true);
  };

  const getStatusColor = (verified: boolean | null) => {
    if (verified === true) return '#10b981';
    if (verified === false) return '#ef4444';
    return '#f59e0b';
  };

  const getStatusText = (verified: boolean | null) => {
    if (verified === true) return 'Vérifié';
    if (verified === false) return 'Rejeté';
    return 'En attente';
  };

  const getStatusIcon = (verified: boolean | null) => {
    if (verified === true) return 'checkmark-circle';
    if (verified === false) return 'close-circle';
    return 'time';
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

  const getDocumentTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'cni': 'Carte Nationale d\'Identité',
      'passport': 'Passeport',
      'driving_license': 'Permis de Conduire',
    };
    return types[type] || type;
  };

  // Filtrer les documents
  const filteredDocuments = documents.filter(doc => {
    const user = users[doc.user_id];
    if (!user) return false;

    const matchesSearch = searchTerm === '' || 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'verified' && doc.verified === true) ||
      (statusFilter === 'pending' && doc.verified === null) ||
      (statusFilter === 'rejected' && doc.verified === false);

    return matchesSearch && matchesStatus;
  });

  const renderDocumentItem = ({ item }: { item: IdentityDocument }) => {
    const user = users[item.user_id];
    if (!user) return null;

    return (
      <TouchableOpacity
        style={styles.documentCard}
        onPress={() => openDocumentModal(item)}
      >
        <View style={styles.documentHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user.first_name} {user.last_name}
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.documentType}>
              {getDocumentTypeLabel(item.document_type)}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <Ionicons
              name={getStatusIcon(item.verified)}
              size={20}
              color={getStatusColor(item.verified)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.verified) }]}>
              {getStatusText(item.verified)}
            </Text>
          </View>
        </View>
        <Text style={styles.uploadDate}>
          Téléchargé le {formatDate(item.uploaded_at)}
        </Text>
        {item.verified_at && (
          <Text style={styles.verifyDate}>
            Vérifié le {formatDate(item.verified_at)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour accéder à l'administration.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Vérifier que l'utilisateur est admin
  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#e74c3c" />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des documents...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents d'identité</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#999"
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFilters}>
          {[
            { key: 'all', label: 'Tous' },
            { key: 'pending', label: 'En attente' },
            { key: 'verified', label: 'Vérifiés' },
            { key: 'rejected', label: 'Rejetés' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                statusFilter === filter.key && styles.filterButtonActive
              ]}
              onPress={() => setStatusFilter(filter.key as any)}
            >
              <Text style={[
                styles.filterButtonText,
                statusFilter === filter.key && styles.filterButtonTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Liste des documents */}
      <FlatList
        data={filteredDocuments}
        renderItem={renderDocumentItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucun document</Text>
            <Text style={styles.emptySubtitle}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Aucun document ne correspond à vos critères'
                : 'Aucun document d\'identité n\'a été téléchargé'
              }
            </Text>
          </View>
        }
      />

      {/* Modal de vérification */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Vérifier le document</Text>
            <View style={styles.modalHeaderRight} />
          </View>

          {selectedDoc && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentInfoTitle}>Informations du document</Text>
                <Text style={styles.documentInfoText}>
                  Utilisateur: {users[selectedDoc.user_id]?.first_name} {users[selectedDoc.user_id]?.last_name}
                </Text>
                <Text style={styles.documentInfoText}>
                  Email: {users[selectedDoc.user_id]?.email}
                </Text>
                <Text style={styles.documentInfoText}>
                  Type: {getDocumentTypeLabel(selectedDoc.document_type)}
                </Text>
                <Text style={styles.documentInfoText}>
                  Téléchargé le: {formatDate(selectedDoc.uploaded_at)}
                </Text>
              </View>

              <View style={styles.documentImageContainer}>
                <Text style={styles.documentImageTitle}>Document</Text>
                <Image
                  source={{ uri: selectedDoc.document_url }}
                  style={styles.documentImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes (optionnel)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Ajouter des notes sur la vérification..."
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleVerifyDocument(selectedDoc.id, false)}
                  disabled={verifying}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Rejeter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleVerifyDocument(selectedDoc.id, true)}
                  disabled={verifying}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Approuver</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerRight: {
    width: 40,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  statusFilters: {
    marginTop: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 20,
  },
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  documentType: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  uploadDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  verifyDate: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalHeaderRight: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  documentInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  documentInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  documentInfoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  documentImageContainer: {
    marginBottom: 20,
  },
  documentImageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  documentImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  notesContainer: {
    marginBottom: 30,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    textAlignVertical: 'top',
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
    paddingVertical: 16,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AdminIdentityDocumentsScreen;
