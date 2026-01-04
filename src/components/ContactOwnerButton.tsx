import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMessaging } from '../hooks/useMessaging';
import { Vehicle } from '../types';

interface ContactOwnerButtonProps {
  vehicle: Vehicle;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  style?: any;
}

const ContactOwnerButton: React.FC<ContactOwnerButtonProps> = ({
  vehicle,
  variant = 'primary',
  size = 'medium',
  showIcon = true,
  style
}) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { createOrGetConversation } = useMessaging();
  const [loading, setLoading] = useState(false);

  const handleContactOwner = async () => {
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Vous devez être connecté pour contacter le propriétaire',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => navigation.navigate('Auth' as never) }
        ]
      );
      return;
    }

    if (!vehicle) {
      Alert.alert('Erreur', 'Véhicule introuvable');
      return;
    }

    // L'utilisateur ne peut pas se contacter lui-même
    if (user.id === vehicle.owner_id) {
      Alert.alert(
        'Action impossible',
        'Vous ne pouvez pas vous contacter vous-même'
      );
      return;
    }

    setLoading(true);
    try {
      console.log('🟡 [ContactOwnerButton] Contact du propriétaire:', {
        vehicleId: vehicle.id,
        ownerId: vehicle.owner_id,
        guestId: user.id
      });

      const conversationId = await createOrGetConversation(
        undefined, // propertyId (pas de propriété ici)
        vehicle.owner_id, // hostId (le propriétaire est l'hôte)
        user.id, // guestId (l'utilisateur est l'invité)
        vehicle.id // vehicleId
      );
      
      console.log('✅ [ContactOwnerButton] Conversation ID obtenu:', conversationId);

      if (conversationId) {
        console.log('✅ [ContactOwnerButton] Conversation créée:', conversationId);
        
        // Navigation directe vers la conversation sans alerte
        console.log('🚀 [ContactOwnerButton] Navigation vers la conversation:', conversationId);
        (navigation as any).navigate('Home', { 
          screen: 'MessagingTab',
          params: { 
            conversationId, 
            vehicleId: vehicle.id,
            openedFromParam: true
          }
        });
      } else {
        throw new Error('Impossible de créer la conversation');
      }
    } catch (error: any) {
      console.error('❌ [ContactOwnerButton] Erreur:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de contacter le propriétaire'
      );
    } finally {
      setLoading(false);
    }
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primaryButton);
        break;
      case 'secondary':
        baseStyle.push(styles.secondaryButton);
        break;
      case 'outline':
        baseStyle.push(styles.outlineButton);
        break;
    }
    
    // Size styles
    switch (size) {
      case 'small':
        baseStyle.push(styles.smallButton);
        break;
      case 'medium':
        baseStyle.push(styles.mediumButton);
        break;
      case 'large':
        baseStyle.push(styles.largeButton);
        break;
    }
    
    if (style) {
      baseStyle.push(style);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];
    
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primaryText);
        break;
      case 'secondary':
        baseStyle.push(styles.secondaryText);
        break;
      case 'outline':
        baseStyle.push(styles.outlineText);
        break;
    }
    
    switch (size) {
      case 'small':
        baseStyle.push(styles.smallText);
        break;
      case 'medium':
        baseStyle.push(styles.mediumText);
        break;
      case 'large':
        baseStyle.push(styles.largeText);
        break;
    }
    
    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 20;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handleContactOwner}
      disabled={loading || !user || user.id === vehicle.owner_id}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' ? '#007AFF' : '#fff'} 
        />
      ) : (
        <>
          {showIcon && (
            <Ionicons
              name="chatbubble-outline"
              size={getIconSize()}
              color={variant === 'outline' ? '#007AFF' : '#fff'}
              style={styles.icon}
            />
          )}
          <Text style={getTextStyle()}>
            Contacter le propriétaire
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  mediumButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  largeButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 10,
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#fff',
  },
  outlineText: {
    color: '#007AFF',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  icon: {
    marginRight: 8,
  },
});

export default ContactOwnerButton;

