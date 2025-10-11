import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';

export interface HostBooking {
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
  discount_applied?: boolean;
  discount_amount?: number;
  original_total?: number;
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
  guest_profile?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

export const useHostBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { 
    sendBookingRequest, 
    sendBookingRequestSent, 
    sendBookingResponse, 
    sendBookingConfirmed, 
    sendBookingConfirmedHost,
    sendBookingCancelled,
    sendBookingCancelledHost 
  } = useEmailService();

  const getHostBookings = useCallback(async (): Promise<HostBooking[]> => {
    if (!user) {
      setError('Vous devez être connecté');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 [useHostBookings] Chargement des réservations hôte pour:', user.id);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          properties!inner(
            id,
            title,
            price_per_night,
            images,
            host_id,
            cities(
              name,
              region
            )
          ),
          guest_profile:profiles!bookings_guest_id_fkey(
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('properties.host_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [useHostBookings] Erreur lors du chargement:', error);
        setError('Erreur lors du chargement des réservations');
        return [];
      }

      console.log('✅ [useHostBookings] Réservations chargées:', data?.length || 0);
      return data || [];
    } catch (err) {
      console.error('❌ [useHostBookings] Erreur inattendue:', err);
      setError('Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateBookingStatus = useCallback(async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 [useHostBookings] Mise à jour statut réservation:', bookingId, 'vers:', status);

      // Récupérer les détails de la réservation pour l'email
      const { data: bookingData, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          properties!inner(
            id,
            title,
            host_id,
            cities(name)
          ),
          guest_profile:profiles!bookings_guest_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', bookingId)
        .eq('properties.host_id', user.id)
        .single();

      if (fetchError || !bookingData) {
        console.error('❌ [useHostBookings] Réservation non trouvée:', fetchError);
        setError('Réservation non trouvée');
        return { success: false };
      }

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('❌ [useHostBookings] Erreur mise à jour:', updateError);
        setError('Erreur lors de la mise à jour');
        return { success: false };
      }

      // Envoyer les emails selon le statut
      try {
        if (status === 'confirmed') {
          // Email de confirmation au voyageur
          await sendBookingResponse(
            bookingData.guest_profile.email,
            `${bookingData.guest_profile.first_name} ${bookingData.guest_profile.last_name}`,
            bookingData.properties.title,
            bookingData.check_in_date,
            bookingData.check_out_date,
            bookingData.guests_count,
            bookingData.total_price,
            'confirmed'
          );

          // Email de confirmation à l'hôte
          await sendBookingConfirmedHost(
            user.email || '',
            `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`,
            `${bookingData.guest_profile.first_name} ${bookingData.guest_profile.last_name}`,
            bookingData.properties.title,
            bookingData.check_in_date,
            bookingData.check_out_date,
            bookingData.guests_count,
            bookingData.total_price
          );

          console.log('✅ [useHostBookings] Emails de confirmation envoyés');
        } else if (status === 'cancelled') {
          // Email d'annulation au voyageur
          await sendBookingResponse(
            bookingData.guest_profile.email,
            `${bookingData.guest_profile.first_name} ${bookingData.guest_profile.last_name}`,
            bookingData.properties.title,
            bookingData.check_in_date,
            bookingData.check_out_date,
            bookingData.guests_count,
            bookingData.total_price,
            'cancelled'
          );

          // Email d'annulation à l'hôte
          await sendBookingCancelledHost(
            user.email || '',
            `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`,
            `${bookingData.guest_profile.first_name} ${bookingData.guest_profile.last_name}`,
            bookingData.properties.title,
            bookingData.check_in_date,
            bookingData.check_out_date,
            bookingData.guests_count,
            bookingData.total_price
          );

          console.log('✅ [useHostBookings] Emails d\'annulation envoyés');
        }
      } catch (emailError) {
        console.error('❌ [useHostBookings] Erreur envoi email:', emailError);
        // Ne pas faire échouer la mise à jour si l'email échoue
      }

      console.log('✅ [useHostBookings] Statut mis à jour avec succès');
      return { success: true };
    } catch (err) {
      console.error('❌ [useHostBookings] Erreur inattendue:', err);
      setError('Erreur lors de la mise à jour');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [user, sendBookingResponse, sendBookingConfirmedHost, sendBookingCancelledHost]);

  return {
    getHostBookings,
    updateBookingStatus,
    loading,
    error,
  };
};
