import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface UnavailableDate {
  start_date: string;
  end_date: string;
  reason?: string;
}

export const useAvailabilityCalendar = (propertyId: string) => {
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnavailableDates = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    try {
      // Récupérer les réservations
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('check_in_date, check_out_date')
        .eq('property_id', propertyId)
        .in('status', ['pending', 'confirmed']);

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
      (bookings || []).forEach(booking => {
        const key = `${booking.check_in_date}-${booking.check_out_date}`;
        unavailableMap.set(key, {
          start_date: booking.check_in_date,
          end_date: booking.check_out_date,
          reason: 'Réservé'
        });
      });
      
      // Ensuite ajouter les dates bloquées (elles ont priorité)
      (blockedDates || []).forEach(blocked => {
        const key = `${blocked.start_date}-${blocked.end_date}`;
        unavailableMap.set(key, {
          start_date: blocked.start_date,
          end_date: blocked.end_date,
          reason: blocked.reason || 'Indisponible'
        });
      });

      setUnavailableDates(Array.from(unavailableMap.values()));
    } catch (error) {
      console.error('Error fetching unavailable dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDateUnavailable = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    
    return unavailableDates.some(unavailable => {
      const startDate = new Date(unavailable.start_date);
      const endDate = new Date(unavailable.end_date);
      
      return date >= startDate && date < endDate;
    });
  };

  const getUnavailableReason = (date: Date): string | null => {
    const dateStr = date.toISOString().split('T')[0];
    
    const unavailable = unavailableDates.find(unavailable => {
      const startDate = new Date(unavailable.start_date);
      const endDate = new Date(unavailable.end_date);
      
      return date >= startDate && date < endDate;
    });

    return unavailable?.reason || null;
  };

  useEffect(() => {
    fetchUnavailableDates();
  }, [propertyId]);

  return {
    unavailableDates,
    loading,
    isDateUnavailable,
    getUnavailableReason,
    refetch: fetchUnavailableDates
  };
};
