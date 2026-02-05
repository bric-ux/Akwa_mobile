import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMessaging } from '../hooks/useMessaging';
import { Conversation, Message } from '../types';
import ConversationList from '../components/ConversationList';
import MessageBubble from '../components/MessageBubble';
import { useLanguage } from '../contexts/LanguageContext';
import BottomNavigationBar from '../components/BottomNavigationBar';

const { height: screenHeight } = Dimensions.get('window');

const MessagingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Détecter si on est dans le TabNavigator (MessagingTab) ou dans le Stack (Messaging)
  // Si route.name est 'MessagingTab', on est dans le TabNavigator et on ne doit pas afficher le BottomNavigationBar
  // Si route.name est 'Messaging', on est dans le Stack et on doit afficher le BottomNavigationBar
  const isInTabNavigator = route.name === 'MessagingTab' || route.name === 'HostMessagingTab' || route.name === 'VehicleOwnerMessagingTab' || route.name === 'VehicleMessagingTab';
  
  // Récupérer l'ID de conversation et de propriété depuis les paramètres de navigation
  const conversationId = (route.params as any)?.conversationId;
  const propertyId = (route.params as any)?.propertyId;
  const vehicleId = (route.params as any)?.vehicleId;
  const {
    conversations,
    messages,
    loading,
    sending,
    error,
    loadConversations,
    loadMessages,
    sendMessage,
    markMessagesAsRead,
    setupRealtimeSubscription,
    clearUnreadForConversation
  } = useMessaging();

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showConversations, setShowConversations] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [openedFromParam, setOpenedFromParam] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const hasOpenedConversationRef = useRef<string | null>(null);

  // Charger les conversations au montage
  useEffect(() => {
    if (user) {
      console.log('📱 [MessagingScreen] Chargement des conversations pour l\'utilisateur:', user.id);
      loadConversations(user.id);
    }
  }, [user, loadConversations]);

  // Ouvrir automatiquement une conversation si un ID est fourni
  useEffect(() => {
    if (conversationId && hasOpenedConversationRef.current !== conversationId) {
      // Si on a des conversations, chercher dedans
      if (conversations.length > 0) {
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (conversation) {
          console.log('🎯 [MessagingScreen] Ouverture automatique de la conversation:', conversationId);
          hasOpenedConversationRef.current = conversationId;
          // Réinitialiser le dernier chargé pour forcer le rechargement
          lastLoadedConversationId.current = null;
          // Vérifier si on vient d'un paramètre (propertyId ou vehicleId)
          if (propertyId || vehicleId) {
            setOpenedFromParam(true);
          }
          // Mettre à jour les états de manière synchrone pour éviter les tremblements
          setShowConversations(false);
          // Utiliser requestAnimationFrame pour éviter les conflits de state
          requestAnimationFrame(() => {
            setSelectedConversation(conversation);
          });
          return;
        }
      }
      
      // Si la conversation n'est pas trouvée, créer une conversation temporaire
      console.log('⚠️ [MessagingScreen] Conversation non trouvée dans la liste, création temporaire...');
      if (user) {
        // Créer une conversation temporaire pour permettre l'ouverture immédiate
        const tempConversation: Conversation = {
          id: conversationId,
          guest_id: user.id,
          host_id: '', // Sera mis à jour après le rechargement
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        if (vehicleId) {
          (tempConversation as any).vehicle_id = vehicleId;
        }
        if (propertyId) {
          (tempConversation as any).property_id = propertyId;
        }
        
        hasOpenedConversationRef.current = conversationId;
        if (propertyId || vehicleId) {
          setOpenedFromParam(true);
        }
        setShowConversations(false);
        requestAnimationFrame(() => {
          setSelectedConversation(tempConversation as Conversation);
        });
        
        // Recharger les conversations en arrière-plan pour obtenir les vraies données
        loadConversations(user.id);
      }
    }
  }, [conversationId, conversations, propertyId, vehicleId, user, loadConversations]);

  // Mettre à jour la conversation sélectionnée si elle est chargée après une création temporaire
  useEffect(() => {
    if (selectedConversation && conversationId && selectedConversation.id === conversationId && conversations.length > 0) {
      const realConversation = conversations.find(conv => conv.id === conversationId);
      if (realConversation && (!selectedConversation.host_id || selectedConversation.host_id === '')) {
        // Mettre à jour avec la vraie conversation si elle est maintenant disponible
        console.log('🔄 [MessagingScreen] Mise à jour de la conversation temporaire avec les vraies données');
        setSelectedConversation(realConversation);
      }
    }
  }, [conversations, selectedConversation, conversationId]);

  // Réinitialiser openedFromParam quand on revient à la liste des conversations
  useEffect(() => {
    if (showConversations && openedFromParam) {
      setOpenedFromParam(false);
    }
  }, [showConversations, openedFromParam]);

  // Réinitialiser l'état quand l'écran perd le focus (quand on fait goBack)
  useFocusEffect(
    useCallback(() => {
      // Quand l'écran est focus, on ne fait rien
      return () => {
        // Quand l'écran perd le focus (on quitte), réinitialiser si on était dans une conversation ouverte depuis une propriété
        if (openedFromParam) {
          setOpenedFromParam(false);
          setSelectedConversation(null);
          setShowConversations(true);
        }
      };
    }, [openedFromParam])
  );

  // Configuration du temps réel
  useEffect(() => {
    if (user) {
      console.log('🔔 Configuration du temps réel pour l\'utilisateur:', user.id);
      const cleanup = setupRealtimeSubscription(user.id);
      return cleanup;
    }
  }, [user, setupRealtimeSubscription]);

  // Charger les messages quand une conversation est sélectionnée (une seule fois)
  const lastLoadedConversationId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedConversation && user && selectedConversation.id) {
      const conversationId = selectedConversation.id;
      // Ne charger que si ce n'est pas déjà chargé
      if (lastLoadedConversationId.current !== conversationId) {
        lastLoadedConversationId.current = conversationId;
        const loadAndMark = async () => {
          console.log('📨 [MessagingScreen] Chargement des messages pour:', conversationId);
          await loadMessages(conversationId);
          // Marquer comme lus après avoir chargé les messages
          await markMessagesAsRead(conversationId, user.id);
        };
        loadAndMark();
      }
    }
  }, [selectedConversation?.id, user, loadMessages, markMessagesAsRead]);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowConversations(false);
    // Clear badge immédiatement côté UI
    clearUnreadForConversation(conversation.id);
  };

  // Fonction pour détecter les numéros de téléphone dans le texte
  const containsPhoneNumber = (text: string): boolean => {
    // Détecter les numéros de 8 à 15 chiffres consécutifs (même dans le texte)
    // Exemples: "bonjour voici 0707424857", "appelez-moi au 01 23 45 67 89", etc.
    const phoneRegex = /\d{8,15}/g;
    
    // Vérifier si le texte contient un numéro de téléphone
    if (phoneRegex.test(text)) {
      return true;
    }
    
    // Détecter les formats avec séparateurs (01 23 45 67 89, 01-23-45-67-89, 01.23.45.67.89, etc.)
    // Au moins 8 chiffres au total avec des séparateurs optionnels
    const formattedPhoneRegex = /\d{2}[\s\-\.]\d{2}[\s\-\.]\d{2}[\s\-\.]\d{2}[\s\-\.]?\d{0,2}/g;
    if (formattedPhoneRegex.test(text)) {
      return true;
    }
    
    // Détecter les formats avec indicatif pays (+33, 0033, 33, +225, 00225, 225)
    // Exemples: +33 1 23 45 67 89, 0033 1 23 45 67 89, 33 1 23 45 67 89, +225 07 07 42 48 57
    const withCountryCodeRegex = /(\+33|0033|33|\+225|00225|225)[\s\-\.]?[1-9][\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g;
    if (withCountryCodeRegex.test(text)) {
      return true;
    }
    
    // Détecter les numéros avec préfixes courants (07, 01, 02, etc. pour la Côte d'Ivoire et la France)
    const prefixRegex = /(07|01|02|03|04|05|06|09)[\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g;
    if (prefixRegex.test(text)) {
      return true;
    }
    
    return false;
  };

  // Fermer le popup si le numéro est retiré du message
  useEffect(() => {
    if (phoneError && newMessage) {
      const hasPhone = containsPhoneNumber(newMessage);
      if (!hasPhone) {
        setPhoneError(false);
      }
    }
  }, [newMessage, phoneError]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user || sending) {
      return;
    }

    // Vérifier si le message contient un numéro de téléphone
    if (containsPhoneNumber(newMessage)) {
      Alert.alert(
        t('messages.phoneDetected'),
        t('messages.phoneDetectedDesc'),
        [
          {
            text: t('messages.phoneDetectedOk'),
            onPress: () => setPhoneError(false),
            style: 'default',
          },
        ]
      );
      setPhoneError(true);
      return;
    }

    try {
      await sendMessage(selectedConversation.id, newMessage, user.id);
      setNewMessage('');
      setPhoneError(false);
    } catch (err) {
      Alert.alert(t('common.error'), t('messages.sendError'));
    }
  };

  const handleBackToConversations = () => {
    console.log('🔙 [MessagingScreen] handleBackToConversations appelé', { openedFromParam, propertyId, vehicleId });
    
    // Toujours retourner à la liste locale des conversations
    // Si on est dans l'onglet MessagingTab, on reste dans l'onglet
    console.log('🔙 [MessagingScreen] Retour à la liste des conversations');
    setSelectedConversation(null);
    setShowConversations(true);
    setOpenedFromParam(false); // Réinitialiser le flag
  };

  const handleRefresh = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      await loadConversations(user.id);
    } catch (error) {
      console.error('Erreur lors de l\'actualisation:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getOtherUserName = (conversation: Conversation) => {
    if (user?.id === conversation.guest_id) {
      if (!conversation.host_profile) return 'Hôte';
      const firstName = String(conversation.host_profile.first_name ?? '').trim();
      const lastName = String(conversation.host_profile.last_name ?? '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || 'Hôte';
    }
    if (!conversation.guest_profile) return 'Invité';
    const firstName = String(conversation.guest_profile.first_name ?? '').trim();
    const lastName = String(conversation.guest_profile.last_name ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Invité';
  };

  // Si l'utilisateur n'est pas connecté, afficher le bouton de connexion
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>{t('auth.loginRequired')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('messages.loginRequiredDesc')}
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.exploreButtonText}>{t('auth.login')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      isOwn={item.sender_id === user?.id}
      showAvatar={false}
    />
  );

  const renderConversationList = () => (
    <View style={styles.conversationContainer}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>{t('messages.title')}</Text>
        <TouchableOpacity
          style={styles.searchButton}
            onPress={() => Alert.alert(t('search.title'), t('messages.comingSoon'))}
        >
          <Ionicons name="search" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ConversationList
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        loading={loading}
        currentUserId={user?.id}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />
    </View>
  );

  const renderChatView = () => {
    if (!selectedConversation) return null;

    return (
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header de la conversation */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToConversations}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {getOtherUserName(selectedConversation)}
            </Text>
            <Text style={styles.chatSubtitle} numberOfLines={1}>
              {selectedConversation.property?.title 
                ? selectedConversation.property.title
                : selectedConversation.vehicle
                  ? `${selectedConversation.vehicle.brand} ${selectedConversation.vehicle.model}${selectedConversation.vehicle.year ? ` (${selectedConversation.vehicle.year})` : ''}`
                  : t('messages.property')}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          refreshControl={
          <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007AFF']}
              tintColor="#007AFF"
            />
          }
        />

        {/* Zone de saisie */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={t('messages.typeMessage')}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newMessage.trim() || sending) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>{t('common.error')}</Text>
          <Text style={styles.errorMessage}>{String(error ?? t('common.errorOccurred'))}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => user && loadConversations(user.id)}
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {showConversations ? renderConversationList() : renderChatView()}
      
      {/* Menu de navigation en bas - seulement si on est dans le Stack, pas dans le TabNavigator */}
      {showConversations && !isInTabNavigator && <BottomNavigationBar activeScreen="messages" />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  conversationContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 0, // S'assurer qu'il n'y a pas d'espace en haut
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    flex: 1, // Prendre l'espace disponible
  },
  searchButton: {
    padding: 8,
    marginLeft: 8, // Espacement depuis le titre
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  chatSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default MessagingScreen;