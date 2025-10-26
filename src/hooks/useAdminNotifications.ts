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
        .select('id, user_id, document_type, uploaded_at')
        .is('verified', null)
        .order('uploaded_at', { ascending: false });

      if (identityError) throw identityError;

      // Charger les profils des utilisateurs pour les documents
      const userIds = identityDocs?.map(doc => doc.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Créer un mapping des profils
      const profileMap: Record<string, any> = {};
      profiles?.forEach(profile => {
        profileMap[profile.user_id] = profile;
      });

      // Charger les nouvelles propriétés (dernières 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: newProperties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, created_at, host_id')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false });

      if (propertiesError) throw propertiesError;

      // Charger les profils des hôtes pour les propriétés
      const hostIds = newProperties?.map(prop => prop.host_id) || [];
      const { data: hostProfiles, error: hostProfilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', hostIds);

      if (hostProfilesError) throw hostProfilesError;

      // Créer un mapping des profils hôtes
      const hostProfileMap: Record<string, any> = {};
      hostProfiles?.forEach(profile => {
        hostProfileMap[profile.user_id] = profile;
      });

      // Transformer en notifications
      const identityNotifications: AdminNotification[] = (identityDocs || []).map(doc => {
        const profile = profileMap[doc.user_id];
        return {
          id: `identity-${doc.id}`,
          type: 'identity_document',
          title: 'Nouveau document d\'identité',
          message: `${profile?.first_name || 'Utilisateur'} ${profile?.last_name || ''} a uploadé un document d'identité`,
          data: {
            documentId: doc.id,
            userId: doc.user_id,
            documentType: doc.document_type,
            userName: `${profile?.first_name || 'Utilisateur'} ${profile?.last_name || ''}`,
            userEmail: profile?.email || ''
          },
          read: false,
          created_at: doc.uploaded_at
        };
      });

      const propertyNotifications: AdminNotification[] = (newProperties || []).map(property => {
        const profile = hostProfileMap[property.host_id];
        return {
          id: `property-${property.id}`,
          type: 'property_media',
          title: 'Nouvelle propriété créée',
          message: `${profile?.first_name || 'Hôte'} ${profile?.last_name || ''} a créé une nouvelle propriété`,
          data: {
            propertyId: property.id,
            propertyTitle: property.title,
            hostName: `${profile?.first_name || 'Hôte'} ${profile?.last_name || ''}`,
            hostEmail: profile?.email || ''
          },
          read: false,
          created_at: property.created_at
        };
      });

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

