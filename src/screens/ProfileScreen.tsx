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
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../services/AuthContext';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile, loading, error, refreshProfile } = useUserProfile();

  // Rafraîchir le profil quand l'écran devient actif (seulement si connecté)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        refreshProfile();
      }
    }, [refreshProfile, user])
  );


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
              await supabase.auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error) {
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

  // Ajouter l'élément hôte si l'utilisateur est hôte
  if (profile?.is_host) {
    menuItems.push(hostDashboardItem);
  } else {
    // Ajouter "Devenir hôte" si pas encore hôte
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
      onPress: () => navigation.navigate('AdminDashboard'),
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
    <SafeAreaView style={styles.container}>
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
          </View>
          <Text style={styles.userName}>
            {profile?.first_name || 'Utilisateur'} {profile?.last_name || ''}
          </Text>
          <Text style={styles.userEmail}>{profile?.email}</Text>
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