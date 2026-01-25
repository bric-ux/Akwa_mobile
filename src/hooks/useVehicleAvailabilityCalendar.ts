import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface UnavailableDate {
  start_date: string;
  end_date: string;
  reason?: string;
}

export const useVehicleAvailabilityCalendar = (vehicleId: string) => {
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnavailableDates = async () => {
    if (!vehicleId) return;
    
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // Récupérer les réservations (pending, confirmed - les réservations terminées ne bloquent pas)
      const { data: bookings, error: bookingsError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status')
        .eq('vehicle_id', vehicleId)
        .in('status', ['pending', 'confirmed'])
        .gte('end_date', todayStr); // Seulement les réservations qui ne sont pas terminées

      if (bookingsError) {
        console.error('Error fetching vehicle bookings:', bookingsError);
      }

      // Récupérer les demandes de modification en attente pour ce véhicule
      // IMPORTANT : Les dates originales doivent rester bloquées tant que la modification n'est pas acceptée
      const bookingIds = bookings?.map(b => b.id) || [];
      let pendingModifications: any[] = [];
      
      if (bookingIds.length > 0) {
        const { data: modifications, error: modificationsError } = await supabase
          .from('vehicle_booking_modification_requests')
          .select('booking_id, original_start_date, original_end_date, requested_start_date, requested_end_date, status')
          .in('booking_id', bookingIds)
          .eq('status', 'pending');

        if (modificationsError) {
          console.error('Error fetching pending vehicle modifications:', modificationsError);
        } else {
          pendingModifications = modifications || [];
        }
      }

      // Récupérer les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('vehicle_blocked_dates')
        .select('start_date, end_date, reason')
        .eq('vehicle_id', vehicleId)
        .gte('end_date', todayStr);

      if (blockedError) {
        console.error('Error fetching blocked dates:', blockedError);
      }

      // Créer un Map pour éviter les doublons et donner priorité aux dates bloquées
      const unavailableMap = new Map<string, UnavailableDate>();
      
      // D'abord ajouter les réservations (en utilisant les dates originales si modification en attente)
      (bookings || []).forEach(booking => {
        // Vérifier s'il y a une modification en attente pour cette réservation
        const pendingMod = pendingModifications.find(m => m.booking_id === booking.id);
        
        if (pendingMod) {
          // Utiliser les dates originales car la modification n'est pas encore acceptée
          const key = `${pendingMod.original_start_date}-${pendingMod.original_end_date}`;
          unavailableMap.set(key, {
            start_date: pendingMod.original_start_date,
            end_date: pendingMod.original_end_date,
            reason: 'Réservation (modification en attente)'
          });
        } else {
          // Utiliser les dates de la réservation normale
          const key = `${booking.start_date}-${booking.end_date}`;
          unavailableMap.set(key, {
            start_date: booking.start_date,
            end_date: booking.end_date,
            reason: booking.status === 'confirmed' ? 'Réservation confirmée' : 
                    booking.status === 'pending' ? 'Réservation en attente' : 'Réservation en cours'
          });
        }
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

      console.log('📅 [useVehicleAvailabilityCalendar] Réservations trouvées:', bookings?.length || 0);
      console.log('📅 [useVehicleAvailabilityCalendar] Demandes de modification en attente:', pendingModifications.length);
      console.log('📅 [useVehicleAvailabilityCalendar] Dates bloquées trouvées:', blockedDates?.length || 0);
      console.log('📅 [useVehicleAvailabilityCalendar] Dates indisponibles combinées:', allUnavailableDates.length);
      setUnavailableDates(allUnavailableDates);
    } catch (error) {
      console.error('Error fetching unavailable dates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnavailableDates();
  }, [vehicleId]);

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


