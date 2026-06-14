import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';

export interface HotelICalLink {
  id: string;
  room_type_id: string;
  platform: string;
  import_url: string | null;
  export_url: string | null;
  last_synced_at: string | null;
  sync_enabled: boolean;
}

export const useHotelICalSync = () => {
  const [loading, setLoading] = useState(false);

  const getICalLinks = async (roomTypeId: string): Promise<HotelICalLink[]> => {
    try {
      const { data, error } = await supabase
        .from('hotel_room_type_ical_sync_links')
        .select('*')
        .eq('room_type_id', roomTypeId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching hotel iCal links:', error);
      return [];
    }
  };

  const addICalLink = async (
    roomTypeId: string,
    platform: string,
    importUrl: string,
  ): Promise<{ success: boolean }> => {
    setLoading(true);
    try {
      const { error } = await supabase.from('hotel_room_type_ical_sync_links').upsert(
        {
          room_type_id: roomTypeId,
          platform,
          import_url: importUrl,
          export_url: null,
          sync_enabled: true,
        },
        { onConflict: 'room_type_id,platform' },
      );

      if (error) throw error;

      Alert.alert('Succès', 'Lien iCal ajouté avec succès');
      return { success: true };
    } catch (error) {
      console.error('Error adding hotel iCal link:', error);
      Alert.alert('Erreur', 'Erreur lors de l\'ajout du lien iCal');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async (
    roomTypeId: string,
    platform: string,
  ): Promise<{ success: boolean }> => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('sync-ical', {
        body: { roomTypeId, platform, bookingType: 'hotel' },
      });

      if (error) throw error;

      await supabase
        .from('hotel_room_type_ical_sync_links')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('room_type_id', roomTypeId)
        .eq('platform', platform);

      Alert.alert('Succès', `Calendrier ${platform} synchronisé avec succès`);
      return { success: true };
    } catch (error) {
      console.error('Error syncing hotel calendar:', error);
      Alert.alert('Erreur', 'Erreur lors de la synchronisation');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const removeICalLink = async (linkId: string): Promise<{ success: boolean }> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('hotel_room_type_ical_sync_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      Alert.alert('Succès', 'Lien iCal supprimé');
      return { success: true };
    } catch (error: any) {
      console.error('Error removing hotel iCal link:', error);
      Alert.alert('Erreur', 'Erreur lors de la suppression');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const clearSyncedBlockedDates = async (
    roomTypeId: string,
    platform: string,
  ): Promise<{ success: boolean; deletedCount?: number }> => {
    setLoading(true);
    try {
      const reason = `Synchronisation ${platform}`;
      const { error, count } = await supabase
        .from('hotel_room_type_blocked_dates')
        .delete({ count: 'exact' })
        .eq('room_type_id', roomTypeId)
        .eq('reason', reason);

      if (error) throw error;

      Alert.alert('Succès', `Blocages retirés (${count ?? 0}) pour ${platform}`);
      return { success: true, deletedCount: count ?? 0 };
    } catch (error) {
      console.error('Error clearing hotel synced blocked dates:', error);
      Alert.alert('Erreur', 'Erreur lors de la suppression des blocages');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getICalLinks,
    addICalLink,
    syncCalendar,
    removeICalLink,
    clearSyncedBlockedDates,
  };
};
