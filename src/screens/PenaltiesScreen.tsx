import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { usePenalties } from '../hooks/usePenalties';
import { useRefunds } from '../hooks/useRefunds';
import PenaltyPaymentModal from '../components/PenaltyPaymentModal';
import { formatPrice, formatAmount } from '../utils/priceCalculator';

type TabType = 'penalties' | 'refunds';

const PenaltiesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('penalties');
  const [selectedPenalty, setSelectedPenalty] = useState<any>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Charger les pénalités
  const {
    penalties,
    pendingPenalties,
    totalPendingAmount,
    loading: penaltiesLoading,
    refreshPenalties,
  } = usePenalties(user?.id);

  // Charger les remboursements
  const {
    refunds,
    pendingRefunds,
    completedRefunds,
    totalRefundedAmount,
    totalPendingAmount: totalPendingRefundAmount,
    loading: refundsLoading,
    refreshRefunds,
  } = useRefunds(user?.id);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'penalties') {
      await refreshPenalties();
    } else {
      await refreshRefunds();
    }
    setRefreshing(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const calculateNights = (checkIn?: string, checkOut?: string) => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPenaltyStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#f59e0b', icon: 'time-outline', label: 'En attente' };
      case 'deducted':
        return { color: '#3b82f6', icon: 'checkmark-circle-outline', label: 'Déduite' };
      case 'paid_directly':
        return { color: '#10b981', icon: 'checkmark-circle-outline', label: 'Payée' };
      case 'collected_manually':
        return { color: '#10b981', icon: 'checkmark-circle-outline', label: 'Collectée' };
      case 'waived':
        return { color: '#6b7280', icon: 'close-circle-outline', label: 'Annulée' };
      default:
        return { color: '#666', icon: 'help-circle-outline', label: status };
    }
  };

  const getRefundStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#f59e0b', icon: 'time-outline', label: 'En attente' };
      case 'processing':
        return { color: '#3b82f6', icon: 'sync-outline', label: 'En traitement' };
      case 'completed':
        return { color: '#10b981', icon: 'checkmark-circle-outline', label: 'Complété' };
      case 'failed':
        return { color: '#ef4444', icon: 'close-circle-outline', label: 'Échoué' };
      default:
        return { color: '#666', icon: 'help-circle-outline', label: status };
    }
  };

  const getPenaltyTypeBadge = (type: string) => {
    if (type === 'host_cancellation') {
      return { color: '#ef4444', label: 'Annulation hôte' };
    } else if (type === 'host_ongoing_cancellation') {
      return { color: '#f97316', label: 'Annulation en cours' };
    }
    return { color: '#6b7280', label: 'Annulation voyageur' };
  };

  const openPaymentDialog = (penalty: any) => {
    setSelectedPenalty(penalty);
    setPaymentModalVisible(true);
  };

  const handlePaymentComplete = () => {
    refreshPenalties();
    setPaymentModalVisible(false);
    setSelectedPenalty(null);
  };

  const renderPenaltiesTab = () => {
    const loading = penaltiesLoading;
    const data = penalties;

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats - Pénalités en attente */}
        {pendingPenalties.length > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statsContent}>
              <View style={styles.statsLeft}>
                <Text style={styles.statsLabel}>Pénalités en attente de paiement</Text>
                <Text style={styles.statsAmount}>{formatAmount(totalPendingAmount)}</Text>
                <Text style={styles.statsCount}>
                  {pendingPenalties.length} pénalité{pendingPenalties.length > 1 ? 's' : ''} à régler
                </Text>
              </View>
              <Ionicons name="alert-circle" size={48} color="#f59e0b" />
            </View>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Les pénalités non payées seront automatiquement déduites de vos prochains revenus
                de réservation.
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e67e22" />
          </View>
        ) : data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.emptyTitle}>Aucune pénalité enregistrée</Text>
            <Text style={styles.emptyText}>Continuez à offrir un excellent service !</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {data.map((penalty) => {
              const booking = penalty.booking;
              const nights = calculateNights(booking?.check_in_date, booking?.check_out_date);
              const guestName = booking?.guest
                ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
                : 'Voyageur';
              const statusBadge = getPenaltyStatusBadge(penalty.status);
              const typeBadge = getPenaltyTypeBadge(penalty.penalty_type);

              return (
                <View key={penalty.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name="home-outline" size={20} color="#e67e22" />
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>{booking?.property?.title || 'Réservation'}</Text>
                        {booking?.property?.address && (
                          <View style={styles.addressRow}>
                            <Ionicons name="location-outline" size={12} color="#666" />
                            <Text style={styles.addressText}>{booking.property.address}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.badgesContainer}>
                      <View style={[styles.typeBadge, { backgroundColor: `${typeBadge.color}20` }]}>
                        <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>
                          {typeBadge.label}
                        </Text>
                      </View>
                      <View
                        style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}
                      >
                        <Ionicons name={statusBadge.icon} size={14} color={statusBadge.color} />
                        <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color="#666" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Période</Text>
                          <Text style={styles.detailValue}>
                            {formatDate(booking?.check_in_date)} - {formatDate(booking?.check_out_date)}
                          </Text>
                          <Text style={styles.detailSubtext}>
                            {nights} nuit{nights > 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="people-outline" size={16} color="#666" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Voyageur</Text>
                          <Text style={styles.detailValue}>{guestName}</Text>
                          {booking?.guests_count && (
                            <Text style={styles.detailSubtext}>
                              {booking.guests_count} personne{booking.guests_count > 1 ? 's' : ''}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="cash-outline" size={16} color="#666" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Prix réservation</Text>
                          <Text style={styles.detailValue}>
                            {formatPrice(booking?.total_price || 0)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="alert-circle-outline" size={16} color="#f59e0b" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Pénalité à payer</Text>
                          <Text style={[styles.detailValue, styles.penaltyAmount]}>
                            {formatAmount(penalty.penalty_amount)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {booking?.cancellation_reason && (
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Raison de l'annulation</Text>
                        <Text style={styles.infoText}>{booking.cancellation_reason}</Text>
                      </View>
                    )}

                    {penalty.status === 'waived' && penalty.waived_reason && (
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Raison de l'annulation de pénalité</Text>
                        <Text style={styles.infoText}>{penalty.waived_reason}</Text>
                      </View>
                    )}

                    {penalty.status === 'deducted' && penalty.deducted_at && (
                      <View style={[styles.infoBox, { backgroundColor: '#dbeafe' }]}>
                        <Text style={[styles.infoText, { color: '#1e40af' }]}>
                          Pénalité déduite de vos revenus le {formatDate(penalty.deducted_at)}
                        </Text>
                      </View>
                    )}

                    {penalty.status === 'paid_directly' && (
                      <View style={[styles.infoBox, { backgroundColor: '#d1fae5' }]}>
                        <View style={styles.successRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          <Text style={[styles.infoText, { color: '#065f46' }]}>
                            Paiement effectué avec succès
                          </Text>
                        </View>
                      </View>
                    )}

                    {penalty.status === 'pending' && (
                      <View style={styles.paymentSection}>
                        <Text style={styles.paymentHint}>
                          Réglez cette pénalité maintenant pour éviter qu'elle soit déduite de vos
                          prochains revenus.
                        </Text>
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => openPaymentDialog(penalty)}
                        >
                          <Ionicons name="card-outline" size={20} color="#fff" />
                          <Text style={styles.payButtonText}>
                            Payer {formatAmount(penalty.penalty_amount)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderRefundsTab = () => {
    const loading = refundsLoading;
    const data = refunds;

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Info sur les remboursements */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="cash" size={24} color="#10b981" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Comment fonctionnent les remboursements ?</Text>
            <Text style={styles.infoText}>
              Lorsqu'un voyageur annule sa réservation, le montant du remboursement dépend de la
              politique d'annulation de votre propriété :
            </Text>
            <View style={styles.policyList}>
              <View style={styles.policyItem}>
                <View style={[styles.policyDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.policyText}>
                  <Text style={styles.policyBold}>Flexible :</Text> 100% remboursé si annulation 1
                  jour avant, 50% sinon
                </Text>
              </View>
              <View style={styles.policyItem}>
                <View style={[styles.policyDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.policyText}>
                  <Text style={styles.policyBold}>Modérée :</Text> 100% remboursé si annulation 5
                  jours avant, 50% sinon
                </Text>
              </View>
              <View style={styles.policyItem}>
                <View style={[styles.policyDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.policyText}>
                  <Text style={styles.policyBold}>Stricte :</Text> 50% remboursé si annulation 7
                  jours avant, 0% sinon
                </Text>
              </View>
            </View>
            <Text style={styles.infoHint}>
              Les remboursements sont traités automatiquement selon ces politiques.
            </Text>
          </View>
        </View>

        {/* Stats */}
        {(completedRefunds.length > 0 || pendingRefunds.length > 0) && (
          <View style={styles.statsRow}>
            {completedRefunds.length > 0 && (
              <View style={[styles.statCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                <Text style={styles.statValue}>{formatPrice(totalRefundedAmount)}</Text>
                <Text style={styles.statLabel}>Remboursés</Text>
              </View>
            )}
            {pendingRefunds.length > 0 && (
              <View style={[styles.statCard, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                <Ionicons name="time-outline" size={24} color="#f59e0b" />
                <Text style={styles.statValue}>{formatPrice(totalPendingRefundAmount)}</Text>
                <Text style={styles.statLabel}>En attente</Text>
              </View>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e67e22" />
          </View>
        ) : data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={64} color="#10b981" />
            <Text style={styles.emptyTitle}>Aucun remboursement enregistré</Text>
            <Text style={styles.emptyText}>
              Les remboursements apparaîtront ici lorsqu'un voyageur annule une réservation.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {data.map((refund) => {
              const booking = refund.booking;
              const nights = calculateNights(booking?.check_in_date, booking?.check_out_date);
              const guestName = booking?.guest
                ? `${booking.guest.first_name || ''} ${booking.guest.last_name || ''}`.trim()
                : 'Voyageur';
              const statusBadge = getRefundStatusBadge(refund.status);

              return (
                <View key={refund.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name="home-outline" size={20} color="#10b981" />
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>{booking?.property?.title || 'Réservation'}</Text>
                        {booking?.property?.address && (
                          <View style={styles.addressRow}>
                            <Ionicons name="location-outline" size={12} color="#666" />
                            <Text style={styles.addressText}>{booking.property.address}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.badgesContainer}>
                      <View
                        style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}
                      >
                        <Ionicons name={statusBadge.icon} size={14} color={statusBadge.color} />
                        <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                      {refund.refund_type === 'full' ? (
                        <View style={[styles.typeBadge, { backgroundColor: '#10b98120' }]}>
                          <Text style={[styles.typeBadgeText, { color: '#10b981' }]}>Complet</Text>
                        </View>
                      ) : (
                        <View style={[styles.typeBadge, { backgroundColor: '#f59e0b20' }]}>
                          <Text style={[styles.typeBadgeText, { color: '#f59e0b' }]}>Partiel</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color="#666" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Période</Text>
                          <Text style={styles.detailValue}>
                            {formatDate(booking?.check_in_date)} - {formatDate(booking?.check_out_date)}
                          </Text>
                          <Text style={styles.detailSubtext}>
                            {nights} nuit{nights > 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="people-outline" size={16} color="#666" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Voyageur</Text>
                          <Text style={styles.detailValue}>{guestName}</Text>
                          {booking?.guests_count && (
                            <Text style={styles.detailSubtext}>
                              {booking.guests_count} personne{booking.guests_count > 1 ? 's' : ''}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="cash-outline" size={16} color="#666" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Prix réservation</Text>
                          <Text style={styles.detailValue}>
                            {formatPrice(booking?.total_price || 0)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="cash" size={16} color="#10b981" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Montant remboursé</Text>
                          <Text style={[styles.detailValue, styles.refundAmount]}>
                            {formatPrice(refund.amount)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {refund.reason && (
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Raison du remboursement</Text>
                        <Text style={styles.infoText}>{refund.reason}</Text>
                      </View>
                    )}

                    {booking?.cancellation_reason && (
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Raison de l'annulation</Text>
                        <Text style={styles.infoText}>{booking.cancellation_reason}</Text>
                      </View>
                    )}

                    {refund.status === 'completed' && refund.processed_at && (
                      <View style={[styles.infoBox, { backgroundColor: '#d1fae5' }]}>
                        <View style={styles.successRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          <Text style={[styles.infoText, { color: '#065f46' }]}>
                            Remboursement complété le {formatDate(refund.processed_at)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {refund.status === 'processing' && (
                      <View style={[styles.infoBox, { backgroundColor: '#dbeafe' }]}>
                        <View style={styles.successRow}>
                          <Ionicons name="sync-outline" size={16} color="#3b82f6" />
                          <Text style={[styles.infoText, { color: '#1e40af' }]}>
                            Remboursement en cours de traitement
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Remboursements & Pénalités</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'penalties' && styles.tabActive]}
          onPress={() => setActiveTab('penalties')}
        >
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={activeTab === 'penalties' ? '#e67e22' : '#666'}
          />
          <Text
            style={[styles.tabText, activeTab === 'penalties' && styles.tabTextActive]}
          >
            Pénalités
            {pendingPenalties.length > 0 && (
              <Text style={styles.tabBadge}> ({pendingPenalties.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'refunds' && styles.tabActive]}
          onPress={() => setActiveTab('refunds')}
        >
          <Ionicons
            name="cash-outline"
            size={20}
            color={activeTab === 'refunds' ? '#e67e22' : '#666'}
          />
          <Text
            style={[styles.tabText, activeTab === 'refunds' && styles.tabTextActive]}
          >
            Remboursements
            {pendingRefunds.length > 0 && (
              <Text style={styles.tabBadge}> ({pendingRefunds.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'penalties' ? renderPenaltiesTab() : renderRefundsTab()}

      {/* Modal de paiement */}
      <PenaltyPaymentModal
        visible={paymentModalVisible}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedPenalty(null);
        }}
        penalty={selectedPenalty}
        onPaymentComplete={handlePaymentComplete}
      />
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
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#e67e22',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#e67e22',
    fontWeight: '600',
  },
  tabBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  statsCard: {
    margin: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsLeft: {
    flex: 1,
  },
  statsLabel: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 4,
  },
  statsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 4,
  },
  statsCount: {
    fontSize: 14,
    color: '#92400e',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  infoCard: {
    margin: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#047857',
    marginBottom: 12,
    lineHeight: 20,
  },
  policyList: {
    gap: 12,
    marginBottom: 12,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  policyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  policyText: {
    flex: 1,
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  policyBold: {
    fontWeight: '600',
  },
  infoHint: {
    fontSize: 12,
    color: '#059669',
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 12,
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
  cardContent: {
    padding: 16,
  },
  detailsGrid: {
    gap: 16,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  detailSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  penaltyAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  refundAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paymentHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PenaltiesScreen;
