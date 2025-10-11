import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  onSelectConversation: (conversation: Conversation) => void;
  loading?: boolean;
  currentUserId?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onSelectConversation,
  loading = false,
  currentUserId,
  onRefresh,
  refreshing = false
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) { // 7 jours
      return date.toLocaleDateString('fr-FR', { 
        weekday: 'short' 
      });
    } else {
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  const getOtherUser = (conversation: Conversation) => {
    if (currentUserId === conversation.guest_id) {
      return conversation.host_profile;
    }
    return conversation.guest_profile;
  };

  const getOtherUserName = (conversation: Conversation) => {
    const otherUser = getOtherUser(conversation);
    if (otherUser) {
      return `${otherUser.first_name} ${otherUser.last_name}`.trim();
    }
    return 'Utilisateur';
  };

  const getOtherUserAvatar = (conversation: Conversation) => {
    const otherUser = getOtherUser(conversation);
    return otherUser?.avatar_url;
  };

  const formatLastMessage = (conversation: Conversation) => {
    if (!conversation.last_message?.message) {
      return 'Aucun message';
    }
    
    const message = conversation.last_message.message;
    // Tronquer le message s'il est trop long
    if (message.length > 50) {
      return message.substring(0, 50) + '...';
    }
    return message;
  };

  const isLastMessageFromCurrentUser = (conversation: Conversation) => {
    if (!conversation.last_message || !currentUserId) return false;
    return conversation.last_message.sender_id === currentUserId;
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => onSelectConversation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {getOtherUserAvatar(item) ? (
          <Image
            source={{ uri: getOtherUserAvatar(item) }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
        )}
        {item.unread_count && item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>
              {item.unread_count > 99 ? '99+' : item.unread_count}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationTitle} numberOfLines={1}>
            {getOtherUserName(item)}
          </Text>
          <Text style={styles.conversationTime}>
            {formatTime(item.updated_at)}
          </Text>
        </View>
        
        <Text style={styles.propertyTitle} numberOfLines={1}>
          {item.property?.title || 'Propriété'}
        </Text>
        
        <View style={styles.lastMessageContainer}>
          {isLastMessageFromCurrentUser(item) && (
            <Text style={styles.youLabel}>Vous: </Text>
          )}
          <Text 
            style={[
              styles.lastMessage,
              item.unread_count && item.unread_count > 0 && styles.unreadMessage
            ]} 
            numberOfLines={2}
          >
            {formatLastMessage(item)}
          </Text>
        </View>
      </View>

      <View style={styles.conversationActions}>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune conversation</Text>
      <Text style={styles.emptySubtitle}>
        Vos conversations avec les hôtes et invités apparaîtront ici
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des conversations...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={renderConversation}
      ListEmptyComponent={renderEmptyState}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
            title="Actualisation..."
            titleColor="#666"
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: '#666',
  },
  propertyTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  youLabel: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    flex: 1,
  },
  unreadMessage: {
    color: '#000',
    fontWeight: '600',
  },
  conversationActions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ConversationList;
