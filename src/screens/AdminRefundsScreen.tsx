import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { formatAmount } from '../utils/priceCalculator';

interface Refund {
  id: string;
  amount: number;
  reason: string;
  status: string;
  refund_type: string;
  created_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
  payment: {
    id: string;
    amount: number;
    payment_method: string;
    status: string;
  };
  booking: {
    id: string;
    check_in_date?: string;
    check_out_date?: string;
    total_price: number;
    status: string;
    properties?: {
      id: string;
      title: string;
    };
    guest_profile?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    };
  };
  processor_profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

const AdminRefundsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    loadRefunds();
  }, [statusFilter]);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('refunds')
        .select(`
          *,
          payment:payments(
            id,
            amount,
            payment_method,
            status
          ),
          booking:bookings(
            id,
            check_in_date,
            check_out_date,
            total_price,
            status,
            properties(
              id,
              title
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrichir avec les profils
      const refundsWithProfiles = await Promise.all(
        (data || []).map(async (refund: any) => {
          const [guestResult, processorResult] = await Promise.all([
            refund.booking?.guest_id
              ? supabase
                  .from('profiles')
                  .select('first_name, last_name, email, phone')
                  .eq('user_id', refund.booking.guest_id)
                  .single()
              : { data: null },
            refund.processed_by
              ? supabase
                  .from('profiles')
                  .select('first_name, last_name, email')
                  .eq('user_id', refund.processed_by)
                  .single()
              : { data: null },
          ]);

          return {
            ...refund,
            booking: {
              ...refund.booking,
              guest_profile: guestResult.data,
            },
            processor_profile: processorResult.data,
          };
        })
      );

      setRefunds(refundsWithProfiles as Refund[]);
    } catch (error) {
      console.error('Erreur chargement remboursements:', error);
      Alert.alert('Erreur', 'Impossible de charger les remboursements');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRefunds();
    setRefreshing(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: string; label: string }> = {
      completed: { color: '#10b981', icon: 'checkmark-circle', label: 'Traité' },
      pending: { color: '#f59e0b', icon: 'time', label: 'En attente' },
      failed: { color: '#ef4444', icon: 'close-circle', label: 'Échoué' },
    };
    return config[status] || { color: '#666', icon: 'help-circle', label: status };
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

  const handleViewDetails = (refund: Refund) => {
    setSelectedRefund(refund);
    setDetailsModalVisible(true);
  };

  const totalRefunds = refunds.reduce((sum, r) => sum + r.amount, 0);
  const pendingRefunds = refunds.filter(r => r.status === 'pending').length;
  const completedRefunds = refunds.filter(r => r.status === 'completed').length;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Remboursements</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Remboursements</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Statistiques */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color="#ef4444" />
            <Text style={styles.statValue}>{formatAmount(totalRefunds)}</Text>
            <Text style={styles.statLabel}>Total remboursé</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{pendingRefunds}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#10b981" />
            <Text style={styles.statValue}>{completedRefunds}</Text>
            <Text style={styles.statLabel}>Traité</Text>
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.filterText, statusFilter === 'all' && styles.filterTextActive]}>
                Tous
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'pending' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text style={[styles.filterText, statusFilter === 'pending' && styles.filterTextActive]}>
                En attente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'completed' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('completed')}
            >
              <Text style={[styles.filterText, statusFilter === 'completed' && styles.filterTextActive]}>
                Traité
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Liste des remboursements */}
        {refunds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="refresh-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucun remboursement trouvé</Text>
          </View>
        ) : (
          refunds.map((refund) => {
            const statusConfig = getStatusBadge(refund.status);
            const customer = refund.booking?.guest_profile;

            return (
              <TouchableOpacity
                key={refund.id}
                style={styles.refundCard}
                onPress={() => handleViewDetails(refund)}
              >
                <View style={styles.refundHeader}>
                  <View style={styles.refundTitleContainer}>
                    <Ionicons name="home-outline" size={20} color="#e67e22" />
                    <Text style={styles.refundTitle} numberOfLines={1}>
                      {refund.booking?.properties?.title || 'Réservation'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                    <Ionicons name={statusConfig.icon as any} size={16} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.refundDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {customer?.first_name} {customer?.last_name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={16} color="#666" />
                    <Text style={[styles.detailText, styles.amountText]}>
                      {formatAmount(refund.amount)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>{formatDate(refund.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.reasonContainer}>
                  <Text style={styles.reasonLabel}>Raison:</Text>
                  <Text style={styles.reasonText} numberOfLines={2}>
                    {refund.reason}
                  </Text>
                </View>

                <View style={styles.viewDetailsButton}>
                  <Text style={styles.viewDetailsText}>Voir les détails</Text>
                  <Ionicons name="chevron-forward" size={20} color="#e67e22" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de détails */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails du remboursement</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedRefund && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Informations générales</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>ID Remboursement</Text>
                    <Text style={styles.infoValue}>{selectedRefund.id}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Statut</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBadge(selectedRefund.status).color + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusBadge(selectedRefund.status).color }]}>
                        {getStatusBadge(selectedRefund.status).label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Type</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.refund_type === 'full' ? 'Complet' : 'Partiel'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Montant</Text>
                    <Text style={[styles.infoValue, styles.amountValue]}>
                      {formatAmount(selectedRefund.amount)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date de création</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedRefund.created_at)}</Text>
                  </View>
                  {selectedRefund.processed_at && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Date de traitement</Text>
                      <Text style={styles.infoValue}>{formatDate(selectedRefund.processed_at)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Réservation</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Propriété</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.booking?.properties?.title || 'N/A'}
                    </Text>
                  </View>
                  {selectedRefund.booking?.check_in_date && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Dates</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(selectedRefund.booking.check_in_date)} -{' '}
                        {formatDate(selectedRefund.booking.check_out_date || '')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Montant réservation</Text>
                    <Text style={styles.infoValue}>
                      {formatAmount(selectedRefund.booking?.total_price || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Client</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nom</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.booking?.guest_profile?.first_name}{' '}
                      {selectedRefund.booking?.guest_profile?.last_name}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.booking?.guest_profile?.email || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Téléphone</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.booking?.guest_profile?.phone || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Paiement</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Méthode</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.payment?.payment_method || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Statut</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.payment?.status || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Raison du remboursement</Text>
                  <Text style={styles.reasonTextFull}>{selectedRefund.reason}</Text>
                </View>

                {selectedRefund.processor_profile && (
                  <View style={styles.modalSection}>
                    <Text style={styles.sectionTitle}>Traité par</Text>
                    <Text style={styles.infoValue}>
                      {selectedRefund.processor_profile.first_name}{' '}
                      {selectedRefund.processor_profile.last_name}
                    </Text>
                    <Text style={[styles.infoValue, styles.emailValue]}>
                      {selectedRefund.processor_profile.email}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  refundCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refundTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  refundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refundDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  amountText: {
    fontWeight: '600',
    color: '#ef4444',
    fontSize: 16,
  },
  reasonContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#e67e22',
    fontWeight: '600',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  amountValue: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emailValue: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  reasonTextFull: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default AdminRefundsScreen;


