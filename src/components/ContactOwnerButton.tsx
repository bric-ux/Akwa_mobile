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
  const { createOrGetConversation, loadConversations } = useMessaging();
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

      // Construire le titre de la conversation
      const vehicleTitle = vehicle.title || `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Véhicule';
      const conversationTitle = `Véhicule - ${vehicleTitle}`;

      const conversationId = await createOrGetConversation(
        undefined, // propertyId (pas de propriété ici)
        vehicle.owner_id, // hostId (le propriétaire est l'hôte)
        user.id, // guestId (l'utilisateur est l'invité)
        vehicle.id, // vehicleId
        conversationTitle // title
      );
      
      console.log('✅ [ContactOwnerButton] Conversation ID obtenu:', conversationId);

      if (conversationId) {
        console.log('✅ [ContactOwnerButton] Conversation créée:', conversationId);
        
        // Recharger les conversations pour s'assurer qu'elle est dans la liste
        console.log('🔄 [ContactOwnerButton] Rechargement des conversations...');
        await loadConversations(user.id);
        
        // Attendre un peu pour que les conversations soient chargées
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigation directe vers la conversation
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
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' ? '#2563eb' : '#fff'} 
        />
      ) : (
        <>
          {showIcon && (
            <Ionicons
              name="chatbubble-ellipses"
              size={getIconSize()}
              color={variant === 'outline' ? '#2563eb' : '#fff'}
            />
          )}
          <Text style={getTextStyle()} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            Contacter
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
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#64748b',
  },
  outlineButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#2563eb',
    shadowOpacity: 0.08,
    elevation: 2,
  },
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  mediumButton: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 14,
    minHeight: 60,
  },
  largeButton: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 14,
    minHeight: 64,
  },
  buttonText: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#fff',
  },
  outlineText: {
    color: '#2563eb',
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
    marginRight: 0,
  },
});

export default ContactOwnerButton;

