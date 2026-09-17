import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { InteractionManager } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface TabNotificationBadges {
  unreadMessages: number;
  guestPropertyBookings: number;
  guestVehicleBookings: number;
  hostPropertyBookings: number;
  hostVehicleBookings: number;
  /** property_id → nombre de demandes pending non vues */
  unseenPropertyCounts: Record<string, number>;
  /** vehicle_id → nombre de demandes pending non vues */
  unseenVehicleCounts: Record<string, number>;
}

interface TabNotificationBadgesContextValue extends TabNotificationBadges {
  refresh: () => Promise<void>;
  markGuestPropertyBookingsViewed: () => Promise<void>;
  markGuestVehicleBookingsViewed: () => Promise<void>;
  /** @deprecated Préférer markHostPropertyBookingsViewedForProperty — marque tout d’un coup */
  markHostPropertyBookingsViewed: () => Promise<void>;
  /** @deprecated Préférer markHostVehicleBookingsViewedForVehicle */
  markHostVehicleBookingsViewed: () => Promise<void>;
  markHostPropertyBookingsViewedForProperty: (propertyId: string) => Promise<void>;
  markHostVehicleBookingsViewedForVehicle: (vehicleId: string) => Promise<void>;
  hasUnseenProperty: (propertyId: string) => boolean;
  hasUnseenVehicle: (vehicleId: string) => boolean;
  guestBookingsTotal: number;
  hostBookingsTotal: number;
}

const emptyBadges: TabNotificationBadges = {
  unreadMessages: 0,
  guestPropertyBookings: 0,
  guestVehicleBookings: 0,
  hostPropertyBookings: 0,
  hostVehicleBookings: 0,
  unseenPropertyCounts: {},
  unseenVehicleCounts: {},
};

const TabNotificationBadgesContext =
  createContext<TabNotificationBadgesContextValue | null>(null);

async function rpcCount(name: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc(name as never, {
    p_user_id: userId,
  } as never);
  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('does not exist')) {
      return 0;
    }
    console.warn(`[TabBadges] ${name}:`, error.message);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}

async function rpcVoid(name: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc(name as never, {
    p_user_id: userId,
  } as never);
  if (error && !error.message?.includes('does not exist')) {
    console.warn(`[TabBadges] ${name}:`, error.message);
  }
}

