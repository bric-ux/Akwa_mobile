import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface UnavailableDate {
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface BlockedDate {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
  created_by: string;
}

export const useAvailabilityCalendar = (propertyId: string) => {
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnavailableDates = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    try {
      // Récupérer les réservations via la fonction RPC
      const { data: bookings, error: bookingsError } = await supabase.rpc('get_unavailable_dates', {
        property_id_param: propertyId
      });

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
      }

      // Récupérer les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('start_date, end_date, reason')
        .eq('property_id', propertyId);

      if (blockedError) {
        console.error('Error fetching blocked dates:', blockedError);
      }

      // Créer un Map pour éviter les doublons et donner priorité aux dates bloquées
      const unavailableMap = new Map();
      
      // D'abord ajouter les réservations
      (bookings || []).forEach((booking: any) => {
        const key = `${booking.start_date}-${booking.end_date}`;
        unavailableMap.set(key, {
          start_date: booking.start_date,
          end_date: booking.end_date,
          reason: 'Réservé'
        });
      });
      
      // Ensuite ajouter les dates bloquées (elles écrasent les réservations si même période)
      (blockedDates || []).forEach((blocked: any) => {
        const key = `${blocked.start_date}-${blocked.end_date}`;
        unavailableMap.set(key, {
          start_date: blocked.start_date,
          end_date: blocked.end_date,
          reason: blocked.reason || 'Bloqué manuellement'
        });
      });
      
      // Convertir le Map en array
      const allUnavailableDates = Array.from(unavailableMap.values());

      console.log('Combined unavailable dates:', allUnavailableDates);
      setUnavailableDates(allUnavailableDates);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnavailableDates();
  }, [propertyId]);

  const isDateUnavailable = (date: Date) => {
    // Utiliser une méthode locale pour éviter les décalages de fuseau horaire
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // Format YYYY-MM-DD
    
    const isUnavailable = unavailableDates.some(({ start_date, end_date }) => {
      // Vérifier si la date est dans la période [start_date, end_date] (inclus)
      const isInRange = dateStr >= start_date && dateStr <= end_date;
      if (isInRange) {
        console.log('Date unavailable found:', { dateStr, start_date, end_date, reason: 'blocked' });
      }
      return isInRange;
    });
    
    console.log('isDateUnavailable check:', { 
      date: dateStr, 
      unavailableDates: unavailableDates.length, 
      isUnavailable 
    });
    
    return isUnavailable;
  };

  return {
    unavailableDates,
    loading,
    isDateUnavailable,
    refetch: fetchUnavailableDates
  };
};

export const useBlockedDates = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const getBlockedDates = async (propertyId: string): Promise<BlockedDate[]> => {
    if (!user) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching blocked dates:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error:', error);
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
      return { success: false, error: 'Vous devez être connecté' };
    }

    setLoading(true);
    try {
      // Vérifier les conflits avec les réservations existantes
      const { data: conflictingBookings, error: bookingError } = await supabase.rpc('get_unavailable_dates', {
        property_id_param: propertyId
      });

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
      const hasConflict = [...(conflictingBookings || []), ...(conflictingBlocks || [])].some(({ start_date, end_date }) => {
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
        return { success: false, error: 'Ces dates sont déjà indisponibles (réservées ou bloquées)' };
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
      return { success: true };
    } catch (error) {
      console.error('Error blocking dates:', error);
      return { success: false, error: 'Erreur lors du blocage des dates' };
    } finally {
      setLoading(false);
    }
  };

  const unblockDates = async (blockedDateId: string) => {
    if (!user) {
      return { success: false, error: 'Vous devez être connecté' };
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', blockedDateId)
        .eq('created_by', user.id); // S'assurer que seul le créateur peut supprimer

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error unblocking dates:', error);
      return { success: false, error: 'Erreur lors du déblocage des dates' };
    } finally {
      setLoading(false);
    }
  };

  return {
    getBlockedDates,
    blockDates,
    unblockDates,
    loading
  };
};