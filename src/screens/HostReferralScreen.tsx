import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useReferrals } from '../hooks/useReferrals';
import * as Clipboard from 'expo-clipboard';

const HostReferralScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    referralCode,
    isLoadingCode,
    createReferralCode,
    referrals,
    isLoadingReferrals,
    hostStats,
  } = useReferrals();

  const [isCreating, setIsCreating] = useState(false);

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

    const referralUrl = `https://akwahome.com/become-host?ref=${referralCode.referral_code}`;
    const message = `Rejoignez Akwa Home en tant qu'hôte avec mon code de parrainage: ${referralCode.referral_code}\n${referralUrl}`;

    try {
      const result = await Share.share({
        message: message,
        title: 'Code de parrainage AkwaHome',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const shareViaWhatsApp = () => {
    if (!referralCode) return;

    const referralUrl = `https://akwahome.com/become-host?ref=${referralCode.referral_code}`;
    const message = `Rejoignez Akwa Home en tant qu'hôte avec mon code de parrainage: ${referralCode.referral_code}\n${referralUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    Linking.openURL(whatsappUrl).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp');
    });
  };

  const shareViaEmail = () => {
    if (!referralCode) return;

    const referralUrl = `https://akwahome.com/become-host?ref=${referralCode.referral_code}`;
    const subject = 'Rejoignez Akwa Home en tant qu\'hôte';
    const body = `Bonjour,\n\nJe vous invite à rejoindre Akwa Home en tant qu'hôte et à partager vos propriétés avec des voyageurs du monde entier.\n\nUtilisez mon code de parrainage: ${referralCode.referral_code}\nOu inscrivez-vous directement via ce lien: ${referralUrl}\n\nÀ bientôt sur Akwa Home!`;
    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email');
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'En attente',
          color: '#f59e0b',
          icon: 'time-outline',
        };
      case 'registered':
        return {
          label: 'Candidature envoyée',
          color: '#3498db',
          icon: 'document-text-outline',
        };
      case 'first_property':
        return {
          label: 'Candidature acceptée',
          color: '#10b981',
          icon: 'checkmark-circle-outline',
        };
      case 'completed':
        return {
          label: 'Complété - 5000 XOF',
          color: '#2E7D32',
          icon: 'trophy-outline',
        };
      default:
        return {
          label: status,
          color: '#666',
          icon: 'help-circle-outline',
        };
    }
  };

  if (isLoadingCode) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Système de Parrainage</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!referralCode) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Système de Parrainage</Text>
          <View style={styles.backButton} />
        </View>
        <ScrollView style={styles.content}>
          <View style={styles.card}>
            <Ionicons name="gift-outline" size={48} color="#2E7D32" />
            <Text style={styles.cardTitle}>Système de Parrainage</Text>
            <Text style={styles.cardDescription}>
              Créez votre code de parrainage pour inviter d'autres hôtes
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateCode}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="gift" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Créer mon code de parrainage</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const referralUrl = `https://akwahome.com/become-host?ref=${referralCode.referral_code}`;
  const hostReferrals = referrals.filter(r => r.referrer_type === 'host');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Système de Parrainage</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Programme de récompense */}
        <View style={styles.rewardCard}>
          <View style={styles.rewardHeader}>
            <Ionicons name="sparkles" size={24} color="#2E7D32" />
            <Text style={styles.rewardTitle}>Programme de Récompense</Text>
          </View>
          <Text style={styles.rewardDescription}>
            Recevez 5000 XOF pour chaque hôte parrainé qui reçoit sa première réservation
          </Text>
          
          <View style={styles.rewardStats}>
            <View style={styles.rewardStatItem}>
              <Text style={styles.rewardStatValue}>{hostStats.totalRewards} XOF</Text>
              <Text style={styles.rewardStatLabel}>Récompenses gagnées</Text>
            </View>
            <View style={styles.rewardStatItem}>
              <Text style={[styles.rewardStatValue, { color: '#f59e0b' }]}>
                {hostStats.pendingPayment}
              </Text>
              <Text style={styles.rewardStatLabel}>En attente de paiement</Text>
            </View>
          </View>

          <View style={styles.howItWorks}>
            <Ionicons name="information-circle" size={20} color="#3498db" />
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>Comment ça marche ?</Text>
              <Text style={styles.howItWorksText}>• Parrainez un nouvel hôte avec votre code</Text>
              <Text style={styles.howItWorksText}>• L'hôte s'inscrit et soumet sa candidature</Text>
              <Text style={styles.howItWorksText}>• Une fois sa candidature acceptée</Text>
              <Text style={styles.howItWorksText}>• Dès qu'il reçoit sa première réservation confirmée, vous recevez 5000 XOF</Text>
            </View>
          </View>
        </View>

        {/* Code de parrainage */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Votre Code de Parrainage</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{referralCode.referral_code}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyReferralCode}>
              <Ionicons name="copy-outline" size={20} color="#2E7D32" />
            </TouchableOpacity>
          </View>

          <Text style={styles.shareTitle}>Partager</Text>
          <View style={styles.shareButtons}>
            <TouchableOpacity style={styles.shareButton} onPress={shareReferralCode}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shareButton, styles.whatsappButton]} onPress={shareViaWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shareButton, styles.emailButton]} onPress={shareViaEmail}>
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.shareButtonText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={24} color="#2E7D32" />
            <Text style={styles.statValue}>{hostStats.total}</Text>
            <Text style={styles.statLabel}>Total parrainages</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{hostStats.pending}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#10b981" />
            <Text style={styles.statValue}>{hostStats.completed}</Text>
            <Text style={styles.statLabel}>Complétés</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy-outline" size={24} color="#e67e22" />
            <Text style={styles.statValue}>{hostStats.totalRewards} XOF</Text>
            <Text style={styles.statLabel}>Récompenses</Text>
          </View>
        </View>

        {/* Liste des parrainages */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mes Parrainages</Text>
          {isLoadingReferrals ? (
            <ActivityIndicator size="large" color="#2E7D32" style={styles.loader} />
          ) : hostReferrals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucun parrainage pour le moment</Text>
              <Text style={styles.emptySubtext}>Partagez votre code pour commencer</Text>
            </View>
          ) : (
            <View style={styles.referralsList}>
              {hostReferrals.map((referral) => {
                const statusInfo = getStatusInfo(referral.status);
                return (
                  <View key={referral.id} style={styles.referralItem}>
                    <View style={styles.referralHeader}>
                      <View style={styles.referralInfo}>
                        <Text style={styles.referralEmail}>{referral.referred_email}</Text>
                        <Text style={styles.referralDate}>
                          Parrainé le {new Date(referral.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
                        <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>
                    {referral.reward_amount > 0 && referral.status === 'completed' && (
                      <View style={styles.rewardBadge}>
                        <Text style={styles.rewardBadgeText}>+{referral.reward_amount} XOF</Text>
                      </View>
                    )}
                  </View>
                );
              })}
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
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rewardCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2E7D3220',
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  rewardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  rewardStats: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  rewardStatItem: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  rewardStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  rewardStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  howItWorks: {
    flexDirection: 'row',
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    gap: 10,
  },
  howItWorksContent: {
    flex: 1,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  howItWorksText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  codeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  emailButton: {
    backgroundColor: '#3498db',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
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
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  referralsList: {
    gap: 15,
  },
  referralItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  referralInfo: {
    flex: 1,
  },
  referralEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  referralDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rewardBadge: {
    backgroundColor: '#10b98120',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  rewardBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

export default HostReferralScreen;