async function fetchUnseenPropertyCounts(
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('bookings')
    .select('property_id, properties!inner(host_id)')
    .eq('status', 'pending')
    .is('host_viewed_at', null)
    .eq('properties.host_id', userId);

  if (error) {
    console.warn('[TabBadges] unseen properties:', error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const id = row.property_id as string;
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

async function fetchUnseenVehicleCounts(
  userId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('vehicle_bookings')
    .select('vehicle_id, vehicles!inner(owner_id)')
    .eq('status', 'pending')
    .is('owner_viewed_at', null)
    .eq('vehicles.owner_id', userId);

  if (error) {
    console.warn('[TabBadges] unseen vehicles:', error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const id = row.vehicle_id as string;
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export const TabNotificationBadgesProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<TabNotificationBadges>(emptyBadges);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setBadges(emptyBadges);
      return;
    }

    const [
      unreadMessages,
      guestPropertyBookings,
      guestVehicleBookings,
      unseenPropertyCounts,
      unseenVehicleCounts,
    ] = await Promise.all([
      supabase
        .rpc('get_unread_messages_count', { user_uuid: user.id })
        .then(({ data, error }) => {
          if (error) return 0;
          return typeof data === 'number' ? data : 0;
        }),
      rpcCount('get_guest_unseen_bookings_count', user.id),
      rpcCount('get_vehicle_renter_unseen_bookings_count', user.id),
      fetchUnseenPropertyCounts(user.id),
      fetchUnseenVehicleCounts(user.id),
    ]);

    setBadges({
      unreadMessages,
      guestPropertyBookings,
      guestVehicleBookings,
      hostPropertyBookings: sumCounts(unseenPropertyCounts),
      hostVehicleBookings: sumCounts(unseenVehicleCounts),
      unseenPropertyCounts,
      unseenVehicleCounts,
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setBadges(emptyBadges);
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });
    return () => task.cancel();
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`tab-badges-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_messages' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_bookings' },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  const markGuestPropertyBookingsViewed = useCallback(async () => {
    if (!user?.id) return;
    await rpcVoid('mark_guest_property_bookings_viewed', user.id);
    setBadges((prev) => ({ ...prev, guestPropertyBookings: 0 }));
    await refresh();
  }, [user?.id, refresh]);

  const markGuestVehicleBookingsViewed = useCallback(async () => {
    if (!user?.id) return;
    await rpcVoid('mark_vehicle_renter_bookings_viewed', user.id);
    setBadges((prev) => ({ ...prev, guestVehicleBookings: 0 }));
    await refresh();
  }, [user?.id, refresh]);

  const markHostPropertyBookingsViewed = useCallback(async () => {
    if (!user?.id) return;
    await rpcVoid('mark_host_property_bookings_viewed', user.id);
    setBadges((prev) => ({
      ...prev,
      hostPropertyBookings: 0,
      unseenPropertyCounts: {},
    }));
    await refresh();
  }, [user?.id, refresh]);

  const markHostVehicleBookingsViewed = useCallback(async () => {
    if (!user?.id) return;
    await rpcVoid('mark_vehicle_owner_bookings_viewed', user.id);
    setBadges((prev) => ({
      ...prev,
      hostVehicleBookings: 0,
      unseenVehicleCounts: {},
    }));
    await refresh();
  }, [user?.id, refresh]);

  const markHostPropertyBookingsViewedForProperty = useCallback(
    async (propertyId: string) => {
      if (!user?.id || !propertyId) return;

      // Optimistic UI
      setBadges((prev) => {
        const nextCounts = { ...prev.unseenPropertyCounts };
        delete nextCounts[propertyId];
        return {
          ...prev,
          unseenPropertyCounts: nextCounts,
          hostPropertyBookings: sumCounts(nextCounts),
        };
      });

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('bookings')
        .update({ host_viewed_at: now })
        .eq('property_id', propertyId)
        .eq('status', 'pending')
        .is('host_viewed_at', null);

      if (error) {
        console.warn('[TabBadges] mark property viewed:', error.message);
        // Fallback: RPC globale trop agressive — on refresh seulement
      }
      await refresh();
    },
    [user?.id, refresh]
  );

  const markHostVehicleBookingsViewedForVehicle = useCallback(
    async (vehicleId: string) => {
      if (!user?.id || !vehicleId) return;

      setBadges((prev) => {
        const nextCounts = { ...prev.unseenVehicleCounts };
        delete nextCounts[vehicleId];
        return {
          ...prev,
          unseenVehicleCounts: nextCounts,
          hostVehicleBookings: sumCounts(nextCounts),
        };
      });

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('vehicle_bookings')
        .update({ owner_viewed_at: now })
        .eq('vehicle_id', vehicleId)
        .eq('status', 'pending')
        .is('owner_viewed_at', null);

      if (error) {
        console.warn('[TabBadges] mark vehicle viewed:', error.message);
      }
      await refresh();
    },
    [user?.id, refresh]
  );

  const hasUnseenProperty = useCallback(
    (propertyId: string) => (badges.unseenPropertyCounts[propertyId] || 0) > 0,
    [badges.unseenPropertyCounts]
  );

  const hasUnseenVehicle = useCallback(
    (vehicleId: string) => (badges.unseenVehicleCounts[vehicleId] || 0) > 0,
    [badges.unseenVehicleCounts]
  );

  const value = useMemo<TabNotificationBadgesContextValue>(
    () => ({
      ...badges,
      refresh,
      markGuestPropertyBookingsViewed,
      markGuestVehicleBookingsViewed,
      markHostPropertyBookingsViewed,
      markHostVehicleBookingsViewed,
      markHostPropertyBookingsViewedForProperty,
      markHostVehicleBookingsViewedForVehicle,
      hasUnseenProperty,
      hasUnseenVehicle,
      guestBookingsTotal:
        badges.guestPropertyBookings + badges.guestVehicleBookings,
      hostBookingsTotal:
        badges.hostPropertyBookings + badges.hostVehicleBookings,
    }),
    [
      badges,
      refresh,
      markGuestPropertyBookingsViewed,
      markGuestVehicleBookingsViewed,
      markHostPropertyBookingsViewed,
      markHostVehicleBookingsViewed,
      markHostPropertyBookingsViewedForProperty,
      markHostVehicleBookingsViewedForVehicle,
      hasUnseenProperty,
      hasUnseenVehicle,
    ]
  );

  return (
    <TabNotificationBadgesContext.Provider value={value}>
      {children}
    </TabNotificationBadgesContext.Provider>
  );
};

export const useTabNotificationBadges = (): TabNotificationBadgesContextValue => {
  const ctx = useContext(TabNotificationBadgesContext);
  if (!ctx) {
    return {
      ...emptyBadges,
      refresh: async () => {},
      markGuestPropertyBookingsViewed: async () => {},
      markGuestVehicleBookingsViewed: async () => {},
      markHostPropertyBookingsViewed: async () => {},
      markHostVehicleBookingsViewed: async () => {},
      markHostPropertyBookingsViewedForProperty: async () => {},
      markHostVehicleBookingsViewedForVehicle: async () => {},
      hasUnseenProperty: () => false,
      hasUnseenVehicle: () => false,
      guestBookingsTotal: 0,
      hostBookingsTotal: 0,
    };
  }
  return ctx;
};
