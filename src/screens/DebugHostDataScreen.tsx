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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useHostPaymentInfo } from '../hooks/useHostPaymentInfo';

const DebugHostDataScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { paymentInfo, loading, error, fetchPaymentInfo } = useHostPaymentInfo();
  
  const [allHosts, setAllHosts] = useState<any[]>([]);
  const [hostsWithPaymentInfo, setHostsWithPaymentInfo] = useState<any[]>([]);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    loadDebugData();
  }, []);

  const loadDebugData = async () => {
    try {
      setDebugLoading(true);
      
      // Charger tous les hôtes
      const { data: hosts, error: hostsError } = await supabase
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

      if (hostsError) throw hostsError;
      setAllHosts(hosts || []);

      // Charger les hôtes avec informations de paiement
      const { data: paymentData, error: paymentError } = await supabase
        .from('host_payment_info')
        .select(`
          *,
          profiles!inner(
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (paymentError) throw paymentError;
      setHostsWithPaymentInfo(paymentData || []);

    } catch (error) {
      console.error('Erreur lors du chargement des données de debug:', error);
      Alert.alert('Erreur', 'Impossible de charger les données de debug');
    } finally {
      setDebugLoading(false);
    }
  };

  const testCurrentUserPaymentInfo = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }

    try {
      await fetchPaymentInfo();
      Alert.alert(
        'Test terminé',
        `Informations de paiement: ${paymentInfo ? 'TROUVÉES' : 'NON TROUVÉES'}\n` +
        `Erreur: ${error || 'Aucune'}\n` +
        `Chargement: ${loading ? 'En cours' : 'Terminé'}`
      );
    } catch (error) {
      Alert.alert('Erreur', `Erreur lors du test: ${error}`);
    }
  };

  const renderHostItem = (host: any, hasPaymentInfo: boolean) => (
    <View key={host.user_id} style={styles.hostItem}>
      <View style={styles.hostInfo}>
        <Text style={styles.hostName}>{host.first_name} {host.last_name}</Text>
        <Text style={styles.hostEmail}>{host.email}</Text>
        <Text style={styles.hostRole}>Rôle: {host.role}</Text>
      </View>
      <View style={[
        styles.statusBadge,
        hasPaymentInfo ? styles.hasPaymentInfo : styles.noPaymentInfo
      ]}>
        <Text style={styles.statusText}>
          {hasPaymentInfo ? 'Avec infos' : 'Sans infos'}
        </Text>
      </View>
    </View>
  );

  const renderPaymentInfoItem = (paymentInfo: any) => (
    <View key={paymentInfo.id} style={styles.paymentItem}>
      <View style={styles.paymentHeader}>
        <Text style={styles.paymentHostName}>
          {paymentInfo.profiles.first_name} {paymentInfo.profiles.last_name}
        </Text>
        <View style={[
          styles.verificationBadge,
          paymentInfo.verification_status === 'verified' ? styles.verified : 
          paymentInfo.verification_status === 'rejected' ? styles.rejected : styles.pending
        ]}>
          <Text style={styles.verificationText}>
            {paymentInfo.verification_status}
          </Text>
        </View>
      </View>
      <Text style={styles.paymentMethod}>
        Méthode: {paymentInfo.preferred_payment_method}
      </Text>
      {paymentInfo.bank_name && (
        <Text style={styles.paymentDetail}>Banque: {paymentInfo.bank_name}</Text>
      )}
      {paymentInfo.mobile_money_provider && (
        <Text style={styles.paymentDetail}>
          Mobile Money: {paymentInfo.mobile_money_provider}
        </Text>
      )}
      {paymentInfo.paypal_email && (
        <Text style={styles.paymentDetail}>PayPal: {paymentInfo.paypal_email}</Text>
      )}
      <Text style={styles.paymentDate}>
        Créé le: {new Date(paymentInfo.created_at).toLocaleDateString('fr-FR')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug - Données Hôtes</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Informations utilisateur actuel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Utilisateur actuel</Text>
          <View style={styles.userInfo}>
            <Text style={styles.userText}>ID: {user?.id || 'Non connecté'}</Text>
            <Text style={styles.userText}>Email: {user?.email || 'N/A'}</Text>
          </View>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testCurrentUserPaymentInfo}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.testButtonText}>Tester mes infos de paiement</Text>
            )}
          </TouchableOpacity>
          
          {paymentInfo && (
            <View style={styles.currentUserPaymentInfo}>
              <Text style={styles.currentUserTitle}>Mes informations de paiement:</Text>
              <Text style={styles.currentUserDetail}>
                Méthode: {paymentInfo.preferred_payment_method}
              </Text>
              <Text style={styles.currentUserDetail}>
                Statut: {paymentInfo.verification_status}
              </Text>
              <Text style={styles.currentUserDetail}>
                Vérifié: {paymentInfo.is_verified ? 'Oui' : 'Non'}
              </Text>
            </View>
          )}
        </View>

        {/* Statistiques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{allHosts.length}</Text>
              <Text style={styles.statLabel}>Total hôtes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{hostsWithPaymentInfo.length}</Text>
              <Text style={styles.statLabel}>Avec infos paiement</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {allHosts.length - hostsWithPaymentInfo.length}
              </Text>
              <Text style={styles.statLabel}>Sans infos paiement</Text>
            </View>
          </View>
        </View>

        {/* Liste des hôtes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tous les hôtes</Text>
          {debugLoading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : (
            <View style={styles.hostsList}>
              {allHosts.map(host => {
                const hasPaymentInfo = hostsWithPaymentInfo.some(
                  p => p.user_id === host.user_id
                );
                return renderHostItem(host, hasPaymentInfo);
              })}
            </View>
          )}
        </View>

        {/* Informations de paiement existantes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de paiement existantes</Text>
          {debugLoading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : (
            <View style={styles.paymentList}>
              {hostsWithPaymentInfo.map(renderPaymentInfoItem)}
            </View>
          )}
        </View>

        {/* Bouton de rafraîchissement */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadDebugData}
          disabled={debugLoading}
        >
          <Ionicons name="refresh" size={20} color="#2E7D32" />
          <Text style={styles.refreshButtonText}>Actualiser les données</Text>
        </TouchableOpacity>
      </ScrollView>
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
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  userInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  userText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  testButton: {
    backgroundColor: '#2E7D32',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  currentUserPaymentInfo: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  currentUserTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  currentUserDetail: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  hostsList: {
    gap: 8,
  },
  hostItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  hostInfo: {
    flex: 1,
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
  hostRole: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hasPaymentInfo: {
    backgroundColor: '#c8e6c9',
  },
  noPaymentInfo: {
    backgroundColor: '#ffcdd2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  paymentList: {
    gap: 12,
  },
  paymentItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentHostName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  verificationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verified: {
    backgroundColor: '#c8e6c9',
  },
  rejected: {
    backgroundColor: '#ffcdd2',
  },
  pending: {
    backgroundColor: '#fff3cd',
  },
  verificationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  paymentDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    marginBottom: 20,
  },
  refreshButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default DebugHostDataScreen;
