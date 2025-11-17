import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin, DashboardStats } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { useBookingPDF } from '../hooks/useBookingPDF';
import AdminNotificationBell from '../components/AdminNotificationBell';
import { supabase } from '../services/supabase';

const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getDashboardStats, loading } = useAdmin();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [testingEmail, setTestingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const { generateAndSendBookingPDF } = useBookingPDF();

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const dashboardStats = await getDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Charger les statistiques quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadStats();
      }
    }, [user, profile])
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const StatCard = ({ title, value, icon, color, onPress }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statContent}>
        <View style={styles.statIconContainer}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      )}
    </TouchableOpacity>
  );

  const QuickAction = ({ title, description, icon, onPress }: {
    title: string;
    description: string;
    icon: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon as any} size={24} color="#e74c3c" />
      </View>
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const handleNavigateToApplications = () => {
    navigation.navigate('AdminApplications');
  };

  const handleNavigateToProperties = () => {
    navigation.navigate('AdminProperties');
  };

  const handleNavigateToUsers = () => {
    navigation.navigate('AdminUsers');
  };

  const handleNavigateToIdentityDocuments = () => {
    navigation.navigate('AdminIdentityDocuments');
  };

  const handleNavigateToHostPaymentInfo = () => {
    navigation.navigate('AdminHostPaymentInfo');
  };

  const handleNavigateToNotifications = () => {
    navigation.navigate('AdminNotifications');
  };

  const handleNavigateToReviews = () => {
    navigation.navigate('AdminReviews');
  };

  const handleTestEmail = () => {
    setShowEmailModal(true);
  };

  const sendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    try {
      setTestingEmail(true);
      setShowEmailModal(false);

      // Données de test pour le PDF
      const pdfBookingData = {
        booking_id: 'test-' + Date.now(),
        property_title: 'Résidence H.Asso - Test',
        property_address: 'Adresse de test, Abidjan',
        city_name: 'Abidjan',
        region: 'Lagunes',
        price_per_night: 15000,
        cleaning_fee: 5000,
        service_fee: 2000,
        taxes: 1500,
        cancellation_policy: 'flexible',
        guest_name: 'Jean Dupont',
        guest_email: testEmail,
        guest_phone: '+225 07 12 34 56 78',
        host_name: 'Marie Martin',
        host_email: user?.email || 'host@example.com',
        host_phone: '+225 07 87 65 43 21',
        check_in: '2025-10-25',
        check_out: '2025-10-27',
        guests_count: 2,
        nights_count: 2,
        subtotal: 30000,
        total_price: 46600,
        booking_message: 'Ceci est un test d\'envoi d\'email avec PDF depuis l\'application mobile AkwaHome.',
        discount_applied: true,
        discount_amount: 1000,
        payment_method: 'wave',
        payment_plan: 'full'
      };

      console.log('📄 [AdminDashboard] Génération PDF de test...');
      
      // 1. Générer le PDF
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-booking-pdf', {
        body: { bookingData: pdfBookingData }
      });

      if (pdfError) {
        console.log('⚠️ [AdminDashboard] PDF non généré, envoi email sans pièce jointe');
        console.log('⚠️ Erreur PDF:', pdfError);
        
        // Envoyer l'email sans PDF en cas d'erreur
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'booking_confirmed',
            to: testEmail,
            data: {
              bookingId: pdfBookingData.booking_id,
              guestName: pdfBookingData.guest_name,
              propertyTitle: pdfBookingData.property_title,
              checkIn: pdfBookingData.check_in,
              checkOut: pdfBookingData.check_out,
              guests: pdfBookingData.guests_count,
              totalPrice: pdfBookingData.total_price,
              status: 'confirmed'
            }
          }
        });

        if (emailError) {
          console.error('❌ [AdminDashboard] Erreur email:', emailError);
          Alert.alert('Erreur', 'Impossible d\'envoyer l\'email');
        } else {
          Alert.alert(
            'Email envoyé (sans PDF)',
            'L\'email de test a été envoyé sans PDF à ' + testEmail + '\n\nNote: PDF non généré. Vérifiez votre boîte mail.',
            [{ text: 'OK', onPress: () => setTestEmail('') }]
          );
        }
      } else if (pdfData?.success && pdfData?.pdf) {
        console.log('✅ [AdminDashboard] PDF généré, envoi email avec pièce jointe');
        
        // 2. Envoyer l'email avec le PDF
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'booking_confirmed',
            to: testEmail,
            data: {
              bookingId: pdfBookingData.booking_id,
              guestName: pdfBookingData.guest_name,
              propertyTitle: pdfBookingData.property_title,
              checkIn: pdfBookingData.check_in,
              checkOut: pdfBookingData.check_out,
              guests: pdfBookingData.guests_count,
              totalPrice: pdfBookingData.total_price,
              status: 'confirmed'
            },
            attachments: [{
              filename: pdfData.filename || `reservation-test.pdf`,
              content: pdfData.pdf,
              type: 'application/pdf'
            }]
          }
        });

        if (emailError) {
          console.error('❌ [AdminDashboard] Erreur email:', emailError);
          Alert.alert('Erreur', 'Impossible d\'envoyer l\'email');
        } else {
          Alert.alert(
            'Succès',
            'Email de test avec PDF envoyé avec succès à ' + testEmail + '\n\nVérifiez votre boîte mail (y compris les spams).',
            [{ text: 'OK', onPress: () => setTestEmail('') }]
          );
        }
      }
    } catch (error) {
      console.error('❌ [AdminDashboard] Erreur test email:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de l\'email');
    } finally {
      setTestingEmail(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour accéder au tableau de bord admin.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Vérifier que l'utilisateur est admin
  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#e74c3c" />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas les permissions nécessaires pour accéder à l'administration.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.loginButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingStats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Administration</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadStats}
        >
          <Ionicons name="refresh" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        <AdminNotificationBell />

        {/* Statistiques principales */}
        {/* Actions rapides */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        
        <View style={styles.quickActionsContainer}>
          <QuickAction
            title="Statistiques"
            description="Voir les statistiques détaillées"
            icon="analytics-outline"
            onPress={() => navigation.navigate('AdminStats')}
          />

          <QuickAction
            title="Candidatures d'hôtes"
            description="Examiner et valider les nouvelles candidatures"
            icon="home-outline"
            onPress={handleNavigateToApplications}
          />
          
          <QuickAction
            title="Gestion des propriétés"
            description="Masquer, afficher ou supprimer toutes les propriétés"
            icon="business-outline"
            onPress={handleNavigateToProperties}
          />
          
          <QuickAction
            title="Informations de paiement"
            description="Gérer les informations de paiement des hôtes"
            icon="card-outline"
            onPress={handleNavigateToHostPaymentInfo}
          />
          
          <QuickAction
            title="Gestion des utilisateurs"
            description="Modifier les rôles et gérer les comptes utilisateurs"
            icon="people-outline"
            onPress={handleNavigateToUsers}
          />

          <QuickAction
            title="Documents d'identité"
            description="Vérifier les documents d'identité"
            icon="shield-checkmark-outline"
            onPress={handleNavigateToIdentityDocuments}
          />

          <QuickAction
            title="Notifications"
            description="Gérer les notifications"
            icon="notifications-outline"
            onPress={handleNavigateToNotifications}
          />

          <QuickAction
            title="Validation des avis"
            description="Approuver ou rejeter les avis des voyageurs"
            icon="star-outline"
            onPress={handleNavigateToReviews}
          />
        </View>

        {/* Section Tests */}
        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>Tests</Text>
          <TouchableOpacity
            style={[styles.testButton, testingEmail && styles.testButtonDisabled]}
            onPress={handleTestEmail}
            disabled={testingEmail}
          >
            {testingEmail ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="mail-outline" size={20} color="#fff" />
                <Text style={styles.testButtonText}>Tester l'envoi d'email avec PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Réservations récentes */}
        {stats?.recentBookings && stats.recentBookings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Réservations récentes</Text>
            <View style={styles.recentContainer}>
              {stats.recentBookings.slice(0, 3).map((booking, index) => (
                <View key={index} style={styles.recentItem}>
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentItemTitle}>
                      {booking.properties?.title || 'Propriété'}
                    </Text>
                    <Text style={styles.recentItemSubtitle}>
                      {booking.profiles?.first_name} {booking.profiles?.last_name}
                    </Text>
                    <View style={styles.recentItemMeta}>
                      <Text style={styles.recentItemDate}>
                        {formatDate(booking.created_at)}
                      </Text>
                      <Text style={styles.recentItemPrice}>
                        {formatPrice(booking.total_price || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal pour saisie email de test */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tester l'envoi d'email</Text>
            <Text style={styles.modalSubtitle}>
              Entrez l'adresse email où envoyer le test avec PDF
            </Text>
            
            <TextInput
              style={styles.emailInput}
              placeholder="votre-email@example.com"
              placeholderTextColor="#999"
              value={testEmail}
              onChangeText={setTestEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEmailModal(false);
                  setTestEmail('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSend]}
                onPress={sendTestEmail}
                disabled={!testEmail || testingEmail}
              >
                {testingEmail ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonSendText}>Envoyer</Text>
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
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickAction: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffeaea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 14,
    color: '#666',
  },
  recentContainer: {
    marginBottom: 20,
  },
  recentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recentItemContent: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recentItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  recentItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentItemDate: {
    fontSize: 12,
    color: '#999',
  },
  recentItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  adminBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  hostBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  hostBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  testSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  testButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  testButtonDisabled: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonCancelText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSend: {
    backgroundColor: '#27ae60',
  },
  modalButtonSendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminDashboardScreen;
