import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useUserProfile, clearProfileCache } from '../hooks/useUserProfile';
import { useAuth } from '../services/AuthContext';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import IdentityVerificationAlert from '../components/IdentityVerificationAlert';
import { useEmailVerification } from '../hooks/useEmailVerification';
import EmailVerificationModal from '../components/EmailVerificationModal';
import { useHostApplications } from '../hooks/useHostApplications';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { profile, loading, error, refreshProfile } = useUserProfile();
  const { verificationStatus, isVerified } = useIdentityVerification();
  const { isEmailVerified, generateVerificationCode, checkEmailVerificationStatus } = useEmailVerification();
  const { getApplications } = useHostApplications();
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [hasPendingApplications, setHasPendingApplications] = useState(false);

  // Rafraîchir le profil quand l'écran devient actif (seulement si connecté)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        refreshProfile();
        checkPendingApplications();
        // Rafraîchir aussi le statut de vérification de l'email
        // Forcer le rafraîchissement pour être sûr d'avoir la dernière valeur
        // Utiliser un délai pour s'assurer que les autres opérations sont terminées
        setTimeout(() => {
          checkEmailVerificationStatus(true); // force = true pour forcer le rafraîchissement
        }, 300);
        
        // Vérification supplémentaire après un délai plus long pour être sûr
        setTimeout(() => {
          checkEmailVerificationStatus(true);
        }, 1000);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]) // Ne pas inclure les fonctions pour éviter les boucles
  );

  const checkPendingApplications = async () => {
    if (!user) return;
    
    try {
      const applications = await getApplications();
      const pendingApps = applications.filter(app => 
        app.status === 'pending' || app.status === 'reviewing'
      );
      setHasPendingApplications(pendingApps.length > 0);
    } catch (error) {
      console.error('Erreur lors de la vérification des candidatures:', error);
      setHasPendingApplications(false);
    }
  };


  const handleEmailVerification = async () => {
    if (!profile) return;
    
    const email = user?.email;
    if (!email) {
      Alert.alert('Erreur', 'Aucune adresse email trouvée');
      return;
    }
    
    console.log('📧 Début de la vérification d\'email pour:', email);
    
    const result = await generateVerificationCode(email, profile.first_name || '');
    
    if (result.success) {
      console.log('✅ Code généré avec succès, affichage de la modal');
      Alert.alert(
        'Code envoyé',
        'Un code de vérification a été envoyé à votre adresse email. Vérifiez votre boîte de réception (et le dossier spam).',
        [{ text: 'OK', onPress: () => setShowEmailVerification(true) }]
      );
    } else {
      console.error('❌ Erreur lors de la génération du code:', result.error);
      const errorMessage = result.error || 'Impossible d\'envoyer le code de vérification';
      Alert.alert(
        'Erreur',
        errorMessage + '\n\nVérifiez votre connexion et réessayez.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleEmailVerificationSuccess = async () => {
    setShowEmailVerification(false);
    
    // Attendre un peu pour que la base de données soit mise à jour
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Forcer le rafraîchissement du statut de vérification de l'email immédiatement
    await checkEmailVerificationStatus(true); // force = true
    
    // Rafraîchir le profil pour mettre à jour toutes les informations
    await refreshProfile();
    
    // Vérifier à nouveau après un délai pour être sûr que la DB est bien à jour
    setTimeout(async () => {
      await checkEmailVerificationStatus(true);
      await refreshProfile();
    }, 1500);
    
    // Dernière vérification après un délai supplémentaire pour être absolument sûr
    setTimeout(async () => {
      await checkEmailVerificationStatus(true);
    }, 3000);
  };

  const handleCloseEmailVerification = () => {
    setShowEmailVerification(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              // Nettoyer le cache du profil avant la déconnexion
              clearProfileCache();
              
              // Utiliser la fonction signOut du contexte pour mettre à jour le state
              await signOut();
              
              // Forcer la navigation vers l'écran d'authentification
              navigation.reset({
                index: 0,
                routes: [{ name: 'Auth' }],
              });
            } catch (error: any) {
              console.error('Erreur lors de la déconnexion:', error);
              
              // Si c'est une erreur de session manquante, on considère que la déconnexion est réussie
              if (error?.message?.includes('Auth session missing')) {
                clearProfileCache();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Auth' }],
                });
                return;
              }
              
              Alert.alert('Erreur', 'Impossible de se déconnecter');
            }
          },
        },
      ]
    );
  };

  // Créer les éléments de menu de base
  const baseMenuItems = [
    {
      id: 'edit',
      title: 'Modifier le profil',
      icon: 'person-outline',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'bookings',
      title: 'Mes réservations',
      icon: 'calendar-outline',
      onPress: () => navigation.navigate('MyBookings'),
    },
  ];

  // Élément pour le tableau de bord hôte (contient toutes les options hôtes)
  const hostDashboardItem = {
    id: 'hostDashboard',
    title: 'Tableau de bord hôte',
    icon: 'grid-outline',
    onPress: () => navigation.navigate('HostDashboard'),
  };

  // Élément pour devenir hôte (si pas encore hôte)
  const becomeHostItem = {
    id: 'host',
    title: 'Devenir hôte',
    icon: 'home-outline',
    onPress: () => navigation.navigate('BecomeHost'),
  };

  // Éléments de menu communs
  const commonMenuItems = [
    {
      id: 'settings',
      title: 'Paramètres',
      icon: 'settings-outline',
      onPress: () => navigation.navigate('Settings' as never),
    },
  ];

  // Construire la liste des éléments de menu selon le profil
  let menuItems = [...baseMenuItems];

  // Ajouter l'élément hôte si l'utilisateur est hôte OU a des candidatures en cours
  if (profile?.is_host || hasPendingApplications) {
    menuItems.push(hostDashboardItem);
  } else {
    // Ajouter "Devenir hôte" si pas encore hôte et pas de candidatures en cours
    menuItems.push(becomeHostItem);
  }

  // Ajouter les éléments communs
  menuItems = [...menuItems, ...commonMenuItems];

  // Ajouter l'option Administration seulement si l'utilisateur est admin
  if (profile?.role === 'admin') {
    menuItems.push({
      id: 'admin',
      title: 'Administration',
      icon: 'shield-outline',
      onPress: () => navigation.navigate('Admin'),
    });
  }


  // Utiliser la liste construite dynamiquement
  const finalMenuItems = menuItems;


  // Rediriger vers l'authentification si l'utilisateur n'est pas connecté ou s'il y a une erreur d'authentification
  useEffect(() => {
    if (!user || error?.includes('Session expirée') || error?.includes('Auth session missing')) {
      navigation.navigate('Auth');
    }
  }, [user, error, navigation]);

  // Si l'utilisateur n'est pas connecté ou s'il y a une erreur d'authentification, afficher un indicateur de chargement
  if (!user || error?.includes('Session expirée') || error?.includes('Auth session missing')) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Redirection vers la connexion...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ 
                uri: profile?.avatar_url || 
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(
                       (profile?.first_name || 'U') + 
                       (profile?.last_name ? ' ' + profile.last_name : '')
                     )}&background=2E7D32&color=FFFFFF&size=100`
              }}
              style={styles.avatar}
              onError={() => {
                // En cas d'erreur, utiliser l'avatar par défaut
                console.log('Erreur de chargement de l\'avatar');
              }}
            />
            {/* Badge de vérification d'identité */}
            {verificationStatus === 'verified' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
            )}
          </View>
          <Text style={styles.userName}>
            {profile?.first_name || 'Utilisateur'} {profile?.last_name || ''}
          </Text>
          <Text style={styles.userEmail}>{profile?.email}</Text>
          
          {/* Statut de vérification d'email */}
          <View style={styles.emailStatusContainer}>
            <Ionicons 
              name={isEmailVerified ? 'checkmark-circle' : 'alert-circle'} 
              size={16} 
              color={isEmailVerified ? '#10b981' : '#f59e0b'} 
            />
            <Text style={styles.emailStatusText}>
              {isEmailVerified ? 'Email vérifié' : 'Email non vérifié'}
            </Text>
            {!isEmailVerified && (
              <TouchableOpacity 
                style={styles.verifyEmailButton}
                onPress={handleEmailVerification}
              >
                <Text style={styles.verifyEmailButtonText}>Vérifier</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Statut de vérification d'identité */}
          {verificationStatus && (
            <View style={styles.identityStatusContainer}>
              <Ionicons 
                name={
                  verificationStatus === 'verified' ? 'checkmark-circle' :
                  verificationStatus === 'pending' ? 'time' :
                  verificationStatus === 'rejected' ? 'close-circle' : 'alert-circle'
                } 
                size={16} 
                color={
                  verificationStatus === 'verified' ? '#10b981' :
                  verificationStatus === 'pending' ? '#f59e0b' :
                  verificationStatus === 'rejected' ? '#ef4444' : '#6b7280'
                } 
              />
              <Text style={[
                styles.identityStatusText,
                {
                  color: verificationStatus === 'verified' ? '#10b981' :
                         verificationStatus === 'pending' ? '#f59e0b' :
                         verificationStatus === 'rejected' ? '#ef4444' : '#6b7280'
                }
              ]}>
                {verificationStatus === 'verified' ? 'Identité vérifiée' :
                 verificationStatus === 'pending' ? 'Vérification en cours' :
                 verificationStatus === 'rejected' ? 'Document refusé' : 'Non vérifié'}
              </Text>
            </View>
          )}
        </View>

        {/* Vérification d'identité */}
        <View style={styles.identitySection}>
          <IdentityVerificationAlert />
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={24} color="#333" />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>AkwaHome v1.0.0</Text>
          <Text style={styles.appDescription}>
            Votre plateforme de réservation d'hébergements en Côte d'Ivoire
          </Text>
        </View>
      </ScrollView>
      
      {/* Modal de vérification d'email */}
      {user && profile && (
        <EmailVerificationModal
          visible={showEmailVerification}
          email={user.email || ''}
          firstName={profile.first_name || ''}
          onVerificationSuccess={handleEmailVerificationSuccess}
          onClose={handleCloseEmailVerification}
        />
      )}
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
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#2E7D32',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  identityStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    alignSelf: 'center',
  },
  identityStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  emailStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  emailStatusText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  verifyEmailButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  verifyEmailButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  identitySection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  logoutText: {
    fontSize: 16,
    color: '#e74c3c',
    fontWeight: '500',
    marginLeft: 10,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  appVersion: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  appDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ProfileScreen;