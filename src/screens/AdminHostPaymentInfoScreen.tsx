import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

interface Host {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_host: boolean;
  role: string;
}

interface HostPaymentInfo {
  id: string;
  user_id: string;
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_holder_name?: string;
  mobile_money_provider?: 'orange_money' | 'mtn_money' | 'moov_money' | 'wave';
  mobile_money_number?: string;
  paypal_email?: string;
  swift_code?: string;
  iban?: string;
  preferred_payment_method: 'bank_transfer' | 'mobile_money' | 'paypal';
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_notes?: string;
  created_at: string;
  updated_at: string;
}

const AdminHostPaymentInfoScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [hostPaymentInfo, setHostPaymentInfo] = useState<HostPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDecryptedData, setShowDecryptedData] = useState(false);
  const [decryptedData, setDecryptedData] = useState<any>(null);

  useEffect(() => {
    loadHosts();
  }, []);

  useEffect(() => {
    if (selectedHost) {
      loadHostPaymentInfo(selectedHost.user_id);
    }
  }, [selectedHost]);

  const loadHosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          is_host,
          role
        `)
        .eq('is_host', true)
        .order('first_name');

      if (error) throw error;
      setHosts(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des hôtes:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des hôtes');
    } finally {
      setLoading(false);
    }
  };

  const loadHostPaymentInfo = async (hostId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('host_payment_info')
        .select('*')
        .eq('user_id', hostId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setHostPaymentInfo(data as HostPaymentInfo);
    } catch (error) {
      console.error('Erreur lors du chargement des informations de paiement:', error);
      Alert.alert('Erreur', 'Impossible de charger les informations de paiement');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationStatusChange = async (status: 'verified' | 'rejected', notes?: string) => {
    if (!hostPaymentInfo) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('host_payment_info')
        .update({
          verification_status: status,
          verification_notes: notes,
          is_verified: status === 'verified'
        })
        .eq('id', hostPaymentInfo.id);

      if (error) throw error;

      Alert.alert('Succès', `Statut de vérification mis à jour: ${status}`);
      loadHostPaymentInfo(selectedHost!.user_id);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setLoading(false);
    }
  };

  const decryptData = async () => {
    if (!hostPaymentInfo) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('decrypt-payment-info', {
        body: { payment_info_id: hostPaymentInfo.id }
      });

      if (error) throw error;

      setDecryptedData(data);
      setShowDecryptedData(true);
    } catch (error) {
      console.error('Erreur lors du déchiffrement:', error);
      Alert.alert('Erreur', 'Impossible de déchiffrer les données');
    } finally {
      setLoading(false);
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.badgeText}>Vérifié</Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={styles.rejectedBadge}>
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={styles.badgeText}>Rejeté</Text>
          </View>
        );
      default:
        return (
          <View style={styles.pendingBadge}>
            <Ionicons name="time" size={16} color="#fff" />
            <Text style={styles.badgeText}>En attente</Text>
          </View>
        );
    }
  };

  const renderPaymentMethodInfo = () => {
    if (!hostPaymentInfo) return null;

    switch (hostPaymentInfo.preferred_payment_method) {
      case 'bank_transfer':
        return (
          <View style={styles.paymentInfoContainer}>
            <Text style={styles.paymentMethodTitle}>Virement bancaire</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Banque:</Text>
              <Text style={styles.infoValue}>{hostPaymentInfo.bank_name || 'Non spécifié'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Code banque:</Text>
              <Text style={styles.infoValue}>{hostPaymentInfo.bank_code || 'Non spécifié'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Numéro de compte:</Text>
              <Text style={styles.infoValue}>{hostPaymentInfo.account_number || 'Non spécifié'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Titulaire:</Text>
              <Text style={styles.infoValue}>{hostPaymentInfo.account_holder_name || 'Non spécifié'}</Text>
            </View>
            {hostPaymentInfo.swift_code && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>SWIFT:</Text>
                <Text style={styles.infoValue}>{hostPaymentInfo.swift_code}</Text>
              </View>
            )}
            {hostPaymentInfo.iban && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IBAN:</Text>
                <Text style={styles.infoValue}>{hostPaymentInfo.iban}</Text>
              </View>
            )}
          </View>
        );

      case 'mobile_money':
        return (
          <View style={styles.paymentInfoContainer}>
            <Text style={styles.paymentMethodTitle}>Mobile Money</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fournisseur:</Text>
              <Text style={styles.infoValue}>
                {hostPaymentInfo.mobile_money_provider === 'orange_money' && 'Orange Money'}
                {hostPaymentInfo.mobile_money_provider === 'mtn_money' && 'MTN Money'}
                {hostPaymentInfo.mobile_money_provider === 'moov_money' && 'Moov Money'}
                {hostPaymentInfo.mobile_money_provider === 'wave' && 'Wave'}
                {!hostPaymentInfo.mobile_money_provider && 'Non spécifié'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Numéro:</Text>
              <Text style={styles.infoValue}>{hostPaymentInfo.mobile_money_number || 'Non spécifié'}</Text>
            </View>
          </View>
        );

      case 'paypal':
        return (
          <View style={styles.paymentInfoContainer}>
            <Text style={styles.paymentMethodTitle}>PayPal</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{hostPaymentInfo.paypal_email || 'Non spécifié'}</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderHostItem = ({ item }: { item: Host }) => (
    <TouchableOpacity
      style={[
        styles.hostItem,
        selectedHost?.user_id === item.user_id && styles.selectedHostItem
      ]}
      onPress={() => setSelectedHost(item)}
    >
      <Text style={styles.hostName}>{item.first_name} {item.last_name}</Text>
      <Text style={styles.hostEmail}>{item.email}</Text>
    </TouchableOpacity>
  );

  if (loading && !hostPaymentInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Informations de paiement</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement...</Text>
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
        <Text style={styles.headerTitle}>Informations de paiement</Text>
      </View>

      <View style={styles.content}>
        {/* Liste des hôtes */}
        <View style={styles.hostsSection}>
          <Text style={styles.sectionTitle}>Hôtes</Text>
          <FlatList
            data={hosts}
            renderItem={renderHostItem}
            keyExtractor={(item) => item.user_id}
            style={styles.hostsList}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Informations de paiement */}
        <ScrollView style={styles.paymentSection} showsVerticalScrollIndicator={false}>
          {selectedHost ? (
            <View>
              <View style={styles.hostHeader}>
                <Text style={styles.hostTitle}>
                  {selectedHost.first_name} {selectedHost.last_name}
                </Text>
                <Text style={styles.hostSubtitle}>{selectedHost.email}</Text>
                {hostPaymentInfo && getVerificationBadge(hostPaymentInfo.verification_status)}
              </View>

              {hostPaymentInfo ? (
                <View>
                  {/* Informations de paiement */}
                  {renderPaymentMethodInfo()}

                  {/* Données déchiffrées */}
                  {showDecryptedData && decryptedData && (
                    <View style={styles.decryptedContainer}>
                      <Text style={styles.decryptedTitle}>Données déchiffrées (confidentielles)</Text>
                      {decryptedData.decrypted_account_number && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Numéro de compte:</Text>
                          <Text style={styles.infoValue}>{decryptedData.decrypted_account_number}</Text>
                        </View>
                      )}
                      {decryptedData.decrypted_mobile_number && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Numéro Mobile Money:</Text>
                          <Text style={styles.infoValue}>{decryptedData.decrypted_mobile_number}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Actions d'administration */}
                  <View style={styles.actionsContainer}>
                    <Text style={styles.sectionTitle}>Actions d'administration</Text>
                    
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={() => handleVerificationStatusChange('verified')}
                        disabled={loading}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Marquer comme vérifié</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleVerificationStatusChange('rejected', 'Informations incomplètes')}
                        disabled={loading}
                      >
                        <Ionicons name="close-circle" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Rejeter</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.decryptButton}
                      onPress={decryptData}
                      disabled={loading}
                    >
                      <Ionicons name="eye" size={20} color="#2E7D32" />
                      <Text style={styles.decryptButtonText}>Déchiffrer les données</Text>
                    </TouchableOpacity>

                    <Text style={styles.securityNote}>
                      Note: Les informations sensibles sont automatiquement chiffrées lors de la sauvegarde.
                      Seuls les administrateurs peuvent déchiffrer et voir les données sensibles.
                    </Text>
                  </View>

                  {/* Métadonnées */}
                  <View style={styles.metadataContainer}>
                    <Text style={styles.metadataTitle}>Métadonnées</Text>
                    <Text style={styles.metadataText}>
                      Créé le: {new Date(hostPaymentInfo.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                    <Text style={styles.metadataText}>
                      Mis à jour le: {new Date(hostPaymentInfo.updated_at).toLocaleDateString('fr-FR')}
                    </Text>
                    {hostPaymentInfo.verification_notes && (
                      <Text style={styles.metadataText}>
                        Notes: {hostPaymentInfo.verification_notes}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.noPaymentInfoContainer}>
                  <Ionicons name="card-outline" size={48} color="#999" />
                  <Text style={styles.noPaymentInfoTitle}>Aucune information de paiement</Text>
                  <Text style={styles.noPaymentInfoText}>
                    Cet hôte n'a pas encore configuré ses informations de paiement.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noHostSelectedContainer}>
              <Ionicons name="people-outline" size={48} color="#999" />
              <Text style={styles.noHostSelectedTitle}>Sélectionnez un hôte</Text>
              <Text style={styles.noHostSelectedText}>
                Choisissez un hôte dans la liste pour voir ses informations de paiement.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  hostsSection: {
    width: '40%',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  hostsList: {
    flex: 1,
  },
  hostItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedHostItem: {
    backgroundColor: '#e8f5e8',
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  hostName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  hostEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentSection: {
    flex: 1,
    padding: 16,
  },
  hostHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  hostSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rejectedBadge: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#ff9800',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  paymentInfoContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  decryptedContainer: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  decryptedTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  actionsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  decryptButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  decryptButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  securityNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  metadataContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  metadataText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  noPaymentInfoContainer: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  noPaymentInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noPaymentInfoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  noHostSelectedContainer: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  noHostSelectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noHostSelectedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

export default AdminHostPaymentInfoScreen;