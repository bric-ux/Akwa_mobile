import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Conversation, Message } from '../types';
import { useEmailService } from './useEmailService';
import { sendPushToUser } from '../services/pushNotificationService';
import { log, logError, logWarn } from '../utils/logger';

export const useMessaging = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sendNewMessage } = useEmailService();

  // Charger les conversations de l'utilisateur
  const loadConversations = useCallback(async (userId: string) => {
    log('🔄 [useMessaging] Chargement des conversations pour:', userId);
    setLoading(true);
    setError(null);
    
    try {
      // D'abord, testons une requête simple
      log('🔄 [useMessaging] Test requête simple...');
      const { data: simpleData, error: simpleError } = await supabase
        .from('conversations')
        .select('*')
        .or(`guest_id.eq.${userId},host_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (simpleError) {
        logError('❌ [useMessaging] Erreur requête simple:', simpleError);
        throw simpleError;
      }

      log('✅ [useMessaging] Requête simple réussie:', simpleData?.length || 0, 'conversations');

      // Ensuite, testons la requête complète (comme sur le site web)
      log('🔄 [useMessaging] Test requête complète...');
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          property:properties(
            id,
            title,
            images
          ),
          vehicle:vehicles(
            id,
            brand,
            model,
            year,
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
        const conversationsWithProfiles = await Promise.all(
          (simpleData || []).map(async (conv) => {
            try {
              const { data: lastMessageData, error: lastMessageError } = await supabase
                .from('conversation_messages')
                .select('*')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (lastMessageError && lastMessageError.code !== 'PGRST116') {
                console.error('❌ [useMessaging] Erreur lors du chargement du dernier message (simple):', lastMessageError);
              }

              return {
                ...conv,
                property: null,
                host_profile: null,
                guest_profile: null,
                last_message: lastMessageData || null
              };
            } catch (err) {
              console.error('❌ [useMessaging] Erreur lors du chargement du dernier message (simple) pour la conversation:', conv.id, err);
              return {
                ...conv,
                property: null,
                host_profile: null,
                guest_profile: null,
                last_message: null
              };
            }
          })
        );

        // Filtrer les conversations sans messages
        const conversationsWithMessages = conversationsWithProfiles.filter(conv => conv.last_message !== null);
        
        // Supprimer les conversations vides de la base de données
        const emptyConversationIds = conversationsWithProfiles
          .filter(conv => conv.last_message === null)
          .map(conv => conv.id);
        
        if (emptyConversationIds.length > 0) {
          console.log('🗑️ [useMessaging] Suppression de', emptyConversationIds.length, 'conversations vides');
          // Supprimer en arrière-plan sans bloquer
          supabase
            .from('conversations')
            .delete()
            .in('id', emptyConversationIds)
            .then(({ error }) => {
              if (error) {
                console.error('❌ [useMessaging] Erreur lors de la suppression des conversations vides:', error);
              } else {
                console.log('✅ [useMessaging] Conversations vides supprimées');
              }
            });
        }

        // Trier les conversations par date du dernier message (les plus récentes en haut)
        conversationsWithMessages.sort((a, b) => {
          const dateA = a.last_message?.created_at || a.updated_at || '';
          const dateB = b.last_message?.created_at || b.updated_at || '';
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

        console.log('✅ [useMessaging] Conversations avec messages (filtrées):', conversationsWithMessages.length, 'sur', conversationsWithProfiles.length);
        setConversations(conversationsWithMessages);
        return;
      }

      console.log('✅ [useMessaging] Conversations chargées:', data?.length || 0);
      console.log('📋 [useMessaging] Détails des conversations:', data);
      
      // Charger les derniers messages pour chaque conversation
      const conversationsWithLastMessages = await Promise.all(
        (data || []).map(async (conversation) => {
          try {
            const { data: lastMessageData, error: lastMessageError } = await supabase
              .from('conversation_messages')
              .select('*')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (lastMessageError && lastMessageError.code !== 'PGRST116') {
              console.error('❌ [useMessaging] Erreur lors du chargement du dernier message:', lastMessageError);
            }

            // Compter les messages non lus pour l'utilisateur courant
            let unread_count = 0;
            try {
              // Compter uniquement les messages reçus (non envoyés par l'utilisateur) et non lus
              const { data: unreadList, error: unreadError } = await supabase
                .from('conversation_messages')
                .select('id, read_at, sender_id')
                .eq('conversation_id', conversation.id)
                .neq('sender_id', userId)
                .is('read_at', null);

              if (unreadError) {
                console.warn('⚠️ [useMessaging] Erreur comptage non lus:', unreadError);
              } else {
                unread_count = (unreadList || []).length;
                // Log détaillé pour debug
                if (unread_count > 0) {
                  console.log(`📊 [useMessaging] Conversation ${conversation.id}: ${unread_count} messages non lus`);
                  console.log(`📊 [useMessaging] Messages non lus:`, unreadList?.map(m => ({ id: m.id, sender: m.sender_id, read_at: m.read_at })));
                } else {
                  console.log(`✅ [useMessaging] Conversation ${conversation.id}: 0 messages non lus`);
                }
              }
            } catch (ucErr) {
              console.warn('⚠️ [useMessaging] Comptage non lus (fallback):', ucErr);
              unread_count = 0;
            }

            return {
              ...conversation,
              last_message: lastMessageData || null,
              unread_count,
            };
          } catch (err) {
            console.error('❌ [useMessaging] Erreur lors du chargement du dernier message pour la conversation:', conversation.id, err);
            return {
              ...conversation,
              last_message: null,
              unread_count: 0,
            };
          }
        })
      );

      // Filtrer les conversations sans messages
      const conversationsWithMessages = conversationsWithLastMessages.filter(conv => conv.last_message !== null);
      
      // Supprimer les conversations vides de la base de données
      const emptyConversationIds = conversationsWithLastMessages
        .filter(conv => conv.last_message === null)
        .map(conv => conv.id);
      
      if (emptyConversationIds.length > 0) {
        console.log('🗑️ [useMessaging] Suppression de', emptyConversationIds.length, 'conversations vides');
        // Supprimer en arrière-plan sans bloquer
        supabase
          .from('conversations')
          .delete()
          .in('id', emptyConversationIds)
          .then(({ error }) => {
            if (error) {
              console.error('❌ [useMessaging] Erreur lors de la suppression des conversations vides:', error);
            } else {
              console.log('✅ [useMessaging] Conversations vides supprimées');
            }
          });
      }

      // Trier les conversations par date du dernier message (les plus récentes en haut)
      conversationsWithMessages.sort((a, b) => {
        const dateA = a.last_message?.created_at || a.updated_at || '';
        const dateB = b.last_message?.created_at || b.updated_at || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      console.log('✅ [useMessaging] Conversations avec messages (filtrées et triées):', conversationsWithMessages.length, 'sur', conversationsWithLastMessages.length);
      setConversations(conversationsWithMessages);
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

      // Envoyer email de notification au destinataire
      try {
        // Récupérer les détails de la conversation pour l'email
        const { data: conversationData } = await supabase
          .from('conversations')
          .select(`
            *,
            property:properties(title),
            host_profile:profiles!conversations_host_id_fkey(first_name, last_name, email),
            guest_profile:profiles!conversations_guest_id_fkey(first_name, last_name, email)
          `)
          .eq('id', conversationId)
          .single();

        if (conversationData) {
          // Déterminer qui est le destinataire
          const isHost = senderId === conversationData.host_id;
          const recipientProfile = isHost ? conversationData.guest_profile : conversationData.host_profile;
          const senderProfile = isHost ? conversationData.host_profile : conversationData.guest_profile;

          if (recipientProfile?.email) {
            await sendNewMessage(
              recipientProfile.email,
              `${recipientProfile.first_name} ${recipientProfile.last_name}`,
              `${senderProfile?.first_name} ${senderProfile?.last_name}`,
              conversationData.property?.title || 'Propriété',
              message.trim()
            );
            console.log('✅ [useMessaging] Email de notification envoyé à:', recipientProfile.email);
          }
          // Notification push sur le téléphone du destinataire (sans email)
          const recipientUserId = isHost ? conversationData.guest_id : conversationData.host_id;
          const senderName = senderProfile?.first_name ? `${senderProfile.first_name} ${senderProfile.last_name || ''}`.trim() : 'Quelqu\'un';
          const body = `${senderName} : ${message.trim().slice(0, 80)}${message.trim().length > 80 ? '...' : ''}`;
          sendPushToUser(recipientUserId, 'Nouveau message', body).catch(() => {});
        }
      } catch (emailError) {
        console.error('❌ [useMessaging] Erreur envoi email notification:', emailError);
        // Ne pas faire échouer l'envoi du message si l'email échoue
      }

      return newMessage;
    } catch (err) {
      console.error('Erreur lors de l\'envoi du message:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  // Créer ou récupérer une conversation (comme sur le site web)
  const createOrGetConversation = useCallback(async (
    propertyId?: string,
    hostId?: string,
    guestId?: string,
    vehicleId?: string,
    title?: string
  ) => {
    try {
      // Vérifier qu'on a au moins propertyId ou vehicleId
      if (!propertyId && !vehicleId) {
        throw new Error('propertyId ou vehicleId requis');
      }

      if (!hostId || !guestId) {
        throw new Error('hostId et guestId requis');
      }

      // Chercher une conversation existante (comme sur le site web)
      let existingQuery = supabase
        .from('conversations')
        .select('id');
      
      if (propertyId) {
        existingQuery = existingQuery.eq('property_id', propertyId);
      } else if (vehicleId) {
        existingQuery = existingQuery.eq('vehicle_id', vehicleId);
      }
      
      const { data: existing, error: fetchError } = await existingQuery
        .or(`and(guest_id.eq.${guestId},host_id.eq.${hostId}),and(guest_id.eq.${hostId},host_id.eq.${guestId})`)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        console.log('✅ [useMessaging] Conversation existante trouvée:', existing.id);
        return existing.id;
      }

      // Créer une nouvelle conversation (comme sur le site web)
      const insertData: any = {
        guest_id: guestId,
        host_id: hostId
      };
      
      if (propertyId) {
        insertData.property_id = propertyId;
      } else if (vehicleId) {
        insertData.vehicle_id = vehicleId;
      }

      // Ne pas insérer title : la colonne peut être absente (migration non appliquée).
      // L’affichage utilise property.title / vehicle en fallback dans ConversationList.

      console.log('🟡 [useMessaging] Création nouvelle conversation avec:', insertData);
      
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert(insertData)
        .select('id')
        .single();

      if (createError) {
        console.error('❌ [useMessaging] Erreur création conversation:', createError);
        throw createError;
      }

      // Mise à jour du titre désactivée (colonne title optionnelle)
      if (false && existing && title) {
        await supabase
          .from('conversations')
          .update({ title })
          .eq('id', existing.id);
      }

      console.log('✅ [useMessaging] Nouvelle conversation créée:', newConversation.id);
      return newConversation.id;
    } catch (err) {
      console.error('❌ [useMessaging] Erreur lors de la création/récupération de conversation:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    }
  }, []);

  // Marquer les messages comme lus
  const markMessagesAsRead = useCallback(async (conversationId: string, userId: string) => {
    try {
      // Utiliser la fonction SQL qui est SECURITY DEFINER et devrait contourner les problèmes RLS
      const { error: functionError } = await supabase.rpc('mark_messages_as_read', {
        conversation_uuid: conversationId,
        user_uuid: userId
      });

      if (functionError) {
        console.warn('⚠️ [useMessaging] Erreur avec la fonction SQL, essai avec UPDATE direct:', functionError);
        // Fallback: utiliser UPDATE direct avec une syntaxe différente
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('conversation_messages')
          .update({ read_at: now })
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId)
          .is('read_at', null)
          .select('id');

        if (error) {
          console.error('❌ [useMessaging] Erreur lors du marquage des messages comme lus (UPDATE):', error);
          throw error;
        }

        console.log('✅ [useMessaging] Messages marqués comme lus (UPDATE):', data?.length || 0, 'messages');
      } else {
        console.log('✅ [useMessaging] Messages marqués comme lus (fonction SQL) pour la conversation', conversationId);
        
        // Vérifier le nombre de messages non lus après le marquage pour confirmer
        const { data: verificationData } = await supabase
          .from('conversation_messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId)
          .is('read_at', null);
        
        const remainingUnread = (verificationData || []).length;
        if (remainingUnread > 0) {
          console.warn(`⚠️ [useMessaging] Il reste ${remainingUnread} messages non lus après marquage`);
        }
      }
      
      // Mettre à jour localement le compteur non lus
      const now = new Date().toISOString();
      setConversations(prev => prev.map(c => {
        if (c.id !== conversationId) return c;
        return { ...c, unread_count: 0 };
      }));

      // Mettre à jour aussi les messages locaux si on est dans cette conversation
      setMessages(prev => prev.map(msg => {
        if (msg.conversation_id === conversationId && msg.sender_id !== userId && !msg.read_at) {
          return { ...msg, read_at: now };
        }
        return msg;
      }));
    } catch (err) {
      console.error('❌ [useMessaging] Erreur lors du marquage des messages comme lus:', err);
    }
  }, []);

  // Réinitialiser localement le compteur non lus (utile lors de la sélection)
  const clearUnreadForConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c));
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
          setConversations(prev => prev.map(conv => {
            if (conv.id !== newMessage.conversation_id) return conv;
            const isFromSelf = newMessage.sender_id === userId;
            // Incrémenter non-lus uniquement si message reçu (pas envoyé par soi)
            const nextUnread = isFromSelf ? (conv.unread_count || 0) : (conv.unread_count || 0) + 1;
            return { ...conv, updated_at: new Date().toISOString(), unread_count: nextUnread };
          }));
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
    setupRealtimeSubscription,
    clearUnreadForConversation
  };
};
