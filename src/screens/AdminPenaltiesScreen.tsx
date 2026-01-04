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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { formatAmount } from '../utils/priceCalculator';

interface Penalty {
  id: string;
  booking_id: string;
  host_id: string;
  guest_id: string;
  penalty_amount: number;
  penalty_type: string;
  status: string;
  deducted_at?: string | null;
  waived_at?: string | null;
  waived_reason?: string | null;
  admin_notes?: string | null;
  created_at: string;
  booking?: {
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    property?: {
      title: string;
    };
  };
  host?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  guest?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

const AdminPenaltiesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [waiveModalVisible, setWaiveModalVisible] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    loadPenalties();
  }, [statusFilter, typeFilter]);

  const loadPenalties = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('penalty_tracking')
        .select(`
          *,
          booking:bookings(
            check_in_date,
            check_out_date,
            total_price,
            property:properties(title)
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        query = query.eq('penalty_type', typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch host and guest profiles
      const penaltiesWithProfiles = await Promise.all(
        (data || []).map(async (penalty) => {
          const [hostResult, guestResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('user_id', penalty.host_id)
              .single(),
            supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('user_id', penalty.guest_id)
              .single(),
          ]);

          return {
            ...penalty,
            host: hostResult.data,
            guest: guestResult.data,
          };
        })
      );

      setPenalties(penaltiesWithProfiles as Penalty[]);
    } catch (error) {
      console.error('Erreur chargement pénalités:', error);
      Alert.alert('Erreur', 'Impossible de charger les pénalités');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPenalties();
    setRefreshing(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: string; label: string }> = {
      pending: { color: '#f59e0b', icon: 'time-outline', label: 'En attente' },
      deducted: { color: '#3b82f6', icon: 'checkmark-circle-outline', label: 'Déduit' },
      paid_directly: { color: '#10b981', icon: 'cash-outline', label: 'Payée directement' },
      waived: { color: '#6b7280', icon: 'close-circle-outline', label: 'Annulée' },
      collected_manually: { color: '#10b981', icon: 'checkmark-circle-outline', label: 'Collectée manuellement' },
    };
    return config[status] || { color: '#666', icon: 'help-circle-outline', label: status };
  };

  const getTypeBadge = (type: string) => {
    if (type === 'host_cancellation') {
      return { color: '#ef4444', label: 'Annulation Hôte' };
    } else if (type === 'host_ongoing_cancellation') {
      return { color: '#f97316', label: 'Annulation en cours' };
    }
    return { color: '#6b7280', label: 'Annulation Voyageur' };
  };

  const handleWaive = async () => {
    if (!selectedPenalty || !waiveReason.trim()) {
      Alert.alert('Erreur', 'Veuillez fournir une raison pour annuler la pénalité');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('penalty_tracking')
        .update({
          status: 'waived',
          waived_at: new Date().toISOString(),
          waived_reason: waiveReason,
          admin_notes: adminNotes || selectedPenalty.admin_notes,
        })
        .eq('id', selectedPenalty.id);

      if (error) throw error;

      Alert.alert('Succès', 'Pénalité annulée avec succès');
      setWaiveModalVisible(false);
      setSelectedPenalty(null);
      setWaiveReason('');
      setAdminNotes('');
      loadPenalties();
    } catch (error) {
      console.error('Erreur annulation pénalité:', error);
      Alert.alert('Erreur', 'Impossible d\'annuler la pénalité');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCollected = async (penalty: Penalty) => {
    try {
      const { error } = await supabase
        .from('penalty_tracking')
        .update({
          status: 'collected_manually',
          deducted_at: new Date().toISOString(),
        })
        .eq('id', penalty.id);

      if (error) throw error;

      // Envoyer email de confirmation
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'penalty_collected_confirmation',
          to: penalty.host?.email,
          data: {
            hostName: penalty.host?.first_name,
            amount: penalty.penalty_amount,
            propertyTitle: penalty.booking?.property?.title,
          },
        },
      });

      Alert.alert('Succès', 'Pénalité marquée comme collectée. Email envoyé à l\'hôte.');
      loadPenalties();
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la pénalité');
    }
  };

  const handleSendReminder = async (penalty: Penalty) => {
    setSendingReminder(true);
    try {
      // Envoyer email de rappel
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'penalty_reminder',
          to: penalty.host?.email,
          data: {
            hostName: penalty.host?.first_name,
            amount: penalty.penalty_amount,
            propertyTitle: penalty.booking?.property?.title,
            checkIn: penalty.booking?.check_in_date,
            penaltyType: penalty.penalty_type,
            message: 'Ce montant sera automatiquement déduit de vos prochains revenus de réservation si non réglé dans les plus brefs délais.',
          },
        },
      });

      if (error) throw error;

      // Mettre à jour les notes admin
      await supabase
        .from('penalty_tracking')
        .update({
          admin_notes: `${penalty.admin_notes || ''}\n[${new Date().toLocaleDateString('fr-FR')}] Rappel envoyé par email.`,
        })
        .eq('id', penalty.id);

      Alert.alert('Rappel envoyé', `Email de rappel envoyé à ${penalty.host?.email}`);
      loadPenalties();
    } catch (error) {
      console.error('Erreur envoi rappel:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le rappel');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleSendBulkReminders = async () => {
    const pendingPenalties = penalties.filter((p) => p.status === 'pending');
    if (pendingPenalties.length === 0) {
      Alert.alert('Info', 'Aucune pénalité en attente');
      return;
    }

    setSendingReminder(true);
    let successCount = 0;

    for (const penalty of pendingPenalties) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'penalty_reminder',
            to: penalty.host?.email,
            data: {
              hostName: penalty.host?.first_name,
              amount: penalty.penalty_amount,
              propertyTitle: penalty.booking?.property?.title,
              checkIn: penalty.booking?.check_in_date,
              penaltyType: penalty.penalty_type,
              message: 'Ce montant sera automatiquement déduit de vos prochains revenus de réservation si non réglé dans les plus brefs délais.',
            },
          },
        });
        successCount++;
        // Délai entre les emails
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Erreur envoi rappel pour ${penalty.id}:`, error);
      }
    }

    Alert.alert('Rappels envoyés', `${successCount}/${pendingPenalties.length} rappels envoyés avec succès`);
    setSendingReminder(false);
    loadPenalties();
  };

  // Stats
  const pendingCount = penalties.filter((p) => p.status === 'pending').length;
  const pendingAmount = penalties
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.penalty_amount, 0);
  const collectedAmount = penalties
    .filter((p) => p.status === 'deducted' || p.status === 'collected_manually' || p.status === 'paid_directly')
    .reduce((sum, p) => sum + p.penalty_amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des Pénalités</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Actions */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.actionButton, sendingReminder && styles.actionButtonDisabled]}
            onPress={handleSendBulkReminders}
            disabled={sendingReminder || pendingCount === 0}
          >
            <Ionicons name="send-outline" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Envoyer rappels ({pendingCount})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pénalités en attente</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{pendingCount}</Text>
            <Text style={styles.statSubtext}>{formatAmount(pendingAmount)} à récupérer</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pénalités collectées</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>
              {formatAmount(collectedAmount)}
            </Text>
            <Text style={styles.statSubtext}>Total récupéré</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total pénalités</Text>
            <Text style={styles.statValue}>{penalties.length}</Text>
            <Text style={styles.statSubtext}>Toutes périodes confondues</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Taux de récupération</Text>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>
              {penalties.length > 0
                ? Math.round((collectedAmount / (collectedAmount + pendingAmount)) * 100)
                : 0}
              %
            </Text>
            <Text style={styles.statSubtext}>Pénalités réglées</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <View style={styles.filterGroup}>
            <Ionicons name="filter-outline" size={16} color="#666" />
            <Text style={styles.filterLabel}>Filtres:</Text>
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'all' && styles.filterButtonTextActive,
                ]}
              >
                Tous les statuts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'pending' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'pending' && styles.filterButtonTextActive,
                ]}
              >
                En attente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'deducted' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('deducted')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'deducted' && styles.filterButtonTextActive,
                ]}
              >
                Déduit
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('all')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'all' && styles.filterButtonTextActive,
                ]}
              >
                Tous les types
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                typeFilter === 'host_cancellation' && styles.filterButtonActive,
              ]}
              onPress={() => setTypeFilter('host_cancellation')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'host_cancellation' && styles.filterButtonTextActive,
                ]}
              >
                Annulation Hôte
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                typeFilter === 'guest_cancellation' && styles.filterButtonActive,
              ]}
              onPress={() => setTypeFilter('guest_cancellation')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'guest_cancellation' && styles.filterButtonTextActive,
                ]}
              >
                Annulation Voyageur
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Penalties List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e67e22" />
          </View>
        ) : penalties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune pénalité trouvée</Text>
          </View>
        ) : (
          <View style={styles.penaltiesList}>
            {penalties.map((penalty) => {
              const statusBadge = getStatusBadge(penalty.status);
              const typeBadge = getTypeBadge(penalty.penalty_type);

              return (
                <View key={penalty.id} style={styles.penaltyCard}>
                  <View style={styles.penaltyHeader}>
                    <View style={styles.penaltyHeaderLeft}>
                      <Ionicons name="calendar-outline" size={16} color="#666" />
                      <Text style={styles.penaltyDate}>
                        {new Intl.DateTimeFormat('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }).format(new Date(penalty.created_at))}
                      </Text>
                    </View>
                    <View style={styles.badgesContainer}>
                      <View style={[styles.typeBadge, { backgroundColor: `${typeBadge.color}20` }]}>
                        <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>
                          {typeBadge.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${statusBadge.color}20` },
                        ]}
                      >
                        <Ionicons name={statusBadge.icon} size={14} color={statusBadge.color} />
                        <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.penaltyContent}>
                    <View style={styles.penaltyInfoRow}>
                      <Ionicons name="home-outline" size={16} color="#666" />
                      <Text style={styles.penaltyInfoText}>
                        {penalty.booking?.property?.title || 'N/A'}
                      </Text>
                    </View>

                    <View style={styles.penaltyInfoRow}>
                      <Ionicons name="person-outline" size={16} color="#666" />
                      <Text style={styles.penaltyInfoText}>
                        {penalty.host?.first_name} {penalty.host?.last_name}
                      </Text>
                      <Text style={styles.penaltyInfoSubtext}>{penalty.host?.email}</Text>
                    </View>

                    <View style={styles.penaltyAmountRow}>
                      <Text style={styles.penaltyAmountLabel}>Montant</Text>
                      <Text style={styles.penaltyAmountValue}>
                        {formatAmount(penalty.penalty_amount)}
                      </Text>
                    </View>

                    {penalty.status === 'pending' && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => handleSendReminder(penalty)}
                          disabled={sendingReminder}
                        >
                          <Ionicons name="mail-outline" size={20} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => handleMarkCollected(penalty)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() => {
                            setSelectedPenalty(penalty);
                            setWaiveModalVisible(true);
                          }}
                        >
                          <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {penalty.status === 'deducted' && penalty.deducted_at && (
                      <Text style={styles.penaltyStatusText}>
                        Déduit le {new Intl.DateTimeFormat('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }).format(new Date(penalty.deducted_at))}
                      </Text>
                    )}

                    {penalty.status === 'waived' && penalty.waived_reason && (
                      <Text style={styles.penaltyStatusText} numberOfLines={2}>
                        {penalty.waived_reason}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Waive Modal */}
      <Modal visible={waiveModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Annuler la pénalité</Text>
              <TouchableOpacity onPress={() => setWaiveModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Cette action annulera définitivement la pénalité de{' '}
                {selectedPenalty && formatAmount(selectedPenalty.penalty_amount)}.
              </Text>

              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>Raison de l'annulation *</Text>
                <TextInput
                  style={styles.modalTextArea}
                  placeholder="Expliquez pourquoi cette pénalité est annulée..."
                  value={waiveReason}
                  onChangeText={setWaiveReason}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>Notes admin (optionnel)</Text>
                <TextInput
                  style={styles.modalTextArea}
                  placeholder="Notes internes..."
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setWaiveModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  (saving || !waiveReason.trim()) && styles.modalButtonDisabled,
                ]}
                onPress={handleWaive}
                disabled={saving || !waiveReason.trim()}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Confirmer l'annulation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  actionsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    flex: 1,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  refreshButton: {
    padding: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: '#666',
  },
  filtersContainer: {
    padding: 16,
    gap: 12,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  penaltiesList: {
    padding: 16,
    gap: 16,
  },
  penaltyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  penaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  penaltyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  penaltyDate: {
    fontSize: 14,
    color: '#666',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  penaltyContent: {
    padding: 16,
    gap: 12,
  },
  penaltyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  penaltyInfoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  penaltyInfoSubtext: {
    fontSize: 12,
    color: '#666',
  },
  penaltyAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  penaltyAmountLabel: {
    fontSize: 14,
    color: '#666',
  },
  penaltyAmountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionIconButton: {
    padding: 8,
  },
  penaltyStatusText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    backgroundColor: '#e67e22',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdminPenaltiesScreen;

