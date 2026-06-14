import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface HotelBlockedDate {
  id: string;
  room_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
}

const datesOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean => {
  const newStart = new Date(aStart);
  const newEnd = new Date(aEnd);
  const conflictStart = new Date(bStart);
  const conflictEnd = new Date(bEnd);
  return (
    (newStart >= conflictStart && newStart <= conflictEnd) ||
    (newEnd >= conflictStart && newEnd <= conflictEnd) ||
    (newStart <= conflictStart && newEnd >= conflictEnd)
  );
};

export const useHotelBlockedDates = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const getBlockedDates = async (roomTypeId: string): Promise<HotelBlockedDate[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_room_type_blocked_dates')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching hotel blocked dates:', error);
      Alert.alert('Erreur', 'Erreur lors du chargement des dates bloquées');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const blockDates = async (
    roomTypeId: string,
    startDate: string,
    endDate: string,
    reason?: string,
  ) => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    try {
      const { data: bookingItems, error: bookingError } = await supabase
        .from('hotel_booking_items')
        .select('quantity, hotel_bookings(check_in_date, check_out_date, status)')
        .eq('room_type_id', roomTypeId);

      if (bookingError) {
        console.error('Error checking hotel bookings:', bookingError);
      }

      const { data: conflictingBlocks, error: blockError } = await supabase
        .from('hotel_room_type_blocked_dates')
        .select('start_date, end_date')
        .eq('room_type_id', roomTypeId);

      if (blockError) {
        console.error('Error checking hotel blocked dates:', blockError);
      }

      const bookingRanges =
        (bookingItems || [])
          .filter(
            (item: any) =>
              item.hotel_bookings &&
              ['confirmed', 'pending'].includes(item.hotel_bookings.status),
          )
          .map((item: any) => ({
            start_date: item.hotel_bookings.check_in_date,
            end_date: item.hotel_bookings.check_out_date,
          })) ?? [];

      const hasConflict = [...bookingRanges, ...(conflictingBlocks || [])].some(
        ({ start_date, end_date }) =>
          datesOverlap(startDate, endDate, start_date, end_date),
      );

      if (hasConflict) {
        Alert.alert('Erreur', 'Ces dates sont déjà indisponibles (réservées ou bloquées)');
        return { success: false };
      }

      const { error } = await supabase.from('hotel_room_type_blocked_dates').insert({
        room_type_id: roomTypeId,
        start_date: startDate,
        end_date: endDate,
        reason,
        created_by: user.id,
      });

      if (error) throw error;
      Alert.alert('Succès', 'Dates bloquées avec succès');
      return { success: true };
    } catch (error) {
      console.error('Error blocking hotel dates:', error);
      Alert.alert('Erreur', 'Erreur lors du blocage des dates');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const unblockDates = async (blockedDateId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('hotel_room_type_blocked_dates')
        .delete()
        .eq('id', blockedDateId);

      if (error) throw error;
      Alert.alert('Succès', 'Dates débloquées avec succès');
      return { success: true };
    } catch (error) {
      console.error('Error unblocking hotel dates:', error);
      Alert.alert('Erreur', 'Erreur lors du déblocage des dates');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getBlockedDates,
    blockDates,
    unblockDates,
  };
};
