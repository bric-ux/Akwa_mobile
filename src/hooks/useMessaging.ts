import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Conversation, Message } from '../types';

export const useMessaging = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les conversations de l'utilisateur
  const loadConversations = useCallback(async (userId: string) => {
    console.log('🔄 [useMessaging] Chargement des conversations pour:', userId);
    setLoading(true);
    setError(null);
    
    try {
      // D'abord, testons une requête simple
      console.log('🔄 [useMessaging] Test requête simple...');
      const { data: simpleData, error: simpleError } = await supabase
        .from('conversations')
        .select('*')
        .or(`guest_id.eq.${userId},host_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (simpleError) {
        console.error('❌ [useMessaging] Erreur requête simple:', simpleError);
        throw simpleError;
      }

      console.log('✅ [useMessaging] Requête simple réussie:', simpleData?.length || 0, 'conversations');

      // Ensuite, testons la requête complète
      console.log('🔄 [useMessaging] Test requête complète...');
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          property:properties(
            id,
            title,
            images
          ),
          host_profile:profiles!conversations_host_id_fkey(
            first_name,
            last_name,
            avatar_url
          ),
          guest_profile:profiles!conversations_guest_id_fkey(
            first_name,
            last_name,
            avatar_url
          )
        `)
        .or(`guest_id.eq.${userId},host_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ [useMessaging] Erreur requête complète, utilisation des données simples:', error);
        // Utiliser les données simples si la requête complète échoue
        const conversationsWithProfiles = simpleData?.map(conv => ({
          ...conv,
          property: null,
          host_profile: null,
          guest_profile: null
        })) || [];
        setConversations(conversationsWithProfiles);
        return;
      }

      console.log('✅ [useMessaging] Conversations chargées:', data?.length || 0);
      console.log('📋 [useMessaging] Détails des conversations:', data);
      setConversations(data || []);
    } catch (err) {
      console.error('❌ [useMessaging] Erreur lors du chargement des conversations:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select(`
          *,
          sender_profile:profiles!conversation_messages_sender_id_fkey(
            first_name,
            last_name
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const messagesWithNames = (data || []).map(msg => ({
        ...msg,
        sender_name: msg.sender_profile 
          ? `${msg.sender_profile.first_name} ${msg.sender_profile.last_name}`.trim()
          : 'Utilisateur'
      }));

      setMessages(messagesWithNames);
    } catch (err) {
      console.error('Erreur lors du chargement des messages:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Envoyer un message
  const sendMessage = useCallback(async (
    conversationId: string, 
    message: string, 
    senderId: string
  ) => {
    setSending(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          message: message.trim(),
          message_type: 'text'
        })
        .select(`
          *,
          sender_profile:profiles!conversation_messages_sender_id_fkey(
            first_name,
            last_name
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      // Ajouter le message à la liste locale
      const newMessage = {
        ...data,
        sender_name: data.sender_profile 
          ? `${data.sender_profile.first_name} ${data.sender_profile.last_name}`.trim()
          : 'Vous'
      };

      setMessages(prev => [...prev, newMessage]);

      // Mettre à jour la conversation
      await supabase
        .from('conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          last_message: message.trim()
        })
        .eq('id', conversationId);

      return newMessage;
    } catch (err) {
      console.error('Erreur lors de l\'envoi du message:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  // Créer ou récupérer une conversation
  const createOrGetConversation = useCallback(async (
    propertyId: string,
    hostId: string,
    guestId: string
  ) => {
    try {
      // Vérifier si une conversation existe déjà
      const { data: existing, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('property_id', propertyId)
        .or(`and(guest_id.eq.${guestId},host_id.eq.${hostId}),and(guest_id.eq.${hostId},host_id.eq.${guestId})`)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        return existing.id;
      }

      // Créer une nouvelle conversation
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          property_id: propertyId,
          guest_id: guestId,
          host_id: hostId
        })
        .select('id')
        .single();

      if (createError) {
        throw createError;
      }

      return newConversation.id;
    } catch (err) {
      console.error('Erreur lors de la création/récupération de conversation:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    }
  }, []);

  // Marquer les messages comme lus
  const markMessagesAsRead = useCallback(async (conversationId: string, userId: string) => {
    try {
      await supabase
        .from('conversation_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .is('read_at', null);
    } catch (err) {
      console.error('Erreur lors du marquage des messages comme lus:', err);
    }
  }, []);

  // Configuration du temps réel
  const setupRealtimeSubscription = useCallback((userId: string) => {
    console.log('🔔 Configuration du temps réel pour l\'utilisateur:', userId);
    
    const channel = supabase
      .channel('messaging-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages'
        },
        async (payload) => {
          console.log('📨 Nouveau message reçu:', payload);
          const newMessage = payload.new as Message;
          
          // Vérifier si le message appartient à une conversation de l'utilisateur
          const isRelevantMessage = await checkIfMessageIsRelevant(newMessage, userId);
          if (!isRelevantMessage) return;
          
          // Ajouter le message à la liste locale
          setMessages(prev => {
            // Éviter les doublons
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          
          // Mettre à jour la conversation dans la liste
          setConversations(prev => 
            prev.map(conv => 
              conv.id === newMessage.conversation_id 
                ? { ...conv, updated_at: new Date().toISOString() }
                : conv
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `or(guest_id.eq.${userId},host_id.eq.${userId})`
        },
        (payload) => {
          console.log('💬 Conversation mise à jour:', payload);
          const updatedConversation = payload.new as Conversation;
          
          setConversations(prev => 
            prev.map(conv => 
              conv.id === updatedConversation.id 
                ? { ...conv, ...updatedConversation }
                : conv
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut de la souscription:', status);
      });

    return () => {
      console.log('🔌 Nettoyage de la souscription temps réel');
      supabase.removeChannel(channel);
    };
  }, []);

  // Vérifier si un message est pertinent pour l'utilisateur
  const checkIfMessageIsRelevant = async (message: Message, userId: string) => {
    try {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('guest_id, host_id')
        .eq('id', message.conversation_id)
        .single();
      
      return conversation && (conversation.guest_id === userId || conversation.host_id === userId);
    } catch (error) {
      console.error('Erreur lors de la vérification du message:', error);
      return false;
    }
  };

  return {
    conversations,
    messages,
    loading,
    sending,
    error,
    loadConversations,
    loadMessages,
    sendMessage,
    createOrGetConversation,
    markMessagesAsRead,
    setupRealtimeSubscription
  };
};
