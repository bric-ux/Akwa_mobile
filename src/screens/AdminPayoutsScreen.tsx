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
import { useAuth } from '../services/AuthContext';
import { formatPrice } from '../utils/priceCalculator';
import { calculateHostNetAmount } from '../lib/hostNetAmount';

interface PropertyPayout {
  id: string;
  booking_id: string;
  host_id: string;
  total_amount: number;
  commission_amount: number;
  host_amount: number;
  admin_payment_status: 'pending' | 'paid';
  admin_paid_at: string | null;
  scheduled_for: string;
  created_at: string;
  booking: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    discount_amount: number;
    status: string;
    host_net_amount: number | null;
    properties: {
      id: string;
      title: string;
      price_per_night: number;
      cleaning_fee: number;
      taxes: number;
      free_cleaning_min_days: number | null;
    };
    guest_profile: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
    host_profile: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
    payment: {
      id: string;
      amount: number;
      payment_method: string;
      status: string;
      paid_at: string | null;
    };
  };
}

interface VehiclePayout {
  id: string;
  booking_id: string;
  owner_id: string;
  total_amount: number;
  commission_amount: number;
  owner_amount: number;
  admin_payment_status: 'pending' | 'paid';
  admin_paid_at: string | null;
  scheduled_for: string;
  created_at: string;
  booking: {
    id: string;
    start_date: string;
    end_date: string;
    rental_days: number;
    daily_rate: number;
    total_price: number;
    discount_amount: number;
    status: string;
    host_net_amount: number | null;
    vehicles: {
      id: string;
      title: string;
      brand: string;
      model: string;
      price_per_day: number;
    };
    renter_profile: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
    owner_profile: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
  };
}

type PayoutItem = (PropertyPayout & { type: 'property' }) | (VehiclePayout & { type: 'vehicle' });

const AdminPayoutsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'property' | 'vehicle'>('all');
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, [statusFilter, typeFilter]);

  const isEligibleForPayment = (payout: PayoutItem): boolean => {
    const now = new Date();
    const scheduledDate = new Date(payout.scheduled_for);
    return now >= scheduledDate;
  };

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const allPayouts: PayoutItem[] = [];

      // Charger les payouts de propriétés
      if (typeFilter === 'all' || typeFilter === 'property') {
        // D'abord, vérifier combien de payouts existent au total
        // Essayer avec une requête simple d'abord
        const { count: totalPayoutsCount, error: countError } = await supabase
          .from('host_payouts')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.error('❌ [AdminPayouts] Erreur comptage payouts:', countError);
          console.error('❌ [AdminPayouts] Détails erreur comptage:', JSON.stringify(countError, null, 2));
        } else {
          console.log('📊 [AdminPayouts] Total payouts propriétés dans la DB:', totalPayoutsCount || 0);
        }
        
        // Vérifier aussi avec une requête qui récupère les IDs seulement
        const { data: payoutIds, error: idsError } = await supabase
          .from('host_payouts')
          .select('id, booking_id, admin_payment_status')
          .limit(5);
        
        if (idsError) {
          console.error('❌ [AdminPayouts] Erreur récupération IDs payouts:', idsError);
        } else {
          console.log('📊 [AdminPayouts] Exemples de payouts (IDs seulement):', payoutIds?.length || 0);
          if (payoutIds && payoutIds.length > 0) {
            console.log('📊 [AdminPayouts] Premier payout ID:', payoutIds[0]);
          }
        }

        // Essayer d'abord une requête simple pour voir si les payouts existent
        let propertyPayoutsQuery = supabase
          .from('host_payouts')
          .select(`
            id,
            booking_id,
            payment_id,
            host_id,
            total_amount,
            commission_amount,
            host_amount,
            admin_payment_status,
            scheduled_for,
            created_at
          `)
          .order('scheduled_for', { ascending: false });

        if (statusFilter === 'pending') {
          propertyPayoutsQuery = propertyPayoutsQuery.eq('admin_payment_status', 'pending');
        } else if (statusFilter === 'paid') {
          propertyPayoutsQuery = propertyPayoutsQuery.eq('admin_payment_status', 'paid');
        }

        const { data: propertyPayouts, error: propertyError } = await propertyPayoutsQuery;
        
        // Si on a des payouts, enrichir avec les relations séparément
        if (propertyPayouts && propertyPayouts.length > 0) {
          console.log('📊 [AdminPayouts] Payouts trouvés (sans relations):', propertyPayouts.length);
          
          // Enrichir chaque payout avec les données de booking et payment
          const enrichedPayouts = await Promise.all(
            propertyPayouts.map(async (payout: any) => {
              // Récupérer le booking
              const { data: booking } = await supabase
                .from('bookings')
                .select(`
                  id,
                  check_in_date,
                  check_out_date,
                  total_price,
                  discount_amount,
                  status,
                  host_net_amount,
                  guest_id,
                  properties:properties(
                    id,
                    title,
                    price_per_night,
                    cleaning_fee,
                    taxes,
                    free_cleaning_min_days,
                    host_id
                  )
                `)
                .eq('id', payout.booking_id)
                .single();
              
              // Récupérer le payment
              const { data: payment } = await supabase
                .from('payments')
                .select('id, amount, payment_method, status, paid_at')
                .eq('id', payout.payment_id)
                .single();
              
              // Récupérer les profils
              const [guestRes, hostRes] = await Promise.all([
                booking?.guest_id ? supabase
                  .from('profiles')
                  .select('user_id, first_name, last_name, email, phone')
                  .eq('user_id', booking.guest_id)
                  .maybeSingle() : Promise.resolve({ data: null }),
                supabase
                  .from('profiles')
                  .select('user_id, first_name, last_name, email, phone')
                  .eq('user_id', payout.host_id)
                  .maybeSingle(),
              ]);
              
              return {
                ...payout,
                booking: booking ? {
                  ...booking,
                  guest_profile: guestRes.data,
                  host_profile: hostRes.data,
                  payment: payment,
                } : null,
                type: 'property' as const,
              };
            })
          );
          
          // Remplacer propertyPayouts par les payouts enrichis
          propertyPayouts.length = 0;
          propertyPayouts.push(...enrichedPayouts);
        }

        if (propertyError) {
          console.error('❌ Erreur chargement payouts propriétés:', propertyError);
          console.error('❌ Détails erreur:', JSON.stringify(propertyError, null, 2));
          
          // Essayer une requête simplifiée pour diagnostiquer
          const { data: simplePayouts, error: simpleError } = await supabase
            .from('host_payouts')
            .select('*')
            .limit(5);
          
          if (simpleError) {
            console.error('❌ Erreur même avec requête simple:', simpleError);
          } else {
            console.log('📊 [AdminPayouts] Payouts trouvés avec requête simple:', simplePayouts?.length || 0);
          }
        } else {
          console.log('📊 [AdminPayouts] Payouts propriétés trouvés (après enrichissement):', propertyPayouts?.length || 0);
          if (propertyPayouts && propertyPayouts.length > 0) {
            console.log('📊 [AdminPayouts] Premier payout enrichi:', JSON.stringify(propertyPayouts[0], null, 2));
            
            // Ajouter les payouts enrichis à la liste
            propertyPayouts.forEach((payout) => {
              allPayouts.push(payout);
            });
          }
        }
      }

      // Charger les payouts de véhicules
      if (typeFilter === 'all' || typeFilter === 'vehicle') {
        let vehiclePayoutsQuery = supabase
          .from('vehicle_payouts')
          .select(`
            *,
            booking:vehicle_bookings(
              id,
              start_date,
              end_date,
              rental_days,
              daily_rate,
              total_price,
              discount_amount,
              status,
              host_net_amount,
              renter_id,
              vehicles:vehicles(
                id,
                title,
                brand,
                model,
                price_per_day,
                owner_id
              )
            )
          `)
          .order('scheduled_for', { ascending: false });

        if (statusFilter === 'pending') {
          vehiclePayoutsQuery = vehiclePayoutsQuery.eq('admin_payment_status', 'pending');
        } else if (statusFilter === 'paid') {
          vehiclePayoutsQuery = vehiclePayoutsQuery.eq('admin_payment_status', 'paid');
        }

        const { data: vehiclePayouts, error: vehicleError } = await vehiclePayoutsQuery;

        if (vehicleError) {
          console.error('Erreur chargement payouts véhicules:', vehicleError);
        } else {
          console.log('📊 [AdminPayouts] Payouts véhicules trouvés:', vehiclePayouts?.length || 0);
          if (vehiclePayouts && vehiclePayouts.length > 0) {
            // Enrichir avec les profils (requêtes séparées)
            const enrichedVehiclePayouts = await Promise.all(
              vehiclePayouts.map(async (payout: any) => {
                const [renterRes, ownerRes] = await Promise.all([
                  supabase
                    .from('profiles')
                    .select('user_id, first_name, last_name, email, phone')
                    .eq('user_id', payout.booking?.renter_id)
                    .maybeSingle(),
                  supabase
                    .from('profiles')
                    .select('user_id, first_name, last_name, email, phone')
                    .eq('user_id', payout.booking?.vehicles?.owner_id)
                    .maybeSingle(),
                ]);

                return {
                  ...payout,
                  booking: {
                    ...payout.booking,
                    renter_profile: renterRes.data,
                    owner_profile: ownerRes.data,
                  },
                  type: 'vehicle' as const,
                };
              })
            );

            enrichedVehiclePayouts.forEach((payout) => {
              allPayouts.push(payout);
            });
          }
        }
      }

      // Trier par date prévue (plus récent en premier)
      allPayouts.sort((a, b) => 
        new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()
      );

      setPayouts(allPayouts);
    } catch (error) {
      console.error('Erreur chargement payouts:', error);
      Alert.alert('Erreur', 'Impossible de charger les paiements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayouts();
  };

  const handleMarkAsPaid = async (payout: PayoutItem) => {
    if (!user) return;

    Alert.alert(
      'Confirmer le paiement',
      `Voulez-vous marquer ce paiement de ${formatPrice(payout.type === 'property' ? payout.host_amount : payout.owner_amount)} comme effectué ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'default',
          onPress: async () => {
            setProcessingPayment(true);
            try {
              const tableName = payout.type === 'property' ? 'host_payouts' : 'vehicle_payouts';
              const { error } = await supabase
                .from(tableName)
                .update({
                  admin_payment_status: 'paid',
                  admin_paid_at: new Date().toISOString(),
                  admin_paid_by: user.id,
                })
                .eq('id', payout.id);

              if (error) {
                throw error;
              }

              Alert.alert('Succès', 'Paiement marqué comme effectué');
              await loadPayouts();
              setDetailsModalVisible(false);
            } catch (error: any) {
              console.error('Erreur marquage paiement:', error);
              Alert.alert('Erreur', error.message || 'Impossible de marquer le paiement');
            } finally {
              setProcessingPayment(false);
            }
          },
        },
      ]
    );
  };

  const handleSendAkwaHomeInvoice = async (payout: PayoutItem) => {
    if (!user) return;

    setProcessingPayment(true);
    try {
      const title = payout.type === 'property' 
        ? payout.booking.properties?.title 
        : `${payout.booking.vehicles?.brand} ${payout.booking.vehicles?.model}`;
      
      const dates = payout.type === 'property'
        ? `${formatDate(payout.booking.check_in_date)} - ${formatDate(payout.booking.check_out_date)}`
        : `${formatDate(payout.booking.start_date)} - ${formatDate(payout.booking.end_date)}`;

      const recipientName = payout.type === 'property'
        ? `${payout.booking.host_profile?.first_name || ''} ${payout.booking.host_profile?.last_name || ''}`.trim()
        : `${payout.booking.owner_profile?.first_name || ''} ${payout.booking.owner_profile?.last_name || ''}`.trim();

      // Appeler la fonction send-email pour générer et envoyer le PDF
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'akwahome_revenue_invoice',
          to: user.email || 'admin@akwahome.com',
          data: {
            payoutId: payout.id,
            bookingId: payout.booking_id,
            serviceType: payout.type,
            title: title,
            dates: dates,
            recipientName: recipientName,
            totalAmount: payout.total_amount,
            commissionAmount: payout.commission_amount,
            commissionRate: payout.commission_rate,
            hostAmount: payout.type === 'property' ? payout.host_amount : payout.owner_amount,
            scheduledFor: payout.scheduled_for,
            paidAt: payout.admin_paid_at,
            paymentStatus: payout.admin_payment_status,
          },
        },
      });

      if (emailError) {
        throw emailError;
      }

      Alert.alert(
        'Succès',
        `La facture du gain AkwaHome a été envoyée par email à ${user.email || 'admin@akwahome.com'}.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Erreur envoi facture gain AkwaHome:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'envoyer la facture. Veuillez réessayer.'
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paiement effectué';
      case 'pending':
        return 'En attente';
      default:
        return status;
    }
  };

  const handleViewDetails = (payout: PayoutItem) => {
    setSelectedPayout(payout);
    setDetailsModalVisible(true);
  };

  const calculateRefundInfo = (payout: PayoutItem) => {
    // Vérifier s'il y a des remboursements pour cette réservation
    // Si l'argent n'a pas encore été versé (admin_payment_status = 'pending'), 
    // alors AkwaHome doit rembourser
    const isPaid = payout.admin_payment_status === 'paid';
    return {
      shouldAkwaHomeRefund: !isPaid,
      isPaid,
    };
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paiements hôtes/propriétaires</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  const pendingCount = payouts.filter(p => p.admin_payment_status === 'pending' && isEligibleForPayment(p)).length;
  const paidCount = payouts.filter(p => p.admin_payment_status === 'paid').length;
  const totalPendingAmount = payouts
    .filter(p => p.admin_payment_status === 'pending' && isEligibleForPayment(p))
    .reduce((sum, p) => sum + (p.type === 'property' ? p.host_amount : p.owner_amount), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiements hôtes/propriétaires</Text>
        <TouchableOpacity onPress={loadPayouts} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardPending]}>
            <Ionicons name="time-outline" size={32} color="#f59e0b" />
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={styles.statAmount}>{formatPrice(totalPendingAmount)}</Text>
          </View>
          
          <View style={[styles.statCard, styles.statCardPaid]}>
            <Ionicons name="checkmark-circle-outline" size={32} color="#10b981" />
            <Text style={styles.statValue}>{paidCount}</Text>
            <Text style={styles.statLabel}>Payés</Text>
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <Text style={styles.filterSectionTitle}>Type de service</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('all')}
            >
              <Text style={[styles.filterText, typeFilter === 'all' && styles.filterTextActive]}>
                Tous
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'property' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('property')}
            >
              <Ionicons 
                name="home-outline" 
                size={16} 
                color={typeFilter === 'property' ? '#fff' : '#666'} 
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterText, typeFilter === 'property' && styles.filterTextActive]}>
                Résidences
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'vehicle' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('vehicle')}
            >
              <Ionicons 
                name="car-outline" 
                size={16} 
                color={typeFilter === 'vehicle' ? '#fff' : '#666'} 
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterText, typeFilter === 'vehicle' && styles.filterTextActive]}>
                Véhicules
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={styles.filterSectionTitle}>Statut de paiement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
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
              style={[styles.filterButton, statusFilter === 'paid' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('paid')}
            >
              <Text style={[styles.filterText, statusFilter === 'paid' && styles.filterTextActive]}>
                Payés
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Liste des paiements */}
        <Text style={styles.sectionTitle}>
          Paiements ({payouts.length})
        </Text>

        {payouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucun paiement trouvé</Text>
            <Text style={styles.emptySubtext}>Ajustez les filtres pour voir plus de résultats</Text>
          </View>
        ) : (
          payouts.map((payout) => {
            const statusColor = getStatusColor(payout.admin_payment_status);
            const eligible = isEligibleForPayment(payout);
            const title = payout.type === 'property' 
              ? payout.booking.properties?.title 
              : `${payout.booking.vehicles?.brand} ${payout.booking.vehicles?.model}`;
            const recipientName = payout.type === 'property'
              ? `${payout.booking.host_profile?.first_name || ''} ${payout.booking.host_profile?.last_name || ''}`.trim()
              : `${payout.booking.owner_profile?.first_name || ''} ${payout.booking.owner_profile?.last_name || ''}`.trim();
            const amount = payout.type === 'property' ? payout.host_amount : payout.owner_amount;

            return (
              <TouchableOpacity
                key={payout.id}
                style={styles.payoutCard}
                onPress={() => handleViewDetails(payout)}
              >
                <View style={styles.payoutHeader}>
                  <View style={styles.payoutTitleContainer}>
                    <Ionicons 
                      name={payout.type === 'property' ? 'home-outline' : 'car-outline'} 
                      size={20} 
                      color={payout.type === 'property' ? '#3498db' : '#e67e22'} 
                    />
                    <View style={styles.payoutTitleText}>
                      <Text style={styles.payoutTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.payoutType}>
                        {payout.type === 'property' ? 'Résidence meublée' : 'Location de véhicule'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusLabel(payout.admin_payment_status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.payoutDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color="#666" />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {recipientName}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {payout.type === 'property' 
                        ? `${formatDate(payout.booking.check_in_date)} - ${formatDate(payout.booking.check_out_date)}`
                        : `${formatDate(payout.booking.start_date)} - ${formatDate(payout.booking.end_date)}`
                      }
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="cash-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Montant à verser: <Text style={styles.amountText}>{formatPrice(amount)}</Text>
                    </Text>
                  </View>

                  {payout.admin_payment_status === 'pending' && (
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Éligible: {eligible ? '✅ Oui' : `⏳ ${formatDate(payout.scheduled_for)}`}
                      </Text>
                    </View>
                  )}

                  {payout.admin_paid_at && (
                    <View style={styles.detailRow}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                      <Text style={styles.detailText}>
                        Payé le: {formatDateTime(payout.admin_paid_at)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.viewDetailsButton}>
                  <Text style={styles.viewDetailsText}>Voir les détails</Text>
                  <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
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
              <Text style={styles.modalTitle}>Détails du paiement</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedPayout && (
              <ScrollView style={styles.modalBody}>
                {/* Informations générales */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Informations générales</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Type</Text>
                    <View style={styles.infoValueContainer}>
                      <Ionicons 
                        name={selectedPayout.type === 'property' ? 'home-outline' : 'car-outline'} 
                        size={16} 
                        color={selectedPayout.type === 'property' ? '#3498db' : '#e67e22'} 
                      />
                      <Text style={styles.infoValue}>
                        {selectedPayout.type === 'property' ? 'Résidence meublée' : 'Location de véhicule'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Titre</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property' 
                        ? selectedPayout.booking.properties?.title 
                        : `${selectedPayout.booking.vehicles?.brand} ${selectedPayout.booking.vehicles?.model}`
                      }
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Statut de paiement</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedPayout.admin_payment_status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(selectedPayout.admin_payment_status) }]}>
                        {getStatusLabel(selectedPayout.admin_payment_status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Dates */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Dates</Text>
                  {selectedPayout.type === 'property' ? (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Arrivée</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedPayout.booking.check_in_date)}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Départ</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedPayout.booking.check_out_date)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Début</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedPayout.booking.start_date)}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Fin</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedPayout.booking.end_date)}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date prévue de paiement</Text>
                    <Text style={styles.infoValue}>
                      {formatDate(selectedPayout.scheduled_for)}
                    </Text>
                  </View>
                </View>

                {/* Client/Locataire */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>
                    {selectedPayout.type === 'property' ? 'Voyageur' : 'Locataire'}
                  </Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nom</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property'
                        ? `${selectedPayout.booking.guest_profile?.first_name || ''} ${selectedPayout.booking.guest_profile?.last_name || ''}`.trim()
                        : `${selectedPayout.booking.renter_profile?.first_name || ''} ${selectedPayout.booking.renter_profile?.last_name || ''}`.trim()
                      }
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property'
                        ? selectedPayout.booking.guest_profile?.email || 'N/A'
                        : selectedPayout.booking.renter_profile?.email || 'N/A'
                      }
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Téléphone</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property'
                        ? selectedPayout.booking.guest_profile?.phone || 'N/A'
                        : selectedPayout.booking.renter_profile?.phone || 'N/A'
                      }
                    </Text>
                  </View>
                </View>

                {/* Hôte/Propriétaire */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>
                    {selectedPayout.type === 'property' ? 'Hôte' : 'Propriétaire'}
                  </Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nom</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property'
                        ? `${selectedPayout.booking.host_profile?.first_name || ''} ${selectedPayout.booking.host_profile?.last_name || ''}`.trim()
                        : `${selectedPayout.booking.owner_profile?.first_name || ''} ${selectedPayout.booking.owner_profile?.last_name || ''}`.trim()
                      }
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property'
                        ? selectedPayout.booking.host_profile?.email || 'N/A'
                        : selectedPayout.booking.owner_profile?.email || 'N/A'
                      }
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Téléphone</Text>
                    <Text style={styles.infoValue}>
                      {selectedPayout.type === 'property'
                        ? selectedPayout.booking.host_profile?.phone || 'N/A'
                        : selectedPayout.booking.owner_profile?.phone || 'N/A'
                      }
                    </Text>
                  </View>
                </View>

                {/* Détails financiers - Paiement du client */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Paiement du {selectedPayout.type === 'property' ? 'voyageur' : 'locataire'}</Text>
                  
                  {selectedPayout.type === 'property' ? (
                    <>
                      {(() => {
                        const checkIn = new Date(selectedPayout.booking.check_in_date);
                        const checkOut = new Date(selectedPayout.booking.check_out_date);
                        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                        const pricePerNight = selectedPayout.booking.properties?.price_per_night || 0;
                        const basePrice = pricePerNight * nights;
                        const discountAmount = selectedPayout.booking.discount_amount || 0;
                        const priceAfterDiscount = basePrice - discountAmount;
                        const cleaningFee = selectedPayout.booking.properties?.cleaning_fee || 0;
                        const freeCleaningMinDays = selectedPayout.booking.properties?.free_cleaning_min_days;
                        const effectiveCleaningFee = (freeCleaningMinDays && nights >= freeCleaningMinDays) ? 0 : cleaningFee;
                        const taxesPerNight = selectedPayout.booking.properties?.taxes || 0;
                        const effectiveTaxes = taxesPerNight * nights;
                        const serviceFee = selectedPayout.booking.total_price - priceAfterDiscount - effectiveCleaningFee - effectiveTaxes;
                        const totalPaid = selectedPayout.booking.total_price;

                        return (
                          <>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Prix par nuit</Text>
                              <Text style={styles.infoValue}>{formatPrice(pricePerNight)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Nombre de nuits</Text>
                              <Text style={styles.infoValue}>{nights}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Prix de base</Text>
                              <Text style={styles.infoValue}>{formatPrice(basePrice)}</Text>
                            </View>
                            {discountAmount > 0 && (
                              <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Réduction</Text>
                                <Text style={[styles.infoValue, styles.discountValue]}>-{formatPrice(discountAmount)}</Text>
                              </View>
                            )}
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Prix après réduction</Text>
                              <Text style={styles.infoValue}>{formatPrice(priceAfterDiscount)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Frais de ménage</Text>
                              <Text style={styles.infoValue}>{formatPrice(effectiveCleaningFee)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Taxe de séjour</Text>
                              <Text style={styles.infoValue}>{formatPrice(effectiveTaxes)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Frais de service</Text>
                              <Text style={styles.infoValue}>{formatPrice(serviceFee)}</Text>
                            </View>
                            <View style={[styles.infoRow, styles.totalRow]}>
                              <Text style={styles.infoLabelTotal}>Total payé</Text>
                              <Text style={styles.infoValueTotal}>{formatPrice(totalPaid)}</Text>
                            </View>
                            {selectedPayout.booking.payment && (
                              <>
                                <View style={styles.infoRow}>
                                  <Text style={styles.infoLabel}>Méthode de paiement</Text>
                                  <Text style={styles.infoValue}>
                                    {selectedPayout.booking.payment.payment_method || 'N/A'}
                                  </Text>
                                </View>
                                {selectedPayout.booking.payment.paid_at && (
                                  <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Date de paiement</Text>
                                    <Text style={styles.infoValue}>
                                      {formatDateTime(selectedPayout.booking.payment.paid_at)}
                                    </Text>
                                  </View>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {(() => {
                        // Utiliser les données stockées en priorité
                        const dailyRate = selectedPayout.booking.daily_rate || 0;
                        const rentalDays = selectedPayout.booking.rental_days || 0;
                        const basePrice = dailyRate * rentalDays;
                        const discountAmount = selectedPayout.booking.discount_amount || 0;
                        const priceAfterDiscount = basePrice - discountAmount;
                        // Utiliser total_price stocké (inclut déjà les frais de service)
                        const totalPaid = selectedPayout.booking.total_price || 0;
                        // Calculer les frais de service à partir du total stocké
                        const serviceFee = totalPaid - priceAfterDiscount;

                        return (
                          <>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Tarif journalier</Text>
                              <Text style={styles.infoValue}>{formatPrice(dailyRate)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Nombre de jours</Text>
                              <Text style={styles.infoValue}>{rentalDays}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Prix de base</Text>
                              <Text style={styles.infoValue}>{formatPrice(basePrice)}</Text>
                            </View>
                            {discountAmount > 0 && (
                              <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Réduction</Text>
                                <Text style={[styles.infoValue, styles.discountValue]}>-{formatPrice(discountAmount)}</Text>
                              </View>
                            )}
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Prix après réduction</Text>
                              <Text style={styles.infoValue}>{formatPrice(priceAfterDiscount)}</Text>
                            </View>
                            <View style={styles.infoRow}>
                              <Text style={styles.infoLabel}>Frais de service</Text>
                              <Text style={styles.infoValue}>{formatPrice(serviceFee)}</Text>
                            </View>
                            <View style={[styles.infoRow, styles.totalRow]}>
                              <Text style={styles.infoLabelTotal}>Total payé</Text>
                              <Text style={styles.infoValueTotal}>{formatPrice(totalPaid)}</Text>
                            </View>
                          </>
                        );
                      })()}
                    </>
                  )}
                </View>

                {/* Gain AkwaHome */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Gain AkwaHome</Text>
                  
                  <View style={[styles.revenueDetailsModal, { backgroundColor: '#fef3c7', borderColor: '#f59e0b', borderWidth: 2 }]}>
                    <View style={styles.revenueRow}>
                      <Text style={styles.revenueLabel}>Commission AkwaHome (avec TVA)</Text>
                      <Text style={[styles.revenueAmount, { color: '#f59e0b', fontWeight: 'bold' }]}>
                        {formatPrice(selectedPayout.commission_amount)}
                      </Text>
                    </View>
                    <View style={styles.revenueRow}>
                      <Text style={styles.revenueLabel}>Taux de commission</Text>
                      <Text style={styles.revenueAmount}>
                        {(selectedPayout.commission_rate * 100).toFixed(2)}% HT + 20% TVA = {(selectedPayout.commission_rate * 100 * 1.2).toFixed(2)}% TTC
                      </Text>
                    </View>
                    <View style={[styles.revenueRow, styles.revenueRowTotal]}>
                      <Text style={[styles.revenueLabelTotal, { color: '#92400e' }]}>
                        Gain net AkwaHome
                      </Text>
                      <Text style={[styles.revenueAmountTotal, { color: '#f59e0b' }]}>
                        {formatPrice(selectedPayout.commission_amount)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Détails financiers - Montant à verser */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>
                    Montant à verser à {selectedPayout.type === 'property' ? "l'hôte" : 'le propriétaire'}
                  </Text>
                  
                  <View style={styles.revenueDetailsModal}>
                    <View style={styles.revenueRow}>
                      <Text style={styles.revenueLabel}>Montant total payé</Text>
                      <Text style={styles.revenueAmount}>
                        {formatPrice(selectedPayout.total_amount)}
                      </Text>
                    </View>
                    <View style={styles.revenueRow}>
                      <Text style={styles.revenueLabel}>Commission AkwaHome (avec TVA)</Text>
                      <Text style={styles.revenueAmount}>
                        {formatPrice(selectedPayout.commission_amount)}
                      </Text>
                    </View>
                    <View style={[styles.revenueRow, styles.revenueRowTotal]}>
                      <Text style={styles.revenueLabelTotal}>
                        Montant net à verser
                      </Text>
                      <Text style={styles.revenueAmountTotal}>
                        {formatPrice(selectedPayout.type === 'property' ? selectedPayout.host_amount : selectedPayout.owner_amount)}
                      </Text>
                    </View>
                    {/* Afficher aussi host_net_amount si disponible pour vérification */}
                    {selectedPayout.booking.host_net_amount && (
                      <View style={styles.revenueRow}>
                        <Text style={styles.revenueLabel}>Montant net (depuis booking)</Text>
                        <Text style={styles.revenueAmount}>
                          {formatPrice(selectedPayout.booking.host_net_amount)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Remboursements */}
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Remboursements</Text>
                  {(() => {
                    const refundInfo = calculateRefundInfo(selectedPayout);
                    return (
                      <View style={styles.refundInfoBox}>
                        <Ionicons 
                          name={refundInfo.shouldAkwaHomeRefund ? 'information-circle-outline' : 'checkmark-circle-outline'} 
                          size={24} 
                          color={refundInfo.shouldAkwaHomeRefund ? '#f59e0b' : '#10b981'} 
                        />
                        <Text style={styles.refundInfoText}>
                          {refundInfo.shouldAkwaHomeRefund
                            ? "Si un remboursement est nécessaire, c'est AkwaHome qui doit rembourser car l'argent n'a pas encore été versé."
                            : "Si un remboursement est nécessaire, c'est l'hôte/propriétaire qui doit rembourser car l'argent a déjà été versé."
                          }
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Actions */}
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={styles.sendInvoiceButton}
                    onPress={() => handleSendAkwaHomeInvoice(selectedPayout)}
                    disabled={processingPayment}
                  >
                    <Ionicons name="mail-outline" size={20} color="#fff" />
                    <Text style={styles.sendInvoiceText}>Envoyer facture gain AkwaHome</Text>
                  </TouchableOpacity>
                  
                  {selectedPayout.admin_payment_status === 'pending' && isEligibleForPayment(selectedPayout) && (
                    <TouchableOpacity
                      style={styles.markAsPaidButton}
                      onPress={() => handleMarkAsPaid(selectedPayout)}
                      disabled={processingPayment}
                    >
                      {processingPayment ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.markAsPaidText}>Marquer comme payé</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
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
  refreshButton: {
    padding: 4,
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
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardPending: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  statCardPaid: {
    backgroundColor: '#d1fae5',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  statAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 4,
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
  },
  payoutCard: {
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
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  payoutTitleText: {
    flex: 1,
    marginLeft: 8,
  },
  payoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  payoutType: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  payoutDetails: {
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
    flex: 1,
  },
  amountText: {
    fontWeight: 'bold',
    color: '#2E7D32',
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
    color: '#2E7D32',
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
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  discountValue: {
    color: '#ef4444',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#2E7D32',
    marginTop: 8,
    paddingTop: 12,
  },
  infoLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoValueTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  revenueDetailsModal: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  revenueRowTotal: {
    borderTopWidth: 2,
    borderTopColor: '#2E7D32',
    marginTop: 8,
    paddingTop: 12,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#666',
  },
  revenueAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  revenueLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  revenueAmountTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  refundInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  refundInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 16,
  },
  sendInvoiceButton: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendInvoiceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  markAsPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  markAsPaidText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdminPayoutsScreen;

