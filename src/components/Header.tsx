import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';

interface HeaderProps {
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onProfilePress, 
  onNotificationPress 
}) => {
  const { user } = useAuth();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/akwa-home-logo-transparent.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>AkwaHome</Text>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onNotificationPress}
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onProfilePress}
          >
            {user ? (
              <Image
                source={{ 
                  uri: user?.user_metadata?.avatar_url || 
                       user?.user_metadata?.picture ||
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(
                         (user?.user_metadata?.first_name || 'U') + 
                         (user?.user_metadata?.last_name ? ' ' + user.user_metadata.last_name : '')
                       )}&background=2E7D32&color=FFFFFF&size=32`
                }}
                style={styles.profileAvatar}
                onError={() => {
                  console.log('Erreur de chargement de l\'avatar dans le header');
                }}
              />
            ) : (
              <Ionicons name="person-outline" size={24} color="#333" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 10,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
});
