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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMessaging } from '../hooks/useMessaging';
import { Conversation, Message } from '../types';
import ConversationList from '../components/ConversationList';
import MessageBubble from '../components/MessageBubble';

const { height: screenHeight } = Dimensions.get('window');

const MessagingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  
  // Récupérer l'ID de conversation et de propriété depuis les paramètres de navigation
  const conversationId = (route.params as any)?.conversationId;
  const propertyId = (route.params as any)?.propertyId;
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
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Charger les conversations au montage
  useEffect(() => {
    if (user) {
      console.log('📱 [MessagingScreen] Chargement des conversations pour l\'utilisateur:', user.id);
      loadConversations(user.id);
    }
  }, [user, loadConversations]);

  // Ouvrir automatiquement une conversation si un ID est fourni
  useEffect(() => {
    if (conversationId && !openedFromParam && conversations.length > 0) {
      const conversation = conversations.find(conv => conv.id === conversationId);
      if (conversation) {
        console.log('🎯 [MessagingScreen] Ouverture automatique de la conversation:', conversationId);
        setSelectedConversation(conversation);
        setShowConversations(false);
        setOpenedFromParam(true);
        // Nettoyer le param conversationId pour éviter les réouvertures ultérieures
        // Mais garder propertyId pour le retour
        try {
          (navigation as any).setParams({ conversationId: undefined });
        } catch {}
      }
    }
  }, [conversationId, conversations, openedFromParam, navigation]);

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

  // Charger les messages quand une conversation est sélectionnée
  useEffect(() => {
    if (selectedConversation && user) {
      loadMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id, user.id);
    }
  }, [selectedConversation, user, loadMessages, markMessagesAsRead]);

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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user || sending) {
      return;
    }

    try {
      await sendMessage(selectedConversation.id, newMessage, user.id);
      setNewMessage('');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    }
  };

  const handleBackToConversations = () => {
    // Si la conversation a été ouverte depuis une propriété, naviguer vers la propriété
    if (openedFromParam && propertyId) {
      (navigation as any).navigate('PropertyDetails', { propertyId });
      return;
    }
    // Sinon, retourner à la liste locale des conversations
    setSelectedConversation(null);
    setShowConversations(true);
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
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptySubtitle}>
            Vous devez être connecté pour accéder aux messages
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.exploreButtonText}>Se connecter</Text>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => Alert.alert('Recherche', 'Fonctionnalité à venir')}
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
              {String(selectedConversation.property?.title ?? 'Propriété')}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => Alert.alert('Options', 'Fonctionnalité à venir')}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
          </TouchableOpacity>
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
              placeholder="Tapez votre message..."
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
          <Text style={styles.errorTitle}>Erreur</Text>
          <Text style={styles.errorMessage}>{String(error ?? 'Une erreur est survenue')}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => user && loadConversations(user.id)}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {showConversations ? renderConversationList() : renderChatView()}
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  searchButton: {
    padding: 8,
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
  moreButton: {
    padding: 8,
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