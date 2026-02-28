import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface UnavailableDate {
  start_date: string;
  end_date: string;
  reason?: string;
}

export const useAvailabilityCalendar = (
  propertyId: string, 
  excludeBookingId?: string,
  excludeBookingDates?: { checkIn: string; checkOut: string }
) => {
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
      
      console.log('🔍 [useAvailabilityCalendar] Récupération dates indisponibles:', {
        propertyId,
        excludeBookingId,
        excludeBookingDates,
      });
      
      // IMPORTANT: Récupérer TOUTES les réservations qui peuvent bloquer des dates
      // - confirmed: bloquent définitivement
      // - pending: bloquent temporairement (en attente de confirmation)
      // Note: Les réservations "en cours" ont le statut "confirmed" dans la base
      // mais sont calculées dynamiquement comme "in_progress" dans l'app
      // On ne récupère PAS les completed car elles ne bloquent plus les dates
      // ✅ NE PAS EXCLURE la réservation actuelle de la requête (elle doit être marquée comme "Réservé")
      // Mais on permettra la sélection de ses dates via excludeBookingDates
      const { data: bookingsRaw, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status, payment_method')
        .eq('property_id', propertyId)
        .in('status', ['confirmed', 'pending']) // in_progress n'existe pas dans l'enum, c'est calculé dynamiquement
        .gte('check_out_date', todayStr); // Seulement les réservations qui ne sont pas terminées

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
      }

      // Les réservations carte en pending ne doivent bloquer les dates que si le paiement est confirmé.
      let bookings = (bookingsRaw || []) as any[];
      const pendingCardBookings = bookings.filter(
        (booking) => booking.status === 'pending' && booking.payment_method === 'card'
      );

      if (pendingCardBookings.length > 0) {
        const pendingCardIds = pendingCardBookings.map((booking) => booking.id);
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('booking_id, status')
          .in('booking_id', pendingCardIds);

        if (paymentsError) {
          console.error('Error fetching card payments for availability:', paymentsError);
        } else {
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
        }
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
      
      // Normaliser les dates pour éviter les problèmes de format
      const normalizeDate = (dateStr: string) => {
        if (!dateStr) return '';
        // Si la date contient un timestamp, extraire seulement la partie date
        if (dateStr.includes('T')) {
          return dateStr.split('T')[0];
        }
        return dateStr;
      };

      // D'abord ajouter les réservations
      // IMPORTANT : Pour les réservations avec une demande de modification en attente,
      // on bloque les dates ORIGINALES (pas les dates demandées) tant que la modification n'est pas acceptée
      // ✅ TOUTES les réservations sont ajoutées (y compris celle de l'utilisateur actuel)
      // pour qu'elles soient marquées comme "Réservé" dans le calendrier
      (bookings || []).forEach(booking => {
        // Vérifier si cette réservation a une demande de modification en attente
        const pendingMod = pendingModifications.find(m => m.booking_id === booking.id);
        
        if (pendingMod) {
          // Si une modification est en attente, bloquer les dates ORIGINALES
          const originalStart = normalizeDate(pendingMod.original_check_in);
          const originalEnd = normalizeDate(pendingMod.original_check_out);
          const key = `${originalStart}-${originalEnd}`;
          unavailableMap.set(key, {
            start_date: originalStart,
            end_date: originalEnd,
            reason: 'Réservé (modification en attente)'
          });
        } else {
          // Sinon, utiliser les dates actuelles de la réservation
          const checkIn = normalizeDate(booking.check_in_date);
          const checkOut = normalizeDate(booking.check_out_date);
          const key = `${checkIn}-${checkOut}`;
          
          // Déterminer le statut effectif pour l'affichage
          // Les réservations "en cours" ont le statut "confirmed" mais sont entre check-in et check-out
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const checkInDate = new Date(checkIn);
          checkInDate.setHours(0, 0, 0, 0);
          const checkOutDate = new Date(checkOut);
          checkOutDate.setHours(0, 0, 0, 0);
          
          let reason = 'Réservé';
          if (booking.status === 'pending') {
            reason = 'Réservation en attente';
          } else if (booking.status === 'confirmed' && checkInDate <= today && checkOutDate >= today) {
            reason = 'Réservé (en cours)';
          }
          
          unavailableMap.set(key, {
            start_date: checkIn,
            end_date: checkOut,
            reason
          });
        }
      });
      
      // Ensuite ajouter les dates bloquées (elles écrasent les réservations si même période)
      (blockedDates || []).forEach(blocked => {
        // Normaliser les dates pour éviter les problèmes de format
        const normalizeDate = (dateStr: string) => {
          if (!dateStr) return '';
          if (dateStr.includes('T')) {
            return dateStr.split('T')[0];
          }
          return dateStr;
        };
        
        const blockedStart = normalizeDate(blocked.start_date);
        const blockedEnd = normalizeDate(blocked.end_date);
        const key = `${blockedStart}-${blockedEnd}`;
        unavailableMap.set(key, {
          start_date: blockedStart,
          end_date: blockedEnd,
          reason: blocked.reason || 'Bloqué manuellement'
        });
      });
      
      // Convertir le Map en array
      const allUnavailableDates = Array.from(unavailableMap.values());

      // IMPORTANT: Vérifier que toutes les dates entre start_date et end_date sont bien incluses
      // Normaliser toutes les dates pour s'assurer qu'elles sont au format YYYY-MM-DD
      const normalizedUnavailableDates = allUnavailableDates.map(({ start_date, end_date, reason }) => {
        const normalizeDateStr = (dateStr: string) => {
          if (!dateStr) return '';
          if (dateStr.includes('T')) {
            return dateStr.split('T')[0];
          }
          return dateStr;
        };
        
        return {
          start_date: normalizeDateStr(start_date),
          end_date: normalizeDateStr(end_date),
          reason
        };
      });

      console.log('📅 [useAvailabilityCalendar] Réservations trouvées:', bookings?.length || 0);
      console.log('📅 [useAvailabilityCalendar] Demandes de modification en attente:', pendingModifications.length);
      console.log('📅 [useAvailabilityCalendar] Dates bloquées trouvées:', blockedDates?.length || 0);
      console.log('📅 [useAvailabilityCalendar] Dates indisponibles combinées:', normalizedUnavailableDates);
      setUnavailableDates(normalizedUnavailableDates);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnavailableDates();
  }, [propertyId, excludeBookingId]);

  const isDateUnavailable = (date: Date) => {
    // Utiliser une méthode locale pour éviter les décalages de fuseau horaire
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // Format YYYY-MM-DD
    
    // Normaliser les dates des périodes indisponibles pour comparaison
    const normalizeDateStr = (dateStr: string) => {
      if (!dateStr) return '';
      // Si la date contient un timestamp, extraire seulement la partie date
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    };
    
    // ✅ Si cette date fait partie de la réservation actuelle (en modification), elle est disponible
    if (excludeBookingDates) {
      const normalizedExcludeStart = normalizeDateStr(excludeBookingDates.checkIn);
      const normalizedExcludeEnd = normalizeDateStr(excludeBookingDates.checkOut);
      if (dateStr >= normalizedExcludeStart && dateStr <= normalizedExcludeEnd) {
        console.log(`✅ [isDateUnavailable] Date ${dateStr} disponible (réservation actuelle): ${normalizedExcludeStart} - ${normalizedExcludeEnd}`);
        return false; // La date est disponible car elle fait partie de la réservation actuelle
      }
    }
    
    const isUnavailable = unavailableDates.some(({ start_date, end_date }) => {
      // Normaliser les dates de début et fin
      const normalizedStart = normalizeDateStr(start_date);
      const normalizedEnd = normalizeDateStr(end_date);
      
      // Vérifier si la date est dans la période [start_date, end_date] (inclus)
      // IMPORTANT: Utiliser >= et <= pour inclure les dates limites
      const isInPeriod = dateStr >= normalizedStart && dateStr <= normalizedEnd;
      
      if (isInPeriod) {
        console.log(`🚫 [isDateUnavailable] Date ${dateStr} indisponible: période ${normalizedStart} - ${normalizedEnd}`);
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
    
    // ✅ Si cette plage fait partie de la réservation actuelle (en modification), elle est disponible
    if (excludeBookingDates) {
      const normalizedExcludeStart = normalizeDateStr(excludeBookingDates.checkIn);
      const normalizedExcludeEnd = normalizeDateStr(excludeBookingDates.checkOut);
      // Vérifier si la plage sélectionnée est entièrement contenue dans la réservation actuelle
      if (startStr >= normalizedExcludeStart && endStr <= normalizedExcludeEnd) {
        console.log(`✅ [isDateRangeUnavailable] Plage ${startStr} - ${endStr} disponible (réservation actuelle): ${normalizedExcludeStart} - ${normalizedExcludeEnd}`);
        return false; // La plage est disponible car elle fait partie de la réservation actuelle
      }
    }
    
    // Vérifier si la plage chevauche une période indisponible
    // Deux plages se chevauchent si : start < existingEnd && end > existingStart
    return unavailableDates.some(({ start_date, end_date }) => {
      const normalizedStart = normalizeDateStr(start_date);
      const normalizedEnd = normalizeDateStr(end_date);
      
      // Vérifier le chevauchement
      const overlaps = startStr < normalizedEnd && endStr > normalizedStart;
      
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
