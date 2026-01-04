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
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Africa/Abidjan'
        }) || '';
      } else if (diffInHours < 168) { // 7 jours
        return date.toLocaleDateString('fr-FR', { 
          weekday: 'short',
          timeZone: 'Africa/Abidjan'
        }) || '';
      } else {
        return date.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit',
          timeZone: 'Africa/Abidjan'
        }) || '';
      }
    } catch (error) {
      return '';
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
      const firstName = String(otherUser.first_name ?? '').trim();
      const lastName = String(otherUser.last_name ?? '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || 'Utilisateur';
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
    
    const message = String(conversation.last_message.message ?? '');
    // Tronquer le message s'il est trop long
    if (message.length > 50) {
      return message.substring(0, 50) + '...';
    }
    return message || 'Aucun message';
  };

  const isLastMessageFromCurrentUser = (conversation: Conversation) => {
    if (!conversation.last_message || !currentUserId) return false;
    return conversation.last_message.sender_id === currentUserId;
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const avatarUrl = getOtherUserAvatar(item);
    
    return (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => onSelectConversation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image
            source={{ uri: String(avatarUrl) }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
        )}
        {(item.unread_count ?? 0) > 0 && (
          <View style={styles.unreadDot} />
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
          {item.property?.title 
            ? item.property.title 
            : item.vehicle 
              ? `${item.vehicle.brand} ${item.vehicle.model}${item.vehicle.year ? ` (${item.vehicle.year})` : ''}`
              : 'Propriété/Véhicule'}
        </Text>
        
        <View style={styles.lastMessageContainer}>
          {isLastMessageFromCurrentUser(item) && (
            <Text style={styles.youLabel}>Vous: </Text>
          )}
          <Text 
            style={[
              styles.lastMessage,
              (item.unread_count ?? 0) > 0 && styles.unreadMessage
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
  };

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
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0A84FF',
    borderWidth: 2,
    borderColor: '#fff',
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
