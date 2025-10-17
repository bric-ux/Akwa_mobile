import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  onPress?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = false,
  onPress
}) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessageContent = () => {
    if (message.message_type === 'image' && message.file_url) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <Image
            source={{ uri: message.file_url }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    if (message.message_type === 'file' && message.file_url) {
      return (
        <TouchableOpacity style={styles.fileContainer} onPress={onPress}>
          <View style={styles.fileIcon}>
            <Ionicons name="document" size={20} color="#007AFF" />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {message.file_name || 'Fichier'}
            </Text>
            {message.file_size && (
              <Text style={styles.fileSize}>
                {(message.file_size / 1024).toFixed(1)} KB
              </Text>
            )}
          </View>
          <Ionicons name="download" size={16} color="#007AFF" />
        </TouchableOpacity>
      );
    }

    return (
      <Text style={[
        styles.messageText,
        isOwn ? styles.ownMessageText : styles.otherMessageText
      ]}>
        {message.message}
      </Text>
    );
  };

  return (
    <View style={[
      styles.messageContainer,
      isOwn ? styles.ownMessage : styles.otherMessage
    ]}>
      {!isOwn && showAvatar && (
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#666" />
          </View>
        </View>
      )}
      
      <View style={[
        styles.messageBubble,
        isOwn ? styles.ownBubble : styles.otherBubble
      ]}>
        {renderMessageContent()}
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isOwn ? styles.ownMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(message.created_at)}
          </Text>
          
          {isOwn && (
            <View style={styles.messageStatus}>
              <Ionicons 
                name="checkmark" 
                size={12} 
                color={message.read_at ? "#007AFF" : "#ccc"} 
              />
            </View>
          )}
        </View>
      </View>
      
      {isOwn && showAvatar && (
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#666" />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginHorizontal: 8,
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginVertical: 4,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  fileIcon: {
    marginRight: 8,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  fileSize: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#666',
  },
  messageStatus: {
    marginLeft: 4,
  },
});

export default MessageBubble;

