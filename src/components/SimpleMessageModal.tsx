import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

interface SimpleMessage {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
}

interface SimpleMessageModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  vehicleId?: string;
  otherParticipant: {
    id: string;
    name: string;
    isHost: boolean;
  } | null;
}

const SimpleMessageModal: React.FC<SimpleMessageModalProps> = ({
  visible,
  onClose,
  bookingId,
  vehicleId,
  otherParticipant,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && otherParticipant && user) {
      initializeConversation();
    }
  }, [visible, otherParticipant, user]);

  if (!otherParticipant || !user) {
    return null;
  }

  const initializeConversation = async () => {
    setLoading(true);
    try {
      let vehId: string | null = vehicleId || null;

      if (!vehId && bookingId) {
        const { data: vehicleBooking } = await supabase
          .from('vehicle_bookings')
          .select('vehicle_id')
          .eq('id', bookingId)
          .maybeSingle();

        if (vehicleBooking?.vehicle_id) {
          vehId = vehicleBooking.vehicle_id;
        }
      }

      if (!vehId) {
        console.error('Vehicle ID not found');
        return;
      }

      // Chercher ou créer une conversation
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('vehicle_id', vehId)
        .eq('booking_id', bookingId)
        .maybeSingle();

      let convId: string;

      if (existingConversation) {
        convId = existingConversation.id;
      } else {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            vehicle_id: vehId,
            booking_id: bookingId,
            participant1_id: user.id,
            participant2_id: otherParticipant.id,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        convId = newConversation.id;
      }

      setConversationId(convId);

      // Charger les messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);
    } catch (error) {
      console.error('Error initializing conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          message: newMessage.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setMessages([...messages, data]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getInitials(otherParticipant.name)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.headerName}>{otherParticipant.name}</Text>
                  <Text style={styles.headerRole}>
                    {otherParticipant.isHost ? 'Hôte' : 'Voyageur'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#1e293b" />
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyText}>Aucun message pour le moment.</Text>
                  <Text style={styles.emptySubtext}>Commencez la conversation !</Text>
                </View>
              ) : (
                messages.map((message) => {
                  const isMe = message.sender_id === user?.id;
                  return (
                    <View
                      key={message.id}
                      style={[styles.messageWrapper, isMe ? styles.messageWrapperRight : styles.messageWrapperLeft]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            isMe ? styles.messageTextMe : styles.messageTextOther,
                          ]}
                        >
                          {message.message}
                        </Text>
                        <Text
                          style={[
                            styles.messageTime,
                            isMe ? styles.messageTimeMe : styles.messageTimeOther,
                          ]}
                        >
                          {formatTime(message.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Tapez votre message..."
                multiline
                editable={!!conversationId}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!newMessage.trim() || !conversationId) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || !conversationId || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerRole: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  messageWrapper: {
    marginBottom: 12,
  },
  messageWrapperLeft: {
    alignItems: 'flex-start',
  },
  messageWrapperRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleMe: {
    backgroundColor: '#1e293b',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#fff',
  },
  messageTextOther: {
    color: '#1e293b',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeOther: {
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
});

export default SimpleMessageModal;

