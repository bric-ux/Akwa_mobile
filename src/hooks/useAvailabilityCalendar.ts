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
      // Récupérer les réservations confirmées ET en attente
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('check_in_date, check_out_date, status')
        .eq('property_id', propertyId)
        .in('status', ['confirmed', 'pending'])
        .gte('check_out_date', new Date().toISOString().split('T')[0]);

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
        const reason = booking.status === 'pending' ? 'Réservation en attente' : 'Réservé';
        unavailableMap.set(key, {
          start_date: booking.check_in_date,
          end_date: booking.check_out_date,
          reason
        });
      });
      
      // Ensuite ajouter les dates bloquées (elles écrasent les réservations si même période)
      (blockedDates || []).forEach(blocked => {
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
      return dateStr >= start_date && dateStr <= end_date;
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
