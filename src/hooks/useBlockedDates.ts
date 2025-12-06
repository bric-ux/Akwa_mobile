import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Alert } from 'react-native';

export interface BlockedDate {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
}

export const useBlockedDates = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const getBlockedDates = async (propertyId: string): Promise<BlockedDate[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching blocked dates:', error);
      Alert.alert('Erreur', 'Erreur lors du chargement des dates bloquées');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const blockDates = async (
    propertyId: string,
    startDate: string,
    endDate: string,
    reason?: string
  ) => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    try {
      // Vérifier les conflits avec les réservations existantes
      const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('check_in_date, check_out_date, status')
        .eq('property_id', propertyId)
        .in('status', ['confirmed', 'pending']);

      if (bookingError) {
        console.error('Error checking bookings:', bookingError);
      }

      // Vérifier les conflits avec les dates déjà bloquées
      const { data: conflictingBlocks, error: blockError } = await supabase
        .from('blocked_dates')
        .select('start_date, end_date')
        .eq('property_id', propertyId);

      if (blockError) {
        console.error('Error checking blocked dates:', blockError);
      }

      // Vérifier les conflits
      const hasConflict = [...(bookings || []), ...(conflictingBlocks || [])].some(({ start_date, end_date }) => {
        const conflictStart = new Date(start_date);
        const conflictEnd = new Date(end_date);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);
        
        return (
          (newStart >= conflictStart && newStart < conflictEnd) ||
          (newEnd > conflictStart && newEnd <= conflictEnd) ||
          (newStart <= conflictStart && newEnd >= conflictEnd)
        );
      });

      if (hasConflict) {
        Alert.alert('Erreur', 'Ces dates sont déjà indisponibles (réservées ou bloquées)');
        return { success: false };
      }

      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          property_id: propertyId,
          start_date: startDate,
          end_date: endDate,
          reason,
          created_by: user.id
        });

      if (error) throw error;
      Alert.alert('Succès', 'Dates bloquées avec succès');
      return { success: true };
    } catch (error) {
      console.error('Error blocking dates:', error);
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
        .from('blocked_dates')
        .delete()
        .eq('id', blockedDateId);

      if (error) throw error;
      Alert.alert('Succès', 'Dates débloquées avec succès');
      return { success: true };
    } catch (error) {
      console.error('Error unblocking dates:', error);
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
    unblockDates
  };
};















