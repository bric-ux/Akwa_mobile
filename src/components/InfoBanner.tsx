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
          <Ionicons name="home" size={16} color="#F5A574" />
        </View>
        <Text style={styles.hostBannerText}>
          Ajouter votre bien{' '}
          <Text style={styles.hostBannerLink}>en cliquant ici</Text>
        </Text>
        <Ionicons name="chevron-forward" size={14} color="rgba(246, 245, 242, 0.35)" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#1F1A17',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(246, 245, 242, 0.08)',
  },
  hostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  hostIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
  },
  hostBannerText: {
    flex: 1,
    color: '#F6F5F2',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hostBannerLink: {
    color: '#F5A574',
    textDecorationLine: 'underline',
  },
});
