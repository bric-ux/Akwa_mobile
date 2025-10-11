import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';

export interface BookingData {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  totalPrice: number;
  messageToHost?: string;
  discountApplied?: boolean;
  discountAmount?: number;
  originalTotal?: number;
}

export interface Booking {
  id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  adults_count: number;
  children_count: number;
  infants_count: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  message_to_host?: string;
  special_requests?: string;
  cancellation_penalty?: number;
  cancelled_by?: string;
  cancellation_reason?: string;
  discount_applied?: boolean;
  discount_amount?: number;
  original_total?: number;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  properties?: {
    id: string;
    title: string;
    price_per_night: number;
    images: string[];
    cities?: {
      name: string;
      region: string;
    };
  };
}

export const useBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendBookingRequest, sendBookingRequestSent } = useEmailService();

  const createBooking = async (bookingData: BookingData) => {
    if (!user) {
      setError('Vous devez être connecté pour effectuer une réservation');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Récupérer les infos de la propriété
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('auto_booking, minimum_nights, max_guests')
        .eq('id', bookingData.propertyId)
        .single();

      if (propertyError) {
        console.error('Property fetch error:', propertyError);
        setError('Erreur lors de la récupération des informations de la propriété');
        return { success: false, error: 'Erreur lors de la récupération des informations de la propriété' };
      }

      // Vérification de la disponibilité des dates
      const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('check_in_date, check_out_date, status')
        .eq('property_id', bookingData.propertyId)
        .in('status', ['pending', 'confirmed']);

      if (checkError) {
        console.error('Availability check error:', checkError);
        setError('Erreur lors de la vérification de la disponibilité');
        return { success: false, error: 'Erreur lors de la vérification de la disponibilité' };
      }

      // Vérifier les conflits de dates
      const hasConflict = existingBookings?.some(booking => {
        const existingCheckIn = new Date(booking.check_in_date);
        const existingCheckOut = new Date(booking.check_out_date);
        const newCheckIn = new Date(bookingData.checkInDate);
        const newCheckOut = new Date(bookingData.checkOutDate);

        return (
          (newCheckIn >= existingCheckIn && newCheckIn < existingCheckOut) ||
          (newCheckOut > existingCheckIn && newCheckOut <= existingCheckOut) ||
          (newCheckIn <= existingCheckIn && newCheckOut >= existingCheckOut)
        );
      });

      if (hasConflict) {
        setError('Ces dates ne sont pas disponibles');
        return { success: false, error: 'Ces dates ne sont pas disponibles' };
      }

      // Vérifier le nombre minimum de nuits
      const nights = Math.ceil(
        (new Date(bookingData.checkOutDate).getTime() - new Date(bookingData.checkInDate).getTime()) 
        / (1000 * 60 * 60 * 24)
      );

      if (nights < (propertyData.minimum_nights || 1)) {
        setError(`Cette propriété nécessite un minimum de ${propertyData.minimum_nights || 1} nuit(s)`);
        return { success: false, error: `Cette propriété nécessite un minimum de ${propertyData.minimum_nights || 1} nuit(s)` };
      }

      // Vérifier le nombre maximum de voyageurs
      if (bookingData.guestsCount > (propertyData.max_guests || 10)) {
        setError(`Le nombre maximum de voyageurs est ${propertyData.max_guests || 10}`);
        return { success: false, error: `Le nombre maximum de voyageurs est ${propertyData.max_guests || 10}` };
      }

      // Créer la réservation
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          property_id: bookingData.propertyId,
          guest_id: user.id,
          check_in_date: bookingData.checkInDate,
          check_out_date: bookingData.checkOutDate,
          guests_count: bookingData.guestsCount,
          adults_count: bookingData.adultsCount || 1,
          children_count: bookingData.childrenCount || 0,
          infants_count: bookingData.infantsCount || 0,
          total_price: bookingData.totalPrice,
          message_to_host: bookingData.messageToHost,
          special_requests: bookingData.messageToHost,
          discount_applied: bookingData.discountApplied || false,
          discount_amount: bookingData.discountAmount || 0,
          original_total: bookingData.originalTotal || bookingData.totalPrice,
          status: propertyData.auto_booking ? 'confirmed' : 'pending',
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        setError('Erreur lors de la création de la réservation');
        return { success: false, error: `Erreur lors de la création de la réservation: ${bookingError.message}` };
      }

      // Envoyer les emails après création de la réservation
      try {
        // Récupérer les informations de l'hôte et du voyageur
        const { data: propertyInfo, error: propertyInfoError } = await supabase
          .from('properties')
          .select(`
            title,
            host_id,
            profiles!properties_host_id_fkey(
              first_name,
              last_name,
              email
            )
          `)
          .eq('id', bookingData.propertyId)
          .single();

        if (propertyInfoError) {
          console.error('❌ [useBookings] Erreur récupération infos propriété:', propertyInfoError);
        } else {
          const hostProfile = propertyInfo.profiles;
          const guestName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur';
          
          // Email de notification à l'hôte
          await sendBookingRequest(
            hostProfile.email,
            `${hostProfile.first_name} ${hostProfile.last_name}`,
            guestName,
            propertyInfo.title,
            bookingData.checkInDate,
            bookingData.checkOutDate,
            bookingData.guestsCount,
            bookingData.totalPrice,
            bookingData.messageToHost
          );

          // Email de confirmation au voyageur
          await sendBookingRequestSent(
            user.email || '',
            guestName,
            propertyInfo.title,
            bookingData.checkInDate,
            bookingData.checkOutDate,
            bookingData.guestsCount,
            bookingData.totalPrice
          );

          console.log('✅ [useBookings] Emails de réservation envoyés');
        }
      } catch (emailError) {
        console.error('❌ [useBookings] Erreur envoi email:', emailError);
        // Ne pas faire échouer la réservation si l'email échoue
      }

      return { success: true, booking };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false, error: `Une erreur inattendue est survenue: ${err}` };
    } finally {
      setLoading(false);
    }
  };

  const getUserBookings = async () => {
    if (!user) {
      setError('Vous devez être connecté pour voir vos réservations');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          properties (
            id,
            title,
            price_per_night,
            images,
            cities (
              name,
              region
            )
          )
        `)
        .eq('guest_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        setError('Erreur lors du chargement des réservations');
        return [];
      }

      // Mettre à jour automatiquement le statut des réservations passées
      const updatedBookings = await updateBookingStatuses(bookings as Booking[]);

      return updatedBookings;
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatuses = async (bookings: Booking[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Commencer à minuit pour la comparaison

    // Retourner les réservations avec les statuts mis à jour côté client uniquement
    // Évite les erreurs de contraintes de la base de données
    return bookings.map(booking => {
      const checkOutDate = new Date(booking.check_out_date);
      checkOutDate.setHours(0, 0, 0, 0);

      // Si la date de checkout est passée et que le statut n'est pas déjà terminé ou annulé
      if (checkOutDate < today && 
          booking.status !== 'completed' && 
          booking.status !== 'cancelled') {
        console.log(`Réservation ${booking.id} marquée comme terminée côté client`);
        return { ...booking, status: 'completed' as const };
      }
      return booking;
    });
  };

  const cancelBooking = async (bookingId: string) => {
    if (!user) {
      setError('Vous devez être connecté pour annuler une réservation');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier d'abord le statut de la réservation
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('status, check_out_date')
        .eq('id', bookingId)
        .eq('guest_id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching booking:', fetchError);
        setError('Erreur lors de la récupération de la réservation');
        return { success: false };
      }

      // Vérifier si la réservation peut être annulée
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkOutDate = new Date(booking.check_out_date);
      checkOutDate.setHours(0, 0, 0, 0);

      if (booking.status === 'completed') {
        setError('Impossible d\'annuler une réservation terminée');
        return { success: false, error: 'Impossible d\'annuler une réservation terminée' };
      }

      if (booking.status === 'cancelled') {
        setError('Cette réservation est déjà annulée');
        return { success: false, error: 'Cette réservation est déjà annulée' };
      }

      if (checkOutDate < today) {
        setError('Impossible d\'annuler une réservation dont les dates sont passées');
        return { success: false, error: 'Impossible d\'annuler une réservation dont les dates sont passées' };
      }

      // Procéder à l'annulation
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled'
        })
        .eq('id', bookingId)
        .eq('guest_id', user.id);

      if (error) {
        console.error('Error cancelling booking:', error);
        setError('Erreur lors de l\'annulation de la réservation');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    createBooking,
    getUserBookings,
    cancelBooking,
    loading,
    error,
  };
};
