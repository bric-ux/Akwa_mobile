import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';

type InfoBannerProps = {
  /** Conservé pour compatibilité (carrousel Conciergerie/Véhicules retiré). */
  showCarousel?: boolean;
};

export const InfoBanner: React.FC<InfoBannerProps> = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const goToBecomeHost = () => {
    if (user) {
      navigation.navigate('BecomeHost' as never);
    } else {
      navigation.navigate('Auth' as never, { returnTo: 'BecomeHost' } as never);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={goToBecomeHost}
        activeOpacity={0.85}
        style={styles.hostBanner}
      >
        <View style={styles.hostIconContainer}>
          <Ionicons name="home" size={16} color="#93c5fd" />
        </View>
        <Text style={styles.hostBannerText}>
          Ajouter votre bien{' '}
          <Text style={styles.hostBannerLink}>en cliquant ici</Text>
        </Text>
        <Ionicons name="chevron-forward" size={14} color="rgba(255, 255, 255, 0.4)" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#0a0e1a',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  hostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(37, 99, 235, 0.35)',
    backgroundColor: 'rgba(15, 42, 90, 0.55)',
  },
  hostIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.28)',
  },
  hostBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hostBannerLink: {
    color: '#93c5fd',
    textDecorationLine: 'underline',
  },
});
