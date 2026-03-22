import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { usePenalties } from '../hooks/usePenalties';
import { useCommissions } from '../hooks/useCommissions';
import { useHostRefunds } from '../hooks/useHostRefunds';
import PenaltyPaymentModal from '../components/PenaltyPaymentModal';
import CommissionPaymentModal from '../components/CommissionPaymentModal';
import HostRefundPaymentModal from '../components/HostRefundPaymentModal';
import { useCurrency } from '../hooks/useCurrency';

type TabType = 'penalties' | 'commissions';

const PenaltiesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabType>('penalties');
  const [selectedPenalty, setSelectedPenalty] = useState<any>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<any>(null);
  const [commissionModalVisible, setCommissionModalVisible] = useState(false);
  const [selectedHostRefund, setSelectedHostRefund] = useState<any>(null);
  const [hostRefundModalVisible, setHostRefundModalVisible] = useState(false);

  // Charger les commissions (réservations espèces)
  const {
    commissions,
    pendingCommissions,
    totalCommissionDue,
    paymentInfo: commissionPaymentInfo,
    loading: commissionsLoading,
    refreshCommissions,
  } = useCommissions(user?.id);

  // Charger les remboursements à reverser (annulations hôte)
  const {
    refunds: hostRefunds,
    pendingRefunds: pendingHostRefunds,
    totalRefundDue,
    loading: hostRefundsLoading,
    refreshRefunds: refreshHostRefunds,
  } = useHostRefunds(user?.id);

  // Charger les pénalités
  const {
    penalties,
    pendingPenalties,
    totalPendingAmount,
    loading: penaltiesLoading,
    refreshPenalties,
  } = usePenalties(user?.id);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'penalties') {
      await refreshPenalties();
    } else {
      await Promise.all([refreshCommissions(), refreshHostRefunds()]);
    }
    setRefreshing(false);
  };

  // Au retour de Stripe (deep link commission), rafraîchir les commissions pour mettre à jour le statut (comme pour les réservations)
  const checkCommissionReturnUrl = useCallback((url: string | null) => {
    if (!url?.includes('payment-success')) return;
    const typeMatch = url.match(/payment_type=([^&]+)/);
    if (typeMatch?.[1] === 'platform_commission') {
      refreshCommissions();
    } else if (typeMatch?.[1] === 'host_refund') {
      refreshHostRefunds();
    }
  }, [refreshCommissions, refreshHostRefunds]);

  useFocusEffect(
    useCallback(() => {
      Linking.getInitialURL().then(checkCommissionReturnUrl);
    }, [checkCommissionReturnUrl])
  );

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => checkCommissionReturnUrl(url));
    return () => sub.remove();
  }, [checkCommissionReturnUrl]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        Linking.getInitialURL().then(checkCommissionReturnUrl);
      }
    });
    return () => sub.remove();
  }, [checkCommissionReturnUrl]);

  const getPaymentMethodLabel = (method?: string | null): string => {
    if (!method) return 'Non spécifié';
    const labels: Record<string, string> = {
      card: 'Carte bancaire',
      bank_transfer: 'Virement bancaire',
      wave: 'Wave',
      cash: 'Espèces',
      orange_money: 'Orange Money',
      mtn_money: 'MTN Money',
      moov_money: 'Moov Money',
      mobile_money: 'Mobile Money',
      paypal: 'PayPal',
    };
    return labels[method] || method;
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

  /** L'hôte/propriétaire reçoit l'argent 48h après le début de la réservation. */
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

  const handleCommissionPaymentComplete = () => {
    refreshCommissions();
    setCommissionModalVisible(false);
    setSelectedCommission(null);
  };

  const renderCommissionsTab = () => {
    const loading = commissionsLoading || hostRefundsLoading;
    const hasCommissions = commissions.length > 0;
    const hasHostRefunds = hostRefunds.length > 0;
    const hasAny = hasCommissions || hasHostRefunds;

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="wallet-outline" size={24} color="#10b981" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Remboursements à régler</Text>
            <Text style={styles.infoText}>
              Commissions espèces : reversez la commission AkwaHome (Wave ou carte).
              Remboursements annulation : après annulation, reversez le montant net à AkwaHome.
            </Text>
          </View>
        </View>

        {(commissionPaymentInfo?.wave_phone || commissionPaymentInfo?.rib_iban) && (
          <View style={[styles.statsCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={[styles.statsLabel, { color: '#065f46' }]}>Coordonnées AkwaHome</Text>
            {commissionPaymentInfo.wave_phone && (
              <Text style={[styles.detailValue, { color: '#047857', marginBottom: 4 }]} selectable>
                Wave : {commissionPaymentInfo.wave_phone}
              </Text>
            )}
            {commissionPaymentInfo.rib_iban && (
              <Text style={[styles.detailValue, { color: '#047857' }]} selectable>
                RIB : {commissionPaymentInfo.rib_iban}
              </Text>
            )}
          </View>
        )}

        {(pendingCommissions.length > 0 || pendingHostRefunds.length > 0) && (
          <View style={styles.statsCard}>
            <View style={styles.statsContent}>
              <View style={styles.statsLeft}>
                <Text style={styles.statsLabel}>Total à régler</Text>
                <Text style={styles.statsAmount}>{formatPrice(totalCommissionDue + totalRefundDue)}</Text>
                <Text style={styles.statsCount}>
                  {pendingCommissions.length + pendingHostRefunds.length} élément{(pendingCommissions.length + pendingHostRefunds.length) > 1 ? 's' : ''} à régler
                </Text>
              </View>
              <Ionicons name="wallet-outline" size={48} color="#f59e0b" />
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e67e22" />
          </View>
        ) : !hasAny ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.emptyTitle}>Aucun remboursement à régler</Text>
            <Text style={styles.emptyText}>
              Commissions espèces et remboursements annulation apparaîtront ici.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {commissions.map((commission) => {
              const statusBadge =
                commission.status === 'paid'
                  ? { color: '#10b981', icon: 'checkmark-circle-outline' as const, label: 'Payée' }
                  : { color: '#f59e0b', icon: 'time-outline' as const, label: 'À régler' };
              return (
                <View key={commission.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons
                        name={commission.booking_type === 'vehicle' ? 'car-outline' : 'home-outline'}
                        size={20}
                        color={commission.booking_type === 'vehicle' ? '#3b82f6' : '#e67e22'}
                      />
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>
                          {commission.label || (commission.booking_type === 'vehicle' ? 'Location véhicule' : 'Résidence')}
                        </Text>
                        <Text style={[styles.detailValue, { marginTop: 4 }]}>
                          Commission : {formatPrice(commission.amount_due)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}>
                      <Ionicons name={statusBadge.icon} size={14} color={statusBadge.color} />
                      <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
                    </View>
                  </View>
                  {commission.status === 'pending' && (
                    <View style={styles.cardContent}>
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => {
                          setSelectedCommission(commission);
                          setCommissionModalVisible(true);
                        }}
                      >
                        <Ionicons name="card-outline" size={20} color="#fff" />
                        <Text style={styles.payButtonText}>Régler la commission</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
            {hostRefunds.map((refund) => {
              const statusBadge =
                refund.status === 'paid'
                  ? { color: '#10b981', icon: 'checkmark-circle-outline' as const, label: 'Payé' }
                  : { color: '#f59e0b', icon: 'time-outline' as const, label: 'À régler' };
              return (
                <View key={refund.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons
                        name={refund.booking_type === 'vehicle' ? 'car-outline' : 'home-outline'}
                        size={20}
                        color={refund.booking_type === 'vehicle' ? '#3b82f6' : '#e67e22'}
                      />
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>
                          Remboursement annulation — {refund.label || (refund.booking_type === 'vehicle' ? 'Location véhicule' : 'Résidence')}
                        </Text>
                        <Text style={[styles.detailValue, { marginTop: 4 }]}>
                          Montant à reverser : {formatPrice(refund.amount_due)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}>
                      <Ionicons name={statusBadge.icon} size={14} color={statusBadge.color} />
                      <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
                    </View>
                  </View>
                  {refund.status === 'pending' && (
                    <View style={styles.cardContent}>
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={() => {
                          setSelectedHostRefund(refund);
                          setHostRefundModalVisible(true);
                        }}
                      >
                        <Ionicons name="card-outline" size={20} color="#fff" />
                        <Text style={styles.payButtonText}>Régler le remboursement</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
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
                <Text style={styles.statsAmount}>{formatPrice(totalPendingAmount)}</Text>
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
                            {formatPrice(booking?.total_price ?? 0)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailItem}>
                        <Ionicons name="alert-circle-outline" size={16} color="#f59e0b" />
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Pénalité à payer</Text>
                          <Text style={[styles.detailValue, styles.penaltyAmount]}>
                            {formatPrice(penalty.penalty_amount)}
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
                          {(penalty.penalty_type === 'host_cancellation' || penalty.penalty_type === 'host_ongoing_cancellation')
                            ? "Réglez cette pénalité maintenant (carte ou Wave) ou elle sera déduite de vos prochains revenus."
                            : "Réglez cette pénalité maintenant pour éviter qu'elle soit déduite de vos prochains revenus."}
                        </Text>
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => openPaymentDialog(penalty)}
                        >
                          <Ionicons name="card-outline" size={20} color="#fff" />
                          <Text style={styles.payButtonText}>
                            Payer {formatPrice(penalty.penalty_amount)}
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
            numberOfLines={1}
          >
            Pénalités
            {pendingPenalties.length > 0 && (
              <Text style={styles.tabBadge}> ({pendingPenalties.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'commissions' && styles.tabActive]}
          onPress={() => setActiveTab('commissions')}
        >
          <Ionicons
            name="wallet-outline"
            size={20}
            color={activeTab === 'commissions' ? '#e67e22' : '#666'}
          />
          <Text
            style={[styles.tabText, activeTab === 'commissions' && styles.tabTextActive]}
            numberOfLines={1}
          >
            Remboursements
            {(pendingCommissions.length > 0 || pendingHostRefunds.length > 0) && (
              <Text style={styles.tabBadge}> ({pendingCommissions.length + pendingHostRefunds.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'penalties' && renderPenaltiesTab()}
      {activeTab === 'commissions' && renderCommissionsTab()}

      {/* Modal de paiement pénalité */}
      <PenaltyPaymentModal
        visible={paymentModalVisible}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedPenalty(null);
        }}
        penalty={selectedPenalty}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* Modal paiement commission */}
      <CommissionPaymentModal
        visible={commissionModalVisible}
        onClose={() => {
          setCommissionModalVisible(false);
          setSelectedCommission(null);
          refreshCommissions();
        }}
        commission={selectedCommission}
        paymentInfo={commissionPaymentInfo}
        onPaymentComplete={handleCommissionPaymentComplete}
      />

      {/* Modal paiement remboursement annulation */}
      <HostRefundPaymentModal
        visible={hostRefundModalVisible}
        onClose={() => {
          setHostRefundModalVisible(false);
          setSelectedHostRefund(null);
          refreshHostRefunds();
        }}
        refund={selectedHostRefund}
        paymentInfo={commissionPaymentInfo}
        onPaymentComplete={() => {
          refreshHostRefunds();
          setHostRefundModalVisible(false);
          setSelectedHostRefund(null);
        }}
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
  contactGuestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  contactGuestLink: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  declareRefundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  declareRefundButtonDisabled: {
    opacity: 0.7,
  },
  declareRefundButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  paymentAtCancelInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  paymentAtCancelText: {
    flex: 1,
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
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
