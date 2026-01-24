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
      // Récupérer TOUTES les réservations confirmées (même celles qui commencent dans le futur)
      // Important : on récupère toutes les réservations confirmées pour afficher correctement le calendrier
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status')
        .eq('property_id', propertyId)
        .in('status', ['confirmed', 'pending'])
        .gte('check_out_date', todayStr); // Seulement les réservations qui ne sont pas terminées

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
      }

      // Récupérer les demandes de modification en attente pour cette propriété
      // IMPORTANT : Les dates originales doivent rester bloquées tant que la modification n'est pas acceptée
      const bookingIds = bookings?.map(b => b.id) || [];
      let pendingModifications: any[] = [];
      
      if (bookingIds.length > 0) {
        const { data: modifications, error: modificationsError } = await supabase
          .from('booking_modification_requests')
          .select('booking_id, original_check_in, original_check_out, requested_check_in, requested_check_out, status')
          .in('booking_id', bookingIds)
          .eq('status', 'pending');

        if (modificationsError) {
          console.error('Error fetching pending modifications:', modificationsError);
        } else {
          pendingModifications = modifications || [];
        }
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
      // IMPORTANT : Pour les réservations avec une demande de modification en attente,
      // on bloque les dates ORIGINALES (pas les dates demandées) tant que la modification n'est pas acceptée
      (bookings || []).forEach(booking => {
        // Vérifier si cette réservation a une demande de modification en attente
        const pendingMod = pendingModifications.find(m => m.booking_id === booking.id);
        
        if (pendingMod) {
          // Si une modification est en attente, bloquer les dates ORIGINALES
          const key = `${pendingMod.original_check_in}-${pendingMod.original_check_out}`;
          unavailableMap.set(key, {
            start_date: pendingMod.original_check_in,
            end_date: pendingMod.original_check_out,
            reason: 'Réservé (modification en attente)'
          });
        } else {
          // Sinon, utiliser les dates actuelles de la réservation
          const key = `${booking.check_in_date}-${booking.check_out_date}`;
          const reason = booking.status === 'pending' ? 'Réservation en attente' : 'Réservé';
          unavailableMap.set(key, {
            start_date: booking.check_in_date,
            end_date: booking.check_out_date,
            reason
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

      console.log('📅 [useAvailabilityCalendar] Réservations trouvées:', bookings?.length || 0);
      console.log('📅 [useAvailabilityCalendar] Demandes de modification en attente:', pendingModifications.length);
      console.log('📅 [useAvailabilityCalendar] Dates bloquées trouvées:', blockedDates?.length || 0);
      console.log('📅 [useAvailabilityCalendar] Dates indisponibles combinées:', allUnavailableDates);
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
