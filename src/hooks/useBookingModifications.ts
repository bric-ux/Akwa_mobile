import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export interface BookingModificationRequest {
  id: string;
  booking_id: string;
  guest_id: string;
  host_id: string;
  original_check_in: string;
  original_check_out: string;
  original_guests_count: number;
  original_total_price: number;
  requested_check_in: string;
  requested_check_out: string;
  requested_guests_count: number;
  requested_total_price: number;
  guest_message: string | null;
  host_response_message: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  responded_at: string | null;
}

export const useBookingModifications = () => {
  const [loading, setLoading] = useState(false);

  // Créer une demande de modification (voyageur)
  const createModificationRequest = async (data: {
    bookingId: string;
    guestId: string;
    hostId: string;
    originalCheckIn: string;
    originalCheckOut: string;
    originalGuestsCount: number;
    originalTotalPrice: number;
    requestedCheckIn: string;
    requestedCheckOut: string;
    requestedGuestsCount: number;
    requestedTotalPrice: number;
    guestMessage?: string;
  }) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('booking_modification_requests')
        .insert({
          booking_id: data.bookingId,
          guest_id: data.guestId,
          host_id: data.hostId,
          original_check_in: data.originalCheckIn,
          original_check_out: data.originalCheckOut,
          original_guests_count: data.originalGuestsCount,
          original_total_price: data.originalTotalPrice,
          requested_check_in: data.requestedCheckIn,
          requested_check_out: data.requestedCheckOut,
          requested_guests_count: data.requestedGuestsCount,
          requested_total_price: data.requestedTotalPrice,
          guest_message: data.guestMessage || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert(
        'Demande envoyée',
        'Votre demande de modification a été envoyée à l\'hôte. Vous serez notifié de sa réponse.',
        [{ text: 'OK' }]
      );

      return { success: true, data: result };
    } catch (error: any) {
      console.error('Erreur création demande modification:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'envoyer la demande de modification.',
        [{ text: 'OK' }]
      );
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les demandes de modification pour un voyageur
  const getGuestModificationRequests = async (guestId: string) => {
    try {
      const { data, error } = await supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BookingModificationRequest[];
    } catch (error) {
      console.error('Erreur récupération demandes:', error);
      return [];
    }
  };

  // Récupérer les demandes de modification pour un hôte
  const getHostModificationRequests = async (hostId: string) => {
    try {
      const { data, error } = await supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BookingModificationRequest[];
    } catch (error) {
      console.error('Erreur récupération demandes:', error);
      return [];
    }
  };

  // Récupérer les demandes en attente pour un hôte
  const getPendingRequestsForHost = async (hostId: string) => {
    try {
      const { data, error } = await supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('host_id', hostId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BookingModificationRequest[];
    } catch (error) {
      console.error('Erreur récupération demandes en attente:', error);
      return [];
    }
  };

  // Vérifier si une réservation a une demande en cours
  const getBookingPendingRequest = async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return data as BookingModificationRequest | null;
    } catch (error) {
      console.error('Erreur vérification demande en cours:', error);
      return null;
    }
  };

  // Approuver une demande (hôte)
  const approveModificationRequest = async (requestId: string, hostMessage?: string) => {
    setLoading(true);
    try {
      // Récupérer la demande
      const { data: request, error: fetchError } = await supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Mettre à jour la réservation originale
      const { error: updateBookingError } = await supabase
        .from('bookings')
        .update({
          check_in_date: request.requested_check_in,
          check_out_date: request.requested_check_out,
          guests_count: request.requested_guests_count,
          total_price: request.requested_total_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.booking_id);

      if (updateBookingError) throw updateBookingError;

      // Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('booking_modification_requests')
        .update({
          status: 'approved',
          host_response_message: hostMessage || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      Alert.alert(
        'Modification approuvée',
        'La réservation a été mise à jour.',
        [{ text: 'OK' }]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Erreur approbation:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'approuver la modification.',
        [{ text: 'OK' }]
      );
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Rejeter une demande (hôte)
  const rejectModificationRequest = async (requestId: string, hostMessage?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('booking_modification_requests')
        .update({
          status: 'rejected',
          host_response_message: hostMessage || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert(
        'Modification refusée',
        'La demande de modification a été refusée.',
        [{ text: 'OK' }]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Erreur rejet:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de refuser la modification.',
        [{ text: 'OK' }]
      );
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Annuler une demande (voyageur)
  const cancelModificationRequest = async (requestId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('booking_modification_requests')
        .update({
          status: 'cancelled'
        })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert(
        'Demande annulée',
        'Votre demande de modification a été annulée.',
        [{ text: 'OK' }]
      );

      return { success: true };
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'annuler la demande.',
        [{ text: 'OK' }]
      );
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createModificationRequest,
    getGuestModificationRequests,
    getHostModificationRequests,
    getPendingRequestsForHost,
    getBookingPendingRequest,
    approveModificationRequest,
    rejectModificationRequest,
    cancelModificationRequest
  };
};















