import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../services/AuthContext';
import { useMessaging } from '../hooks/useMessaging';

const MessagingDebugScreen: React.FC = () => {
  const { user } = useAuth();
  const { conversations, loading, error, loadConversations } = useMessaging();
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (user) {
      console.log('🔍 [Debug] Utilisateur connecté:', user.id);
      loadConversations(user.id);
    }
  }, [user, loadConversations]);

  useEffect(() => {
    const info = `
Utilisateur: ${user?.id || 'Non connecté'}
Conversations: ${conversations.length}
Loading: ${loading}
Error: ${error || 'Aucune erreur'}
    `.trim();
    setDebugInfo(info);
  }, [user, conversations, loading, error]);

  const testCreateConversation = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }

    try {
      // Créer une conversation de test
      const { createOrGetConversation } = useMessaging();
      const conversationId = await createOrGetConversation(
        'test-property-id',
        'test-host-id',
        user.id
      );
      Alert.alert('Succès', `Conversation créée: ${conversationId}`);
    } catch (error) {
      Alert.alert('Erreur', `Erreur: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Messagerie</Text>
      
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>{debugInfo}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={testCreateConversation}>
        <Text style={styles.buttonText}>Créer conversation de test</Text>
      </TouchableOpacity>

      <View style={styles.conversationsContainer}>
        <Text style={styles.subtitle}>Conversations ({conversations.length}):</Text>
        {conversations.map((conv, index) => (
          <View key={conv.id || index} style={styles.conversationItem}>
            <Text style={styles.conversationText}>
              ID: {conv.id}
            </Text>
            <Text style={styles.conversationText}>
              Host: {conv.host_id}
            </Text>
            <Text style={styles.conversationText}>
              Guest: {conv.guest_id}
            </Text>
            <Text style={styles.conversationText}>
              Property: {conv.property_id}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  debugContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  conversationsContainer: {
    flex: 1,
  },
  conversationItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  conversationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});

export default MessagingDebugScreen;

