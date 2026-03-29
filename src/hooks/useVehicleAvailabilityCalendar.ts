import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface UnavailableDate {
  start_date: string;
  end_date: string;
  reason?: string;
  /** Réservations : jour de fin de location exclu (retour le jour J = libre pour une nouvelle loc le même jour). */
  endExclusive?: boolean;
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
      
      // Récupérer TOUTES les réservations (pending, confirmed) pour ce véhicule
      // On va filtrer en JavaScript pour être sûr de ne rien manquer
      const { data: bookingsRaw, error: bookingsError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status, payment_method')
        .eq('vehicle_id', vehicleId)
        .in('status', ['pending', 'confirmed']);

      let bookings = (bookingsRaw || []) as any[];

      // Ne pas bloquer le calendrier avec des réservations carte pending non payées.
      const pendingCardBookings = bookings.filter(
        (booking) => booking.status === 'pending' && booking.payment_method === 'card'
      );

      if (pendingCardBookings.length > 0) {
        const pendingCardIds = pendingCardBookings.map((booking) => booking.id);
        const { data: payments, error: paymentsError } = await supabase
          .from('vehicle_payments')
          .select('booking_id, status')
          .in('booking_id', pendingCardIds);

        if (!paymentsError) {
          const paidBookingIds = new Set(
            (payments || [])
              .filter((payment: any) => ['completed', 'succeeded', 'paid'].includes(String(payment.status || '').toLowerCase()))
              .map((payment: any) => payment.booking_id)
          );

          bookings = bookings.filter((booking) => {
            if (booking.status === 'pending' && booking.payment_method === 'card') {
              return paidBookingIds.has(booking.id);
            }
            return true;
          });
        } else {
          console.error('❌ [useVehicleAvailabilityCalendar] Error fetching vehicle_payments:', paymentsError);
          bookings = bookings.filter((booking) => !(booking.status === 'pending' && booking.payment_method === 'card'));
        }
      }

      if (bookingsError) {
        console.error('❌ [useVehicleAvailabilityCalendar] Error fetching vehicle bookings:', bookingsError);
      } else {
        console.log(`📅 [useVehicleAvailabilityCalendar] Réservations brutes trouvées:`, bookings?.length || 0);
        if (bookings && bookings.length > 0) {
          console.log('📅 [useVehicleAvailabilityCalendar] Détails des réservations:', bookings.map(b => ({
            id: b.id,
            start_date: b.start_date,
            end_date: b.end_date,
            status: b.status
          })));
        }
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
      
      // Normaliser les dates pour éviter les problèmes de format
      const normalizeDate = (dateStr: string) => {
        if (!dateStr) return '';
        // Si c'est déjà au format YYYY-MM-DD, retourner tel quel
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateStr;
        }
        // Sinon, extraire la partie date (enlever l'heure si présente)
        return dateStr.split('T')[0];
      };
      
      // Filtrer les réservations qui ne sont pas terminées
      const todayNormalized = normalizeDate(todayStr);
      const activeBookings = (bookings || []).filter(booking => {
        const bookingEnd = normalizeDate(booking.end_date);
        return bookingEnd >= todayNormalized;
      });
      
      console.log(`📅 [useVehicleAvailabilityCalendar] Réservations actives (non terminées):`, activeBookings.length);
      
      // D'abord ajouter les réservations (en utilisant les dates originales si modification en attente)
      activeBookings.forEach(booking => {
        // Normaliser les dates de la réservation
        const bookingStart = normalizeDate(booking.start_date);
        const bookingEnd = normalizeDate(booking.end_date);
        
        // Vérifier s'il y a une modification en attente pour cette réservation
        const pendingMod = pendingModifications.find(m => m.booking_id === booking.id);
        
        if (pendingMod) {
          // Utiliser les dates originales car la modification n'est pas encore acceptée
          const modStart = normalizeDate(pendingMod.original_start_date);
          const modEnd = normalizeDate(pendingMod.original_end_date);
          const key = `${modStart}-${modEnd}`;
          unavailableMap.set(key, {
            start_date: modStart,
            end_date: modEnd,
            reason: 'Réservation (modification en attente)',
            endExclusive: true,
          });
          console.log(`📅 [useVehicleAvailabilityCalendar] Ajout réservation avec modif en attente: ${modStart} - ${modEnd}`);
        } else {
          // Utiliser les dates de la réservation normale
          const key = `${bookingStart}-${bookingEnd}`;
          unavailableMap.set(key, {
            start_date: bookingStart,
            end_date: bookingEnd,
            reason: booking.status === 'confirmed' ? 'Réservation confirmée' : 
                    booking.status === 'pending' ? 'Réservation en attente' : 'Réservation en cours',
            endExclusive: true,
          });
          console.log(`📅 [useVehicleAvailabilityCalendar] Ajout réservation: ${bookingStart} - ${bookingEnd} (${booking.status})`);
        }
      });
      
      // Ensuite ajouter les dates bloquées (elles écrasent les réservations si même période)
      (blockedDates || []).forEach(blocked => {
        const blockedStart = normalizeDate(blocked.start_date);
        const blockedEnd = normalizeDate(blocked.end_date);
        const key = `${blockedStart}-${blockedEnd}`;
        unavailableMap.set(key, {
          start_date: blockedStart,
          end_date: blockedEnd,
          reason: blocked.reason || 'Bloqué manuellement',
          endExclusive: false,
        });
        console.log(`📅 [useVehicleAvailabilityCalendar] Ajout date bloquée: ${blockedStart} - ${blockedEnd}`);
      });
      
      // Convertir le Map en array
      const allUnavailableDates = Array.from(unavailableMap.values());

      console.log('📅 [useVehicleAvailabilityCalendar] Résumé:');
      console.log(`  - Réservations totales: ${bookings?.length || 0}`);
      console.log(`  - Réservations actives: ${activeBookings.length}`);
      console.log(`  - Demandes de modification en attente: ${pendingModifications.length}`);
      console.log(`  - Dates bloquées: ${blockedDates?.length || 0}`);
      console.log(`  - Dates indisponibles combinées: ${allUnavailableDates.length}`);
      console.log('📅 [useVehicleAvailabilityCalendar] Dates indisponibles:', allUnavailableDates);
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
    
    // Normaliser les dates des périodes indisponibles pour comparaison
    const normalizeDate = (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateStr;
      }
      return dateStr.split('T')[0];
    };
    
    const isUnavailable = unavailableDates.some(({ start_date, end_date, endExclusive }) => {
      // Normaliser les dates de la période
      const periodStart = normalizeDate(start_date);
      const periodEnd = normalizeDate(end_date);
      const exclusive = endExclusive !== false;
      const isInPeriod = exclusive
        ? dateStr >= periodStart && dateStr < periodEnd
        : dateStr >= periodStart && dateStr <= periodEnd;
      
      if (isInPeriod) {
        console.log(`🚫 [isDateUnavailable] Date ${dateStr} indisponible: période ${periodStart} - ${periodEnd}`);
      }
      
      return isInPeriod;
    });
    
    return isUnavailable;
  };

  // Fonction pour vérifier si une plage de dates chevauche une période indisponible
  const isDateRangeUnavailable = (startDate: Date, endDate: Date) => {
    const normalizeDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const normalizeDateStr = (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    };
    
    const startStr = normalizeDate(startDate);
    const endStr = normalizeDate(endDate);
    
    return unavailableDates.some(({ start_date, end_date, endExclusive }) => {
      const normalizedStart = normalizeDateStr(start_date);
      const normalizedEnd = normalizeDateStr(end_date);
      const exclusive = endExclusive !== false;
      const overlaps = exclusive
        ? startStr < normalizedEnd && endStr > normalizedStart
        : startStr <= normalizedEnd && endStr > normalizedStart;
      
      if (overlaps) {
        console.log(`🚫 [isDateRangeUnavailable] Plage ${startStr} - ${endStr} chevauche période ${normalizedStart} - ${normalizedEnd}`);
      }
      
      return overlaps;
    });
  };

  return {
    unavailableDates,
    loading,
    isDateUnavailable,
    isDateRangeUnavailable,
    refetch: fetchUnavailableDates
  };
};


