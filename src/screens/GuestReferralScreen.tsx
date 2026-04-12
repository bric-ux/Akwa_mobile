import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useReferrals, REFERRAL_CAMPAIGN_MAX_SLOTS, REFERRAL_CAMPAIGN_UNIT_FCFA } from '../hooks/useReferrals';
import { useHostPaymentInfo } from '../hooks/useHostPaymentInfo';
import * as Clipboard from 'expo-clipboard';
import { getFilleulStatusInfo } from '../utils/referralFilleulStatus';

const GuestReferralScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    referralCode,
    isLoadingCode,
    createReferralCode,
    vouchers,
    isLoadingVouchers,
    guestStats,
    isLoadingReferrals,
    referrals,
  } = useReferrals();
  const { fetchPaymentInfo } = useHostPaymentInfo();

  const [isCreating, setIsCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchPaymentInfo();
    }, [fetchPaymentInfo])
  );

  const handleWithdrawPress = async () => {
    const info = await fetchPaymentInfo();
    const waveOk =
      info?.preferred_payment_method === 'mobile_money' &&
      info?.mobile_money_provider === 'wave' &&
      !!(info?.mobile_money_number || '').trim();
    if (!waveOk) {
      Alert.alert(
        'Numéro Wave requis',
        'Pour recevoir vos récompenses par Wave, renseignez votre numéro Wave dans les informations de paiement.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Informations de paiement',
            onPress: () => (navigation as any).navigate('HostPaymentInfo'),
          },
        ]
      );
      return;
    }
    Alert.alert(
      'Versement Wave',
      "Les montants dus sont versés par l'équipe AkwaHome sur votre numéro Wave après validation."
    );
  };

  const handleCreateCode = async () => {
    setIsCreating(true);
    const result = await createReferralCode();
    setIsCreating(false);
    
    if (result.success) {
      Alert.alert('Succès', 'Code de parrainage créé avec succès !');
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de la création du code');
    }
  };

  const copyReferralCode = async () => {
    if (referralCode) {
      await Clipboard.setStringAsync(referralCode.referral_code);
      Alert.alert('Copié !', 'Code copié dans le presse-papiers');
    }
  };

  const shareReferralCode = async () => {
    if (!referralCode) return;

    const message = `Salut ! Je t'invite à devenir hôte sur AkwaHome. En t'inscrivant avec mon code de parrainage, tu pourras mettre ton bien en location facilement.\n\nMon code : ${referralCode.referral_code}\n\nÀ bientôt sur AkwaHome !`;

    try {
      await Share.share({
        message: message,
        title: 'Code de parrainage AkwaHome',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const shareViaWhatsApp = () => {
    if (!referralCode) return;
    const text = encodeURIComponent(
      `Salut ! Je t'invite à devenir hôte sur AkwaHome. Utilise mon code de parrainage : ${referralCode.referral_code}`
    );
    Linking.openURL(`https://wa.me/?text=${text}`);
  };

  const shareViaEmail = () => {
    if (!referralCode) return;
    const subject = encodeURIComponent('Deviens hôte sur AkwaHome et gagne des avantages !');
    const body = encodeURIComponent(
      `Salut !\n\nJe t'invite à devenir hôte sur AkwaHome. En t'inscrivant avec mon code de parrainage, tu pourras mettre ton bien en location facilement.\n\nMon code : ${referralCode.referral_code}\n\nÀ bientôt sur AkwaHome !`
    );
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  };

  const formatPrice = (price: number) => {
    return `${Math.round(price).toLocaleString('fr-FR')} CFA`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Système de parrainage</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Programme de parrainage */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="gift-outline" size={24} color="#e67e22" />
              <Text style={styles.cardTitle}>Programme de Parrainage Voyageur</Text>
            </View>
            <Text style={styles.cardDescription}>
              {`Gagnez ${REFERRAL_CAMPAIGN_UNIT_FCFA.toLocaleString('fr-FR')} FCFA par filleul lorsque sa candidature hôte est approuvée (plafond ${REFERRAL_CAMPAIGN_MAX_SLOTS} filleuls rémunérés pour la campagne actuelle). Les anciens bons de réduction éventuels restent soumis à leurs conditions.`}
            </Text>
          </View>

          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <Ionicons name="document-text-outline" size={22} color="#e67e22" />
              <Text style={styles.rulesTitle}>Règles du programme</Text>
            </View>
            <Text style={styles.rulesItem}>
              • Votre filleul s’inscrit avec votre code et dépose sa candidature hôte.
            </Text>
            <Text style={styles.rulesItem}>
              • Lorsque la candidature est approuvée, vous êtes crédité de 1 000 FCFA (campagne actuelle), dans la limite de 30 filleuls rémunérés.
            </Text>
            <Text style={styles.rulesItem}>
              • Renseignez votre numéro Wave dans « Informations de paiement » pour le versement.
            </Text>
            <Text style={styles.rulesItem}>
              • D’éventuels bons déjà émis avant la campagne cash restent valables selon leur échéance.
            </Text>
          </View>

          {/* Code de parrainage */}
          {isLoadingCode ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e67e22" />
            </View>
          ) : !referralCode ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Créer votre code de parrainage</Text>
              <Text style={styles.sectionSubtitle}>
                Créez un code unique pour parrainer vos amis
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateCode}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>Créer mon code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Votre code de parrainage</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>{referralCode.referral_code}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={copyReferralCode}
                  >
                    <Ionicons name="copy-outline" size={20} color="#e67e22" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Boutons de partage */}
              <View style={styles.shareButtons}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={shareReferralCode}
                >
                  <Ionicons name="share-outline" size={20} color="#e67e22" />
                  <Text style={styles.shareButtonText}>Partager</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={shareViaWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  <Text style={styles.shareButtonText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={shareViaEmail}
                >
                  <Ionicons name="mail-outline" size={20} color="#e67e22" />
                  <Text style={styles.shareButtonText}>Email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Campagne cash + retrait */}
        {guestStats?.campaign && guestStats.campaign.pendingFcfa > 0 ? (
          <View style={[styles.section, { marginBottom: 8 }]}>
            <View style={[styles.card, { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#bbf7d0' }]}>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Récompense campagne (Wave)</Text>
              <Text style={[styles.cardDescription, { marginBottom: 12 }]}>
                {`${guestStats.campaign.pendingFcfa.toLocaleString('fr-FR')} FCFA en attente de versement — ${guestStats.campaign.slotsUsed}/${REFERRAL_CAMPAIGN_MAX_SLOTS} filleuls rémunérés.`}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#15803d',
                  paddingVertical: 14,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={handleWithdrawPress}
                activeOpacity={0.85}
              >
                <Ionicons name="wallet-outline" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Retirer (vérifier Wave)</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Statistiques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes statistiques</Text>
          {isLoadingReferrals || isLoadingVouchers ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e67e22" />
            </View>
          ) : (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{guestStats?.total || 0}</Text>
                  <Text style={styles.statLabel}>Parrainages</Text>
                  {guestStats && (guestStats.guestReferrals > 0 || guestStats.hostReferrals > 0) ? (
                    <Text style={[styles.statLabel, { fontSize: 10, color: '#999', marginTop: 4 }]}>
                      {`${guestStats.guestReferrals || 0} voyageur${guestStats.guestReferrals !== 1 ? 's' : ''} • ${guestStats.hostReferrals || 0} hôte${guestStats.hostReferrals !== 1 ? 's' : ''}`}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{guestStats?.completed || 0}</Text>
                  <Text style={styles.statLabel}>Complétés</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{guestStats?.activeVouchers || 0}</Text>
                  <Text style={styles.statLabel}>Bons actifs</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {(() => {
                      const savings = guestStats?.totalSavings || 0;
                      const rewards = referrals?.reduce((sum: number, r: any) => {
                        if (r.referrer_type === 'host' && r.status === 'completed') {
                          return sum + (r.cash_reward_amount || r.reward_amount || 0);
                        }
                        return sum;
                      }, 0) || 0;
                      return formatPrice(savings + rewards);
                    })()}
                  </Text>
                  <Text style={styles.statLabel}>
                    {guestStats && guestStats.hostReferrals > 0 
                      ? 'Économies + Récompenses' 
                      : 'Économies'
                    }
                  </Text>
                </View>
              </View>
              {guestStats && guestStats.hostReferrals > 0 ? (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#fff3e0' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="information-circle-outline" size={16} color="#e67e22" />
                    <Text style={[styles.label, { marginLeft: 8, fontSize: 13 }]}>
                      Note importante
                    </Text>
                  </View>
                  <Text style={[styles.cardDescription, { fontSize: 12 }]}>
                    {`Vous avez ${guestStats.hostReferrals} parrainage${guestStats.hostReferrals !== 1 ? 's' : ''} enregistré${guestStats.hostReferrals !== 1 ? 's' : ''} comme parrain « hôte » : la campagne actuelle rémunère en cash (Wave) à l’approbation de la candidature. La section « Mes bons de réduction » ci‑dessous ne concerne que d’éventuels avoirs déjà émis dans l’ancien système, pas la campagne cash.`}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Liste des parrainages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes filleuls — où ils en sont</Text>
          <Text style={styles.sectionSubtitle}>
            Statut de chaque personne dans le parcours : inscription, candidature, validation, récompense.
          </Text>
          {isLoadingReferrals ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e67e22" />
            </View>
          ) : (referrals && Array.isArray(referrals) && referrals.length > 0) ? (
            <View style={styles.referralsList}>
              {referrals.map((ref) => {
                const isGuest = !ref.referrer_type || ref.referrer_type === 'guest';
                const st = getFilleulStatusInfo(ref);
                const firstName = ref.referred_user?.first_name || null;
                const lastName = ref.referred_user?.last_name || null;
                const fullName = (() => {
                  if (firstName && lastName) {
                    return `${firstName} ${lastName}`.trim();
                  }
                  if (firstName) return firstName;
                  if (lastName) return lastName;
                  return null;
                })();
                
                return (
                  <View 
                    key={ref.id} 
                    style={[
                      styles.referralCard,
                      {
                        borderLeftWidth: 4,
                        borderLeftColor: st.color,
                      }
                    ]}
                  >
                    <View style={styles.referralHeader}>
                      <View style={styles.referralAvatar}>
                        <Ionicons 
                          name={isGuest ? "person-outline" : "business-outline"} 
                          size={24} 
                          color={isGuest ? "#4caf50" : "#e67e22"} 
                        />
                      </View>
                      <View style={styles.referralInfo}>
                        {fullName ? (
                          <>
                            <Text style={styles.referralName}>{fullName}</Text>
                            {ref.referred_email && ref.referred_email.trim() ? (
                              <Text style={styles.referralEmail}>{ref.referred_email}</Text>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <Text style={styles.referralName}>{ref.referred_email || 'Utilisateur'}</Text>
                            {ref.referred_user_id ? (
                              <Text style={[styles.referralEmail, { fontStyle: 'italic', color: '#999' }]}>
                                Profil en cours de création...
                              </Text>
                            ) : null}
                          </>
                        )}
                        <Text style={styles.filleulStepHint}>
                          Étape {st.step}/{st.totalSteps} — {st.label}
                        </Text>
                      </View>
                      <View style={[
                        styles.referralStatusBadge,
                        { backgroundColor: `${st.color}20` }
                      ]}>
                        <Ionicons name={st.icon as any} size={14} color={st.color} style={{ marginRight: 4 }} />
                        <Text style={[
                          styles.referralStatusText,
                          { color: st.color, flexShrink: 1 }
                        ]} numberOfLines={3}>
                          {st.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.filleulStatusDetail}>{st.detail}</Text>
                    <View style={styles.referralDetails}>
                      <View style={styles.referralDetailRow}>
                        <Ionicons name="mail-outline" size={14} color="#999" />
                        <Text style={styles.referralDetailText}>{ref.referred_email}</Text>
                      </View>
                      <View style={styles.referralDetailRow}>
                        <Ionicons 
                          name={isGuest ? "gift-outline" : "cash-outline"} 
                          size={14} 
                          color={isGuest ? "#999" : "#4caf50"} 
                        />
                        <Text style={[
                          styles.referralDetailText,
                          !isGuest && ref.cash_reward_amount ? { color: '#4caf50', fontWeight: '600' } : {}
                        ]}>
                          {(() => {
                            if (isGuest) {
                              return 'Bons de réduction';
                            }
                            if (ref.cash_reward_amount) {
                              return `Récompense: ${formatPrice(ref.cash_reward_amount)}`;
                            }
                            if (ref.reward_amount) {
                              return `Récompense: ${formatPrice(ref.reward_amount)}`;
                            }
                            return 'Récompense cash (en attente)';
                          })()}
                        </Text>
                      </View>
                      {!isGuest && (ref.cash_reward_amount || ref.reward_amount) ? (
                        <View style={styles.referralDetailRow}>
                          <Ionicons name="information-circle-outline" size={14} color="#ff9800" />
                          <Text style={[styles.referralDetailText, { color: '#ff9800', fontSize: 11 }]}>
                            {ref.cash_reward_paid ? 'Récompense versée' : 'Récompense en attente de versement'}
                          </Text>
                        </View>
                      ) : null}
                      {ref.completed_at ? (
                        <View style={styles.referralDetailRow}>
                          <Ionicons name="checkmark-circle-outline" size={14} color="#4caf50" />
                          <Text style={[styles.referralDetailText, { color: '#4caf50' }]}>
                            Complété le {new Date(ref.completed_at).toLocaleDateString('fr-FR')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucun filleul</Text>
              <Text style={styles.emptySubtext}>
                Parrainez des amis pour voir vos filleuls ici
              </Text>
            </View>
          )}
        </View>

        {/* Bons de réduction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes bons de réduction</Text>
          {isLoadingVouchers ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e67e22" />
            </View>
          ) : vouchers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="ticket-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucun bon de réduction</Text>
              <Text style={styles.emptySubtext}>
                Parrainez des amis pour gagner des bons de réduction
              </Text>
            </View>
          ) : (
            <View style={styles.vouchersList}>
              {vouchers.map((voucher) => (
                <View
                  key={voucher.id}
                  style={[
                    styles.voucherCard,
                    voucher.status === 'used' && styles.voucherCardUsed
                  ]}
                >
                  <View style={styles.voucherHeader}>
                    <View style={styles.voucherInfo}>
                      <Text style={styles.voucherDiscount}>
                        {voucher.discount_percentage}% de réduction
                      </Text>
                      <Text style={styles.voucherAmount}>
                        Jusqu&apos;à {formatPrice(voucher.discount_amount || 0)}
                      </Text>
                    </View>
                    <View style={[
                      styles.voucherStatus,
                      voucher.status === 'active' && styles.voucherStatusActive,
                      voucher.status === 'used' && styles.voucherStatusUsed
                    ]}>
                      <Text style={styles.voucherStatusText}>
                        {voucher.status === 'active' ? 'Actif' : 'Utilisé'}
                      </Text>
                    </View>
                  </View>
                  {voucher.valid_until ? (
                    <Text style={styles.voucherDate}>
                      Valide jusqu&apos;au {new Date(voucher.valid_until).toLocaleDateString('fr-FR')}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  rulesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fdebd0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  rulesItem: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  codeText: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  vouchersList: {
    gap: 12,
  },
  voucherCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e67e22',
  },
  voucherCardUsed: {
    borderColor: '#ccc',
    opacity: 0.6,
  },
  voucherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  voucherInfo: {
    flex: 1,
  },
  voucherDiscount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e67e22',
    marginBottom: 4,
  },
  voucherAmount: {
    fontSize: 14,
    color: '#666',
  },
  voucherStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  voucherStatusActive: {
    backgroundColor: '#d4edda',
  },
  voucherStatusUsed: {
    backgroundColor: '#f8f9fa',
  },
  voucherStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  voucherDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  referralsList: {
    gap: 12,
  },
  referralCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  referralInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  referralEmail: {
    fontSize: 12,
    color: '#999',
  },
  referralStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  referralStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  referralDetails: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  referralDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  referralDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});

export default GuestReferralScreen;

