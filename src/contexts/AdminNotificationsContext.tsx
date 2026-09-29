import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface AdminNotification {
  id: string;
  type:
    | 'identity_document'
    | 'property_media'
    | 'new_user'
    | 'booking'
    | 'monthly_listing_pending'
    | 'hotel_establishment_pending'
    | 'vehicle_pending'
    | 'monthly_candidature';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

const STORAGE_PREFIX = 'admin_notifications_read_ids:';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

async function loadReadIdSet(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

async function saveReadIdSet(userId: string, ids: Set<string>) {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

type Ctx = {
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  loadNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const AdminNotificationsContext = createContext<Ctx | null>(null);

export const AdminNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const loadGenerationRef = useRef(0);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const generation = ++loadGenerationRef.current;
    setLoading(true);
    try {
      const { data: identityDocs, error: identityError } = await supabase
        .from('identity_documents')
        .select('id, user_id, document_type, uploaded_at')
        .is('verified', null)
        .order('uploaded_at', { ascending: false })
        .limit(30);

      if (identityError) throw identityError;

      const userIds = identityDocs?.map((doc) => doc.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap: Record<string, any> = {};
      profiles?.forEach((profile) => {
        profileMap[profile.user_id] = profile;
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: newProperties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, created_at, host_id')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

      if (propertiesError) throw propertiesError;

      const hostIds = newProperties?.map((prop) => prop.host_id) || [];
      const { data: hostProfiles, error: hostProfilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', hostIds);

      if (hostProfilesError) throw hostProfilesError;

      const hostProfileMap: Record<string, any> = {};
      hostProfiles?.forEach((profile) => {
        hostProfileMap[profile.user_id] = profile;
      });

      const identityNotifications: AdminNotification[] = (identityDocs || []).map((doc) => {
        const profile = profileMap[doc.user_id];
        return {
          id: `identity-${doc.id}`,
          type: 'identity_document' as const,
          title: "Nouveau document d'identité",
          message: `${profile?.first_name || 'Utilisateur'} ${profile?.last_name || ''} a uploadé un document d'identité`,
          data: {
            documentId: doc.id,
            userId: doc.user_id,
            documentType: doc.document_type,
            userName: `${profile?.first_name || 'Utilisateur'} ${profile?.last_name || ''}`,
            userEmail: profile?.email || '',
          },
          read: false,
          created_at: doc.uploaded_at,
        };
      });

      const propertyNotifications: AdminNotification[] = (newProperties || []).map((property) => {
        const profile = hostProfileMap[property.host_id];
        return {
          id: `property-${property.id}`,
          type: 'property_media' as const,
          title: 'Nouvelle propriété créée',
          message: `${profile?.first_name || 'Hôte'} ${profile?.last_name || ''} a créé une nouvelle propriété`,
          data: {
            propertyId: property.id,
            propertyTitle: property.title,
            hostName: `${profile?.first_name || 'Hôte'} ${profile?.last_name || ''}`,
            hostEmail: profile?.email || '',
          },
          read: false,
          created_at: property.created_at,
        };
      });

      const [
        { data: pendingMonthly },
        { data: pendingHotels },
        { data: pendingVehicles },
        { data: recentCandidatures },
      ] = await Promise.all([
        supabase
          .from('monthly_rental_listings')
          .select('id, title, submitted_at, owner_id')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false })
          .limit(20),
        supabase
          .from('hotel_establishments')
          .select('id, title, submitted_at, host_id')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false })
          .limit(20),
        supabase
          .from('vehicles')
          .select('id, title, updated_at, owner_id')
          .eq('approval_status', 'pending')
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase
          .from('monthly_rental_candidatures')
          .select('id, full_name, created_at, listing_id')
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      const ownerIds = [
        ...(pendingMonthly || []).map((l) => l.owner_id),
        ...(pendingHotels || []).map((h) => h.host_id),
        ...(pendingVehicles || []).map((v) => v.owner_id),
      ].filter(Boolean);
      const listingIds = (recentCandidatures || []).map((c) => c.listing_id).filter(Boolean);

      const [{ data: ownerProfiles }, { data: listingTitles }] = await Promise.all([
        ownerIds.length
          ? supabase
              .from('profiles')
              .select('user_id, first_name, last_name')
              .in('user_id', [...new Set(ownerIds)])
          : Promise.resolve({ data: [] as any[] }),
        listingIds.length
          ? supabase.from('monthly_rental_listings').select('id, title').in('id', [...new Set(listingIds)])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const ownerMap: Record<string, any> = {};
      ownerProfiles?.forEach((p) => {
        ownerMap[p.user_id] = p;
      });
      const listingMap = Object.fromEntries((listingTitles || []).map((l) => [l.id, l.title]));

      const monthlyNotifications: AdminNotification[] = (pendingMonthly || []).map((listing) => {
        const profile = ownerMap[listing.owner_id];
        const ownerName =
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Propriétaire';
        return {
          id: `monthly-${listing.id}`,
          type: 'monthly_listing_pending' as const,
          title: 'Annonce bail à valider',
          message: `${ownerName} — ${listing.title}`,
          data: { listingId: listing.id, listingTitle: listing.title },
          read: false,
          created_at: listing.submitted_at || new Date().toISOString(),
        };
      });

      const hotelNotifications: AdminNotification[] = (pendingHotels || []).map((hotel) => {
        const profile = ownerMap[hotel.host_id];
        const hostName =
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Hôtelier';
        return {
          id: `hotel-${hotel.id}`,
          type: 'hotel_establishment_pending' as const,
          title: 'Établissement hôtel à valider',
          message: `${hostName} — ${hotel.title}`,
          data: { establishmentId: hotel.id, establishmentTitle: hotel.title },
          read: false,
          created_at: hotel.submitted_at || new Date().toISOString(),
        };
      });

      const vehicleNotifications: AdminNotification[] = (pendingVehicles || []).map((vehicle) => {
        const profile = ownerMap[vehicle.owner_id];
        const ownerName =
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Propriétaire';
        return {
          id: `vehicle-${vehicle.id}`,
          type: 'vehicle_pending' as const,
          title: 'Véhicule à valider',
          message: `${ownerName} — ${vehicle.title}`,
          data: { vehicleId: vehicle.id, vehicleTitle: vehicle.title },
          read: false,
          created_at: vehicle.updated_at || new Date().toISOString(),
        };
      });

      const candidatureNotifications: AdminNotification[] = (recentCandidatures || []).map((c) => ({
        id: `candidature-${c.id}`,
        type: 'monthly_candidature' as const,
        title: 'Nouvelle candidature bail',
        message: `${c.full_name} — ${listingMap[c.listing_id] || 'Annonce'}`,
        data: { candidatureId: c.id, listingId: c.listing_id },
        read: false,
        created_at: c.created_at,
      }));

      const sorted = [
        ...identityNotifications,
        ...propertyNotifications,
        ...monthlyNotifications,
        ...hotelNotifications,
        ...vehicleNotifications,
        ...candidatureNotifications,
      ].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (generation !== loadGenerationRef.current) return;

      const readIdsFresh = await loadReadIdSet(user.id);
      const merged = sorted.map((n) => ({ ...n, read: readIdsFresh.has(n.id) }));
      setNotifications(merged);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications admin:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      realtimeDebounceRef.current = null;
      loadNotifications();
    }, 450);
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    loadNotifications();

    const channel = supabase
      .channel('admin-notifications-mobile')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'identity_documents' },
        () => scheduleRealtimeReload()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'properties' },
        () => scheduleRealtimeReload()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monthly_rental_listings' },
        () => scheduleRealtimeReload()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hotel_establishments' },
        () => scheduleRealtimeReload()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => scheduleRealtimeReload()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'monthly_rental_candidatures' },
        () => scheduleRealtimeReload()
      )
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications, scheduleRealtimeReload]);

  const persistReadIds = useCallback(
    async (ids: Iterable<string>) => {
      if (!user) return;
      const arr = [...ids];
      const set = await loadReadIdSet(user.id);
      arr.forEach((id) => set.add(id));
      await saveReadIdSet(user.id, set);
    },
    [user]
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await persistReadIds([notificationId]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    },
    [persistReadIds]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    loadGenerationRef.current += 1;
    setNotifications((prev) => {
      if (prev.length === 0) return prev;
      const ids = prev.map((n) => n.id);
      persistReadIds(ids).catch(() => {});
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, [user, persistReadIds]);

  const value = useMemo<Ctx>(
    () => ({
      notifications,
      unreadCount,
      loading,
      loadNotifications,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, loading, loadNotifications, markAsRead, markAllAsRead]
  );

  return (
    <AdminNotificationsContext.Provider value={value}>{children}</AdminNotificationsContext.Provider>
  );
};

export function useAdminNotifications(): Ctx {
  const ctx = useContext(AdminNotificationsContext);
  if (!ctx) {
    throw new Error('useAdminNotifications must be used within AdminNotificationsProvider');
  }
  return ctx;
}
