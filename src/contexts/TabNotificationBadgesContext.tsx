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
}

interface TabNotificationBadgesContextValue extends TabNotificationBadges {
  refresh: () => Promise<void>;
  markGuestPropertyBookingsViewed: () => Promise<void>;
  markGuestVehicleBookingsViewed: () => Promise<void>;
  markHostPropertyBookingsViewed: () => Promise<void>;
  markHostVehicleBookingsViewed: () => Promise<void>;
  guestBookingsTotal: number;
  hostBookingsTotal: number;
}

const emptyBadges: TabNotificationBadges = {
  unreadMessages: 0,
  guestPropertyBookings: 0,
  guestVehicleBookings: 0,
  hostPropertyBookings: 0,
  hostVehicleBookings: 0,
};

const TabNotificationBadgesContext =
  createContext<TabNotificationBadgesContextValue | null>(null);

async function rpcCount(
  name: string,
  userId: string
): Promise<number> {
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
      hostPropertyBookings,
      hostVehicleBookings,
    ] = await Promise.all([
      supabase
        .rpc('get_unread_messages_count', { user_uuid: user.id })
        .then(({ data, error }) => {
          if (error) return 0;
          return typeof data === 'number' ? data : 0;
        }),
      rpcCount('get_guest_unseen_bookings_count', user.id),
      rpcCount('get_vehicle_renter_unseen_bookings_count', user.id),
      rpcCount('get_host_unseen_bookings_count', user.id),
      rpcCount('get_vehicle_owner_unseen_bookings_count', user.id),
    ]);

    setBadges({
      unreadMessages,
      guestPropertyBookings,
      guestVehicleBookings,
      hostPropertyBookings,
      hostVehicleBookings,
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
    setBadges((prev) => ({ ...prev, hostPropertyBookings: 0 }));
    await refresh();
  }, [user?.id, refresh]);

  const markHostVehicleBookingsViewed = useCallback(async () => {
    if (!user?.id) return;
    await rpcVoid('mark_vehicle_owner_bookings_viewed', user.id);
    setBadges((prev) => ({ ...prev, hostVehicleBookings: 0 }));
    await refresh();
  }, [user?.id, refresh]);

  const value = useMemo<TabNotificationBadgesContextValue>(
    () => ({
      ...badges,
      refresh,
      markGuestPropertyBookingsViewed,
      markGuestVehicleBookingsViewed,
      markHostPropertyBookingsViewed,
      markHostVehicleBookingsViewed,
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
      guestBookingsTotal: 0,
      hostBookingsTotal: 0,
    };
  }
  return ctx;
};
