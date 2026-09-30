import React, { useState, useCallback, useRef } from 'react';
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
import AdminNotificationBell from '../components/AdminNotificationBell';
import AdminBookingBreakdownSection from '../components/admin/AdminBookingBreakdownSection';
import type { BookingBreakdown } from '../components/admin/AdminBookingBreakdownSection';
import { fetchAdminBookingBreakdown } from '../lib/adminBookingBreakdown';
import { supabase } from '../services/supabase';

type ActionItem = {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type AdminSection = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  accentSoft: string;
  items: ActionItem[];
};

const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getDashboardStats } = useAdmin();
  const getDashboardStatsRef = useRef(getDashboardStats);
  getDashboardStatsRef.current = getDashboardStats;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bookingBreakdown, setBookingBreakdown] = useState<BookingBreakdown | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [testingEmail, setTestingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    residences: true,
    vehicles: true,
    hotels: true,
    monthly: true,
    users: true,
    payments: true,
    notifications: true,
    platform: true,
    tools: true,
  });

  const loadStats = useCallback(async () => {
    try {
      const [dash, breakdown] = await Promise.all([
        getDashboardStatsRef.current('all'),
        fetchAdminBookingBreakdown(),
      ]);
      setStats(dash);
      setBookingBreakdown(breakdown);
    } catch (error) {
      console.error('Erreur stats admin:', error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user && profile?.role === 'admin') void loadStats();
    }, [user, profile?.role, loadStats]),
  );

  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }
    try {
      setTestingEmail(true);
      setShowEmailModal(false);
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
        booking_message: 'Test email PDF AkwaHome.',
        discount_applied: true,
        discount_amount: 1000,
        payment_method: 'wave',
        payment_plan: 'full',
      };

      const { error: pdfError } = await supabase.functions.invoke('generate-booking-pdf', {
        body: { bookingData: pdfBookingData },
      });

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
            status: 'confirmed',
          },
        },
      });

      if (emailError) {
        Alert.alert('Erreur', "Impossible d'envoyer l'email");
      } else {
        Alert.alert(
          'Succès',
          pdfError
            ? `Email envoyé à ${testEmail} (sans PDF).`
            : `Email de test envoyé à ${testEmail}.`,
        );
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec du test');
    } finally {
      setTestingEmail(false);
      setTestEmail('');
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => navigation.goBack()}>
            <Text style={styles.loginButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={56} color="#ccc" />
          <Text style={styles.emptyTitle}>Accès réservé</Text>
          <Text style={styles.emptySubtitle}>Cet espace est réservé aux administrateurs.</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => navigation.goBack()}>
            <Text style={styles.loginButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sections: AdminSection[] = [
    {
      id: 'residences',
      title: 'Résidences meublées',
      subtitle: 'Annonces, candidatures hôte, avis, réservations',
      icon: 'home-outline',
      accent: '#c2410c',
      accentSoft: '#fff7ed',
      items: [
        {
          title: 'Candidatures d’hôtes',
          description: 'Valider les nouvelles demandes',
          icon: 'person-add-outline',
          onPress: () => navigation.navigate('AdminApplications'),
        },
        {
          title: 'Propriétés',
          description: 'Masquer, afficher, supprimer',
          icon: 'business-outline',
          onPress: () => navigation.navigate('AdminProperties'),
        },
        {
          title: 'Avis voyageurs',
          description: 'Approuver ou rejeter',
          icon: 'star-outline',
          onPress: () => navigation.navigate('AdminReviews'),
        },
        {
          title: 'Recherche réservation',
          description: 'Par numéro akwa-xxx',
          icon: 'search-outline',
          onPress: () => navigation.navigate('AdminBookingManagement'),
        },
        {
          title: 'Pénalités d’annulation',
          description: 'Suivi des pénalités',
          icon: 'alert-circle-outline',
          onPress: () => navigation.navigate('AdminPenalties'),
        },
      ],
    },
    {
      id: 'vehicles',
      title: 'Véhicules',
      subtitle: 'Validation et suivi flotte',
      icon: 'car-outline',
      accent: '#1e3a5f',
      accentSoft: '#eff6ff',
      items: [
        {
          title: 'Validation des véhicules',
          description: 'Approuver ou rejeter les demandes',
          icon: 'car-sport-outline',
          onPress: () => navigation.navigate('AdminVehicles'),
        },
      ],
    },
    {
      id: 'hotels',
      title: 'Hôtels',
      subtitle: 'Établissements & publication',
      icon: 'bed-outline',
      accent: '#6d28d9',
      accentSoft: '#f5f3ff',
      items: [
        {
          title: 'Modération hôtels',
          description: 'Approuver ou refuser les soumissions',
          icon: 'checkmark-circle-outline',
          onPress: () => navigation.navigate('AdminHotels'),
        },
      ],
    },
    {
      id: 'monthly',
      title: 'Bail longue durée',
      subtitle: 'Annonces & candidatures locataires',
      icon: 'calendar-outline',
      accent: '#0f766e',
      accentSoft: '#f0fdfa',
      items: [
        {
          title: 'Modération des annonces',
          description: 'Approuver ou refuser avant affichage',
          icon: 'document-text-outline',
          onPress: () => navigation.navigate('AdminMonthlyRental'),
        },
      ],
    },
    {
      id: 'users',
      title: 'Utilisateurs',
      subtitle: 'Comptes, identité, vitrines',
      icon: 'people-outline',
      accent: '#0369a1',
      accentSoft: '#f0f9ff',
      items: [
        {
          title: 'Comptes & rôles',
          description: 'Gérer les utilisateurs',
          icon: 'people-outline',
          onPress: () => navigation.navigate('AdminUsers'),
        },
        {
          title: 'Documents d’identité',
          description: 'Vérification KYC',
          icon: 'shield-checkmark-outline',
          onPress: () => navigation.navigate('AdminIdentityDocuments'),
        },
        {
          title: 'Partager les vitrines',
          description: 'SMS / email lien profil public',
          icon: 'share-social-outline',
          onPress: () => navigation.navigate('AdminProfileShare'),
        },
      ],
    },
    {
      id: 'payments',
      title: 'Paiements',
      subtitle: 'Revenus, virements, remboursements',
      icon: 'cash-outline',
      accent: '#15803d',
      accentSoft: '#f0fdf4',
      items: [
        {
          title: 'Revenus AkwaHome',
          description: 'Gains résidences & véhicules',
          icon: 'trending-up-outline',
          onPress: () => navigation.navigate('AdminRevenue'),
        },
        {
          title: 'Paiements hôtes / propriétaires',
          description: 'Virements à effecteur',
          icon: 'wallet-outline',
          onPress: () => navigation.navigate('AdminPayouts'),
        },
        {
          title: 'Infos de paiement hôtes',
          description: 'RIB / Wave des hôtes',
          icon: 'card-outline',
          onPress: () => navigation.navigate('AdminHostPaymentInfo'),
        },
        {
          title: 'Parrainage',
          description: 'Campagne 1 000 FCFA',
          icon: 'gift-outline',
          onPress: () => navigation.navigate('AdminReferralPayouts'),
        },
        {
          title: 'Remboursements',
          description: 'Suivi des remboursements',
          icon: 'refresh-outline',
          onPress: () => navigation.navigate('AdminRefunds'),
        },
      ],
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Push, centre de notifications',
      icon: 'notifications-outline',
      accent: '#b45309',
      accentSoft: '#fffbeb',
      items: [
        {
          title: 'Notifications push',
          description: 'Envoyer un message push',
          icon: 'phone-portrait-outline',
          onPress: () => navigation.navigate('AdminPushNotifications'),
        },
        {
          title: 'Centre de notifications',
          description: 'Historer les notifications admin',
          icon: 'notifications-outline',
          onPress: () => navigation.navigate('AdminNotifications'),
        },
      ],
    },
    {
      id: 'platform',
      title: 'Plateforme',
      subtitle: 'Stats & visibilité produits',
      icon: 'settings-outline',
      accent: '#475569',
      accentSoft: '#f8fafc',
      items: [
        {
          title: 'Statistiques détaillées',
          description: 'Vue globale de la plateforme',
          icon: 'analytics-outline',
          onPress: () => navigation.navigate('AdminStats'),
        },
        {
          title: 'Visibilité produits',
          description: 'Bail longue durée & hôtels',
          icon: 'eye-outline',
          onPress: () => navigation.navigate('AdminFeatureFlags'),
        },
      ],
    },
    {
      id: 'tools',
      title: 'Outils & tests',
      subtitle: 'Environnement de diagnostic',
      icon: 'construct-outline',
      accent: '#64748b',
      accentSoft: '#f1f5f9',
      items: [
        {
          title: 'Test calculs réservation',
          description: 'Logs détaillés',
          icon: 'calculator-outline',
          onPress: () => navigation.navigate('AdminBookingCalculationTest'),
        },
        {
          title: 'Test paiement commission',
          description: 'Statut carte / commission',
          icon: 'card-outline',
          onPress: () => navigation.navigate('AdminCommissionPaymentTest'),
        },
        {
          title: 'Test paiement Wave',
          description: 'Simulation sans compte Wave',
          icon: 'phone-portrait-outline',
          onPress: () => navigation.navigate('AdminWaveTest'),
        },
        {
          title: 'Test email + PDF',
          description: testingEmail ? 'Envoi en cours…' : 'Envoyer un email de confirmation',
          icon: 'mail-outline',
          onPress: () => setShowEmailModal(true),
        },
      ],
    },
  ];

  const kpi = [
    {
      label: 'Utilisateurs',
      value: stats?.totalUsers,
      icon: 'people-outline' as const,
      color: '#0369a1',
      soft: '#e0f2fe',
    },
    {
      label: 'Véhicules',
      value: stats?.totalVehicles,
      icon: 'car-outline' as const,
      color: '#1e3a5f',
      soft: '#eff6ff',
    },
    {
      label: 'Résidences',
      value: stats?.totalProperties,
      icon: 'home-outline' as const,
      color: '#c2410c',
      soft: '#ffedd5',
    },
    {
      label: 'Hôtels',
      value: stats?.hotelEstablishmentsTotal,
      icon: 'bed-outline' as const,
      color: '#6d28d9',
      soft: '#ede9fe',
    },
    {
      label: 'Bail longue durée',
      value: stats?.monthlyListingsTotal,
      icon: 'document-text-outline' as const,
      color: '#0f766e',
      soft: '#f0fdfa',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Administration</Text>
          <Text style={styles.headerSub}>Pilotage de la plateforme</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={loadStats} disabled={loadingStats}>
          {loadingStats ? (
            <ActivityIndicator size="small" color="#0f172a" />
          ) : (
            <Ionicons name="refresh" size={20} color="#0f172a" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <AdminNotificationBell />

        <Text style={styles.kicker}>Aperçu</Text>
        <View style={styles.kpiGrid}>
          {kpi.map((item) => (
            <View key={item.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: item.soft }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              {loadingStats && !stats ? (
                <ActivityIndicator size="small" color={item.color} style={{ marginTop: 8 }} />
              ) : (
                <Text style={styles.kpiValue}>{item.value ?? 0}</Text>
              )}
              <Text style={styles.kpiLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.statsShortcut}
          onPress={() => navigation.navigate('AdminStats')}
          activeOpacity={0.8}
        >
          <View style={styles.statsShortcutIcon}>
            <Ionicons name="analytics-outline" size={20} color="#0f766e" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statsShortcutTitle}>Statistiques</Text>
            <Text style={styles.statsShortcutDesc}>Suivre l’activité de la plateforme</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {(stats?.monthlyVisitRequestsPending ?? 0) > 0 ||
        (stats?.pendingApplications ?? 0) > 0 ? (
          <View style={styles.alertRow}>
            {(stats?.pendingApplications ?? 0) > 0 ? (
              <TouchableOpacity
                style={[styles.alertChip, { backgroundColor: '#fff7ed' }]}
                onPress={() => navigation.navigate('AdminApplications')}
              >
                <Text style={[styles.alertChipText, { color: '#c2410c' }]}>
                  {stats?.pendingApplications} candidature
                  {(stats?.pendingApplications ?? 0) > 1 ? 's' : ''} hôte
                </Text>
              </TouchableOpacity>
            ) : null}
            {(stats?.monthlyVisitRequestsPending ?? 0) > 0 ? (
              <TouchableOpacity
                style={[styles.alertChip, { backgroundColor: '#f0fdfa' }]}
                onPress={() => navigation.navigate('AdminMonthlyRental')}
              >
                <Text style={[styles.alertChipText, { color: '#0f766e' }]}>
                  {stats?.monthlyVisitRequestsPending} candidature
                  {(stats?.monthlyVisitRequestsPending ?? 0) > 1 ? 's' : ''} bail
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {sections.map((section) => {
          const isCollapsed = !!collapsed[section.id];
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.sectionIconWrap, { backgroundColor: section.accentSoft }]}>
                  <Ionicons name={section.icon} size={20} color={section.accent} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                </View>
                <View style={styles.sectionMeta}>
                  <Text style={[styles.sectionCount, { color: section.accent }]}>
                    {section.items.length}
                  </Text>
                  <Ionicons
                    name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color="#94a3b8"
                  />
                </View>
              </TouchableOpacity>

              {!isCollapsed ? (
                <View style={styles.sectionBody}>
                  {section.items.map((item, index) => (
                    <TouchableOpacity
                      key={item.title}
                      style={[
                        styles.actionRow,
                        index === section.items.length - 1 && styles.actionRowLast,
                      ]}
                      onPress={item.onPress}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: section.accentSoft }]}>
                        <Ionicons name={item.icon} size={18} color={section.accent} />
                      </View>
                      <View style={styles.actionText}>
                        <Text style={styles.actionTitle}>{item.title}</Text>
                        {item.description ? (
                          <Text style={styles.actionDesc} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={styles.kicker}>Réservations</Text>
        {loadingStats && !stats ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#64748b" />
          </View>
        ) : (
          <AdminBookingBreakdownSection breakdown={bookingBreakdown} />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal
        visible={showEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tester l’envoi d’email</Text>
            <Text style={styles.modalSubtitle}>
              Adresse où envoyer le test de confirmation avec PDF
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
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  loginButtonText: { color: '#fff', fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: { marginTop: 2, fontSize: 12, color: '#64748b', fontWeight: '500' },
  statsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  statsShortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsShortcutTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  statsShortcutDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  alertRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  alertChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  alertChipText: { fontSize: 12, fontWeight: '700' },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  sectionSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  sectionMeta: { alignItems: 'flex-end', gap: 4 },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  sectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  actionRowLast: { borderBottomWidth: 0 },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  actionDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  emailInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonCancel: { backgroundColor: '#f1f5f9' },
  modalButtonCancelText: { color: '#475569', fontWeight: '600' },
  modalButtonSend: { backgroundColor: '#0f172a' },
  modalButtonSendText: { color: '#fff', fontWeight: '700' },
});

export default AdminDashboardScreen;
