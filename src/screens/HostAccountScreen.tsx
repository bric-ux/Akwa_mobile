import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserProfile, clearProfileCache } from '../hooks/useUserProfile';
import { useAuth } from '../services/AuthContext';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import IdentityVerificationAlert from '../components/IdentityVerificationAlert';
import { useLanguage } from '../contexts/LanguageContext';

const HostAccountScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { profile, loading, error, refreshProfile } = useUserProfile();
  const { verificationStatus } = useIdentityVerification();

  // Rafraîchir le profil quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        refreshProfile();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Nettoyer le mode préféré lors de la déconnexion
              await AsyncStorage.removeItem('preferredMode');
              clearProfileCache();
              await signOut();
              // Retourner au mode voyageur (Home)
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error: any) {
              console.error('Erreur lors de la déconnexion:', error);
              if (error?.message?.includes('Auth session missing')) {
                clearProfileCache();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
                return;
              }
              Alert.alert(t('common.error'), t('profile.logoutError'));
            }
          },
        },
      ]
    );
  };

  const handleSwitchToTravelerMode = async () => {
    Alert.alert(
      t('host.switchToTraveler'),
      t('host.switchToTravelerConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.yes'),
          onPress: async () => {
            // Naviguer vers la page de transition
            navigation.navigate('ModeTransition' as never, {
              targetMode: 'traveler',
              targetPath: 'Home',
              fromMode: 'host',
            });
          },
        },
      ]
    );
  };

  // Rediriger vers l'authentification si l'utilisateur n'est pas connecté
  if (!user || error?.includes('Session expirée') || error?.includes('Auth session missing')) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>{t('auth.redirecting')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>{t('profile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      id: 'edit',
      title: t('profile.edit'),
      icon: 'person-outline',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'addProperty',
      title: t('host.addProperty'),
      icon: 'add-circle-outline',
      onPress: () => navigation.navigate('BecomeHost' as never),
    },
    {
      id: 'conciergerie',
      title: 'Conciergerie',
      icon: 'sparkles-outline',
      onPress: () => navigation.navigate('Conciergerie' as never),
    },
    {
      id: 'referral',
      title: t('profile.referral'),
      icon: 'gift-outline',
      onPress: () => navigation.navigate('GuestReferral' as never),
    },
    {
      id: 'settings',
      title: t('settings.title'),
      icon: 'settings-outline',
      onPress: () => navigation.navigate('Settings' as never),
    },
  ];

  // Ajouter l'option Administration si admin
  if (profile?.role === 'admin') {
    menuItems.push({
      id: 'admin',
      title: 'Administration',
      icon: 'shield-outline',
      onPress: () => navigation.navigate('Admin'),
    });
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
                       (profile?.first_name || 'H') + 
                       (profile?.last_name ? ' ' + profile.last_name : '')
                     )}&background=2E7D32&color=FFFFFF&size=100`
              }}
              style={styles.avatar}
            />
            {verificationStatus === 'verified' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              </View>
            )}
          </View>
          <Text style={styles.userName}>
            {profile?.first_name || 'Hôte'} {profile?.last_name || ''}
          </Text>
          <Text style={styles.userEmail}>{profile?.email}</Text>
          
          {/* Badge Hôte */}
          <View style={styles.hostBadge}>
            <Ionicons name="home" size={16} color="#e67e22" />
            <Text style={styles.hostBadgeText}>{t('host.verified')}</Text>
          </View>
        </View>

        {/* Bouton retour mode voyageur */}
        <View style={styles.switchModeContainer}>
          <TouchableOpacity 
            style={styles.switchModeButton}
            onPress={handleSwitchToTravelerMode}
            activeOpacity={0.8}
          >
            <View style={styles.switchModeContent}>
              <View style={styles.switchModeIconContainer}>
                <Ionicons name="airplane-outline" size={18} color="#fff" />
              </View>
              <View style={styles.switchModeTextContainer}>
                <Text style={styles.switchModeText}>{t('host.switchToTraveler')}</Text>
                <Text style={styles.switchModeSubtext}>{t('host.switchToTravelerDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
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
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>AkwaHome v1.0.0</Text>
          <Text style={styles.appDescription}>
            Espace hôte - Gérez vos propriétés et réservations
          </Text>
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
    borderColor: '#e67e22',
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
    marginBottom: 10,
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
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5e6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  hostBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e67e22',
    marginLeft: 6,
  },
  switchModeContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  switchModeButton: {
    backgroundColor: '#e67e22',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  switchModeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchModeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  switchModeTextContainer: {
    flex: 1,
  },
  switchModeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  switchModeSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  identitySection: {
    marginHorizontal: 20,
    marginTop: 10,
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

export default HostAccountScreen;

