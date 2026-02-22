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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMonthlyRentalSubscription } from '../hooks/useMonthlyRentalSubscription';
import { useMyProperties } from '../hooks/useMyProperties';
import { supabase } from '../services/supabase';
import { HOST_COLORS } from '../constants/colors';
import { formatPrice } from '../utils/priceCalculator';

const DEFAULT_MONTHLY_PRICE_FCFA = 5000;

const HostSubscriptionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    subscriptions,
    activeSubscriptions,
    loading,
    error,
    refetch,
    activeCount,
    hasActiveSubscriptionForProperty,
  } = useMonthlyRentalSubscription(user?.id);
  const { getMyProperties } = useMyProperties();
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [myProperties, setMyProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  const loadMyProperties = async () => {
    if (!user) return;
    setLoadingProperties(true);
    try {
      const list = await getMyProperties();
      setMyProperties(list);
    } finally {
      setLoadingProperties(false);
    }
  };

  const onSubscribePress = () => {
    loadMyProperties();
    setShowPropertyModal(true);
  };

  const subscribeForProperty = async (propertyId: string) => {
    if (!user) return;
    setSubscribingId(propertyId);
    try {
      const start = new Date();
      const next = new Date(start);
      next.setMonth(next.getMonth() + 1);
      const { error: err } = await supabase.from('monthly_rental_subscriptions').insert({
        host_id: user.id,
        property_id: propertyId,
        status: 'active',
        plan_type: 'single',
        monthly_price: DEFAULT_MONTHLY_PRICE_FCFA,
        start_date: start.toISOString(),
        next_billing_date: next.toISOString(),
        auto_renew: true,
      });
      if (err) throw err;
      setShowPropertyModal(false);
      refetch();
      Alert.alert('Succès', 'Abonnement activé pour ce bien. Vous pouvez maintenant l’ proposer en location mensuelle dans "Modifier l\'annonce".');
      navigation.navigate('EditProperty' as never, { propertyId });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de créer l\'abonnement. Vérifiez que la migration a été exécutée.');
    } finally {
      setSubscribingId(null);
    }
  };

  const statusLabel: Record<string, string> = {
    active: 'Actif',
    suspended: 'Suspendu',
    expired: 'Expiré',
    cancelled: 'Annulé',
  };

  const statusColor: Record<string, string> = {
    active: '#10b981',
    suspended: '#f59e0b',
    expired: '#6b7280',
    cancelled: '#ef4444',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonnement location mensuelle</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} colors={[HOST_COLORS.primary]} />
        }
      >
        <View style={styles.introCard}>
          <Ionicons name="calendar-outline" size={40} color={HOST_COLORS.primary} />
          <Text style={styles.introTitle}>Publier des annonces longue durée</Text>
          <Text style={styles.introText}>
            Avec l'abonnement, vous pouvez proposer vos biens en location mensuelle. Chaque bien
            publié en "location mensuelle" nécessite un abonnement actif pour ce bien.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={20} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Mes abonnements ({activeCount} actif{activeCount !== 1 ? 's' : ''})
          </Text>

          {loading && subscriptions.length === 0 ? (
            <ActivityIndicator size="large" color={HOST_COLORS.primary} style={styles.loader} />
          ) : subscriptions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>Aucun abonnement</Text>
              <Text style={styles.emptyText}>
                Souscrivez pour pouvoir publier un bien en location mensuelle.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={onSubscribePress}>
                <Text style={styles.primaryButtonText}>Souscrire pour un bien</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {subscriptions.map((sub) => (
                <View key={sub.id} style={styles.subCard}>
                  <View style={styles.subRow}>
                    <View style={styles.subInfo}>
                      <Text style={styles.subPropertyName} numberOfLines={1}>
                        {(sub as any).property?.title || `Bien #${sub.property_id.slice(0, 8)}`}
                      </Text>
                      <Text style={styles.subPlan}>
                        {sub.plan_type === 'single' && '1 bien'}
                        {sub.plan_type === 'multi_2_5' && '2 à 5 biens'}
                        {sub.plan_type === 'multi_6_plus' && '6+ biens'} •{' '}
                        {formatPrice(sub.monthly_price)}/mois
                      </Text>
                      <Text style={styles.subDates}>
                        Prochain renouvellement :{' '}
                        {new Date(sub.next_billing_date).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${statusColor[sub.status] || '#6b7280'}20` },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: statusColor[sub.status] || '#6b7280' }]}>
                        {statusLabel[sub.status] || sub.status}
                      </Text>
                    </View>
                  </View>
                  {sub.status === 'active' && (
                    <TouchableOpacity
                      style={styles.editSubButton}
                      onPress={() =>
                        navigation.navigate('EditProperty' as never, {
                          propertyId: sub.property_id,
                        })
                      }
                    >
                      <Text style={styles.editSubButtonText}>Modifier l'annonce</Text>
                      <Ionicons name="pencil-outline" size={16} color={HOST_COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.secondaryButton} onPress={onSubscribePress}>
                <Ionicons name="add-circle-outline" size={22} color={HOST_COLORS.primary} />
                <Text style={styles.secondaryButtonText}>Ajouter un abonnement pour un autre bien</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showPropertyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir un bien</Text>
              <TouchableOpacity onPress={() => setShowPropertyModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {loadingProperties ? (
              <ActivityIndicator size="large" color={HOST_COLORS.primary} style={styles.modalLoader} />
            ) : (
              <FlatList
                data={myProperties}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const hasSub = hasActiveSubscriptionForProperty(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.modalPropertyRow}
                      onPress={() => !hasSub && subscribeForProperty(item.id)}
                      disabled={hasSub || subscribingId === item.id}
                    >
                      <Text style={styles.modalPropertyTitle} numberOfLines={1}>{item.title}</Text>
                      {hasSub ? (
                        <Text style={styles.modalPropertyBadge}>Abonnement actif</Text>
                      ) : subscribingId === item.id ? (
                        <ActivityIndicator size="small" color={HOST_COLORS.primary} />
                      ) : (
                        <Text style={styles.modalPropertyCta}>Souscrire</Text>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  introCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginTop: 12,
    textAlign: 'center',
  },
  introText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#b91c1c',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  loader: {
    marginVertical: 24,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOST_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: HOST_COLORS.primary,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: HOST_COLORS.primary,
  },
  subCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subInfo: {
    flex: 1,
    marginRight: 12,
  },
  subPropertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  subPlan: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  subDates: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editSubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 6,
  },
  editSubButtonText: {
    fontSize: 14,
    color: HOST_COLORS.primary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  modalLoader: {
    marginVertical: 32,
  },
  modalPropertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalPropertyTitle: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  modalPropertyBadge: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  modalPropertyCta: {
    fontSize: 14,
    color: HOST_COLORS.primary,
    fontWeight: '600',
  },
});

export default HostSubscriptionScreen;
