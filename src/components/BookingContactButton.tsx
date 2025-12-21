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
import { supabase } from '../services/supabase';

interface BookingContactButtonProps {
  bookingId: string;
  propertyId: string;
  otherParticipantId: string;
  otherParticipantName?: string;
  isHost: boolean; // true si on contacte un hôte, false si on contacte un voyageur
  variant?: 'primary' | 'outline';
  size?: 'small' | 'medium' | 'large';
}

const BookingContactButton: React.FC<BookingContactButtonProps> = ({
  bookingId,
  propertyId,
  otherParticipantId,
  otherParticipantName,
  isHost,
  variant = 'outline',
  size = 'medium',
}) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { createOrGetConversation } = useMessaging();
  const [loading, setLoading] = useState(false);

  const handleContact = async () => {
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Vous devez être connecté pour contacter ' + (isHost ? 'l\'hôte' : 'le voyageur'),
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => navigation.navigate('Auth' as never) }
        ]
      );
      return;
    }

    if (user.id === otherParticipantId) {
      Alert.alert('Action impossible', 'Vous ne pouvez pas vous contacter vous-même');
      return;
    }

    setLoading(true);
    try {
      // Récupérer le nom si non fourni
      let participantName = otherParticipantName;
      if (!participantName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', otherParticipantId)
          .single();
        
        participantName = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || (isHost ? 'Hôte' : 'Voyageur')
          : (isHost ? 'Hôte' : 'Voyageur');
      }

      console.log('🟡 [BookingContactButton] Contact:', {
        bookingId,
        propertyId,
        hostId: isHost ? otherParticipantId : user.id,
        guestId: isHost ? user.id : otherParticipantId,
        participantName
      });

      const conversationId = await createOrGetConversation(
        propertyId,
        isHost ? otherParticipantId : user.id, // host_id
        isHost ? user.id : otherParticipantId   // guest_id
      );

      if (conversationId) {
        console.log('✅ [BookingContactButton] Conversation créée:', conversationId);
        
        // Navigation vers l'onglet de messagerie avec l'ID de conversation
        (navigation as any).navigate('Home', { 
          screen: 'MessagingTab',
          params: { 
            conversationId, 
            propertyId,
            bookingId,
            recipientName: participantName
          }
        });
      } else {
        throw new Error('Impossible de créer la conversation');
      }
    } catch (error: any) {
      console.error('❌ [BookingContactButton] Erreur:', error);
      Alert.alert(
        'Erreur',
        error.message || `Impossible de contacter ${isHost ? 'l\'hôte' : 'le voyageur'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    if (variant === 'primary') {
      baseStyle.push(styles.primaryButton);
    } else {
      baseStyle.push(styles.outlineButton);
    }

    if (size === 'small') {
      baseStyle.push(styles.smallButton);
    } else if (size === 'large') {
      baseStyle.push(styles.largeButton);
    }

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];
    
    if (variant === 'primary') {
      baseStyle.push(styles.primaryButtonText);
    } else {
      baseStyle.push(styles.outlineButtonText);
    }

    if (size === 'small') {
      baseStyle.push(styles.smallButtonText);
    } else if (size === 'large') {
      baseStyle.push(styles.largeButtonText);
    }

    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handleContact}
      disabled={loading || !user || user.id === otherParticipantId}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' ? '#e67e22' : '#fff'} 
        />
      ) : (
        <>
          <Ionicons
            name="chatbubble-outline"
            size={getIconSize()}
            color={variant === 'outline' ? '#e67e22' : '#fff'}
            style={styles.icon}
          />
          <Text style={getTextStyle()}>
            Contacter {isHost ? 'l\'hôte' : 'le voyageur'}
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#e67e22',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e67e22',
  },
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  largeButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontWeight: '500',
  },
  primaryButtonText: {
    color: '#fff',
  },
  outlineButtonText: {
    color: '#e67e22',
  },
  smallButtonText: {
    fontSize: 12,
  },
  largeButtonText: {
    fontSize: 16,
  },
  icon: {
    marginRight: 0,
  },
});

export default BookingContactButton;

