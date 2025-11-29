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
import { Vehicle } from '../types';
import { supabase } from '../services/supabase';
import { useCurrency } from '../hooks/useCurrency';

const AdminVehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { formatPrice } = useCurrency();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          locations:location_id (
            id,
            name,
            type
          ),
          vehicle_photos (
            id,
            url,
            category,
            is_main,
            display_order
          ),
          owner:profiles!owner_id (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des véhicules:', error);
      Alert.alert('Erreur', 'Impossible de charger les véhicules');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadVehicles();
      }
    }, [user, profile])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVehicles();
    setRefreshing(false);
  };

  const handleApprove = async (vehicleId: string) => {
    Alert.alert(
      'Confirmer l\'approbation',
      'Êtes-vous sûr de vouloir approuver ce véhicule ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vehicles')
                .update({
                  admin_approved: true,
                  admin_rejected: false,
                  is_active: true,
                  admin_notes: adminNotes || null,
                  reviewed_by: user?.id,
                  reviewed_at: new Date().toISOString(),
                })
                .eq('id', vehicleId);

              if (error) throw error;

              Alert.alert('Succès', 'Véhicule approuvé avec succès');
              setAdminNotes('');
              setSelectedVehicle(null);
              setShowDetails(false);
              loadVehicles();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible d\'approuver le véhicule');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (vehicleId: string) => {
    if (!adminNotes.trim()) {
      Alert.alert('Erreur', 'Veuillez ajouter une note expliquant le rejet');
      return;
    }

    Alert.alert(
      'Confirmer le rejet',
      'Êtes-vous sûr de vouloir rejeter ce véhicule ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rejeter',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vehicles')
                .update({
                  admin_approved: false,
                  admin_rejected: true,
                  is_active: false,
                  admin_notes: adminNotes,
                  reviewed_by: user?.id,
                  reviewed_at: new Date().toISOString(),
                })
                .eq('id', vehicleId);

              if (error) throw error;

              Alert.alert('Succès', 'Véhicule rejeté');
              setAdminNotes('');
              setSelectedVehicle(null);
              setShowDetails(false);
              loadVehicles();
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de rejeter le véhicule');
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

  const getStatusBadge = (vehicle: Vehicle) => {
    if (vehicle.admin_approved) {
      return { color: '#2E7D32', text: 'Approuvé', icon: 'checkmark-circle-outline' };
    }
    if (vehicle.admin_rejected) {
      return { color: '#e74c3c', text: 'Rejeté', icon: 'close-circle-outline' };
    }
    return { color: '#f39c12', text: 'En attente', icon: 'time-outline' };
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') {
      return !vehicle.admin_approved && !vehicle.admin_rejected;
    }
    if (filterStatus === 'approved') {
      return vehicle.admin_approved;
    }
    if (filterStatus === 'rejected') {
      return vehicle.admin_rejected;
    }
    return true;
  });

  const renderVehicleItem = ({ item: vehicle }: { item: Vehicle }) => {
    const statusInfo = getStatusBadge(vehicle);
    const owner = (vehicle as any).owner;
    
    return (
      <TouchableOpacity
        style={styles.vehicleCard}
        onPress={() => {
          setSelectedVehicle(vehicle);
          setAdminNotes(vehicle.admin_notes || '');
          setShowDetails(true);
        }}
      >
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleTitle} numberOfLines={1}>
              {vehicle.brand} {vehicle.model} {vehicle.year}
            </Text>
            <Text style={styles.vehicleSubtitle} numberOfLines={1}>
              {vehicle.title}
            </Text>
            {vehicle.location && (
              <Text style={styles.vehicleLocation} numberOfLines={1}>
                📍 {vehicle.location.name}
              </Text>
            )}
            {owner && (
              <Text style={styles.vehicleOwner} numberOfLines={1}>
                👤 {owner.first_name} {owner.last_name}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={12} color="#fff" />
            <Text style={styles.statusText}>{statusInfo.text}</Text>
          </View>
        </View>

        <View style={styles.vehicleDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type:</Text>
            <Text style={styles.detailValue}>{vehicle.vehicle_type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Places:</Text>
            <Text style={styles.detailValue}>{vehicle.seats}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Prix:</Text>
            <Text style={styles.detailValue}>{formatPrice(vehicle.price_per_day)}/jour</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{formatDate(vehicle.created_at)}</Text>
          </View>
        </View>

        {vehicle.admin_notes && (
          <View style={styles.adminNotesContainer}>
            <Text style={styles.adminNotesLabel}>Notes admin:</Text>
            <Text style={styles.adminNotesText}>{vehicle.admin_notes}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Validation des véhicules</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filters}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterText,
                filterStatus === status && styles.filterTextActive,
              ]}
            >
              {status === 'all' ? 'Tous' : status === 'pending' ? 'En attente' : status === 'approved' ? 'Approuvés' : 'Rejetés'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredVehicles}
        renderItem={renderVehicleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2E7D32']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucun véhicule trouvé</Text>
          </View>
        }
      />

      {/* Modal de détails */}
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetails(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Détails du véhicule</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Ionicons name="close" size={24} color="#2c3e50" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedVehicle && (
              <>
                {/* Photos */}
                {selectedVehicle.images && selectedVehicle.images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
                    {selectedVehicle.images.map((image, index) => (
                      <Image key={index} source={{ uri: image }} style={styles.photo} />
                    ))}
                  </ScrollView>
                )}

                {/* Informations */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Informations</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Titre:</Text>
                    <Text style={styles.detailValue}>{selectedVehicle.title}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Marque/Modèle:</Text>
                    <Text style={styles.detailValue}>{selectedVehicle.brand} {selectedVehicle.model} {selectedVehicle.year}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>{selectedVehicle.vehicle_type}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Places:</Text>
                    <Text style={styles.detailValue}>{selectedVehicle.seats}</Text>
                  </View>
                  {selectedVehicle.transmission && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Transmission:</Text>
                      <Text style={styles.detailValue}>{selectedVehicle.transmission}</Text>
                    </View>
                  )}
                  {selectedVehicle.fuel_type && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Carburant:</Text>
                      <Text style={styles.detailValue}>{selectedVehicle.fuel_type}</Text>
                    </View>
                  )}
                  {selectedVehicle.description && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description:</Text>
                      <Text style={styles.detailValue}>{selectedVehicle.description}</Text>
                    </View>
                  )}
                </View>

                {/* Tarification */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Tarification</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Prix/jour:</Text>
                    <Text style={styles.detailValue}>{formatPrice(selectedVehicle.price_per_day)}</Text>
                  </View>
                  {selectedVehicle.price_per_week && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Prix/semaine:</Text>
                      <Text style={styles.detailValue}>{formatPrice(selectedVehicle.price_per_week)}</Text>
                    </View>
                  )}
                  {selectedVehicle.security_deposit > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Caution:</Text>
                      <Text style={styles.detailValue}>{formatPrice(selectedVehicle.security_deposit)}</Text>
                    </View>
                  )}
                </View>

                {/* Équipements */}
                {selectedVehicle.features && selectedVehicle.features.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Équipements</Text>
                    <View style={styles.featuresContainer}>
                      {selectedVehicle.features.map((feature, index) => (
                        <View key={index} style={styles.featureTag}>
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Notes admin */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Notes admin</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Ajouter des notes..."
                    value={adminNotes}
                    onChangeText={setAdminNotes}
                    multiline
                    numberOfLines={4}
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Actions */}
          {selectedVehicle && !selectedVehicle.admin_approved && !selectedVehicle.admin_rejected && (
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(selectedVehicle.id)}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Rejeter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(selectedVehicle.id)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Approuver</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  vehicleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  vehicleLocation: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  vehicleOwner: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#2c3e50',
  },
  adminNotesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  adminNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  adminNotesText: {
    fontSize: 12,
    color: '#2c3e50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  photosContainer: {
    marginBottom: 20,
  },
  photo: {
    width: 300,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  featureText: {
    fontSize: 12,
    color: '#2E7D32',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  approveButton: {
    backgroundColor: '#2E7D32',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdminVehiclesScreen;

