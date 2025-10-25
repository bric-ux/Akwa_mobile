import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface AdminNotification {
  id: string;
  type: 'identity_document' | 'property_media' | 'new_user' | 'booking';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

export const useAdminNotifications = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNotifications();
      
      // Écouter les changements en temps réel
      const channel = supabase
        .channel('admin-notifications')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'identity_documents' 
          }, 
          () => {
            loadNotifications();
          }
        )
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'properties' 
          }, 
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Charger les documents d'identité en attente
      const { data: identityDocs, error: identityError } = await supabase
        .from('identity_documents')
        .select(`
          id,
          user_id,
          document_type,
          uploaded_at,
          profiles!inner(first_name, last_name, email)
        `)
        .eq('verified', null)
        .order('uploaded_at', { ascending: false });

      if (identityError) throw identityError;

      // Charger les nouvelles propriétés (dernières 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: newProperties, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          created_at,
          profiles!inner(first_name, last_name, email)
        `)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;

      // Transformer en notifications
      const identityNotifications: AdminNotification[] = (identityDocs || []).map(doc => ({
        id: `identity-${doc.id}`,
        type: 'identity_document',
        title: 'Nouveau document d\'identité',
        message: `${doc.profiles.first_name || 'Utilisateur'} ${doc.profiles.last_name || ''} a uploadé un document d'identité`,
        data: {
          documentId: doc.id,
          userId: doc.user_id,
          documentType: doc.document_type,
          userName: `${doc.profiles.first_name || 'Utilisateur'} ${doc.profiles.last_name || ''}`,
          userEmail: doc.profiles.email || ''
        },
        read: false,
        created_at: doc.uploaded_at
      }));

      const propertyNotifications: AdminNotification[] = (newProperties || []).map(property => ({
        id: `property-${property.id}`,
        type: 'property_media',
        title: 'Nouvelle propriété créée',
        message: `${property.profiles.first_name} ${property.profiles.last_name} a créé une nouvelle propriété`,
        data: {
          propertyId: property.id,
          propertyTitle: property.title,
          hostName: `${property.profiles.first_name} ${property.profiles.last_name}`,
          hostEmail: property.profiles.email
        },
        read: false,
        created_at: property.created_at
      }));

      const allNotifications = [...identityNotifications, ...propertyNotifications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.length);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    // Dans une vraie implémentation, on pourrait marquer comme lu en base
    // Pour l'instant, on met juste à jour l'état local
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead
  };
};
