import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';
import { useIdentityVerification } from './useIdentityVerification';
import { useBookingPDF } from './useBookingPDF';

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
  voucherCode?: string;
  paymentMethod?: string;
  paymentPlan?: string;
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
    host_id: string;
    max_guests?: number;
    cleaning_fee?: number;
    service_fee?: number;
    cancellation_policy?: string | null;
    images: string[];
    property_photos?: {
      id: string;
      url: string;
      category: string;
      display_order: number;
    }[];
    locations?: {
      id: string;
      name: string;
      type: string;
      latitude?: number;
      longitude?: number;
      parent_id?: string;
    };
    location?: {
      id: string;
      name: string;
      type: string;
      latitude?: number;
      longitude?: number;
      parent_id?: string;
    };
  };
}

export const useBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendBookingRequest, sendBookingRequestSent, sendBookingConfirmed, sendBookingConfirmedHost } = useEmailService();
  const { hasUploadedIdentity, isVerified, loading: identityLoading } = useIdentityVerification();
  const { generateAndSendBookingPDF } = useBookingPDF();

  const createBooking = async (bookingData: BookingData) => {
    if (!user) {
      setError('Vous devez être connecté pour effectuer une réservation');
      return { success: false };
    }

    // Vérifier si l'identité est vérifiée (même logique que le site web)
    if (identityLoading) {
      setError('Vérification de l\'identité en cours...');
      return { success: false };
    }

    if (!hasUploadedIdentity) {
      setError('IDENTITY_REQUIRED');
      return { success: false };
    }

    if (!isVerified) {
      setError('IDENTITY_NOT_VERIFIED');
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

      // Vérification de la disponibilité des dates (uniquement réservations CONFIRMÉES + dates bloquées)
      // Les réservations pending ne bloquent pas les dates (comme sur le site web)
      const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date')
        .eq('property_id', bookingData.propertyId)
        .eq('status', 'confirmed')
        .or(`and(check_in_date.lte.${bookingData.checkInDate},check_out_date.gt.${bookingData.checkInDate}),and(check_in_date.lt.${bookingData.checkOutDate},check_out_date.gte.${bookingData.checkOutDate}),and(check_in_date.gte.${bookingData.checkInDate},check_out_date.lte.${bookingData.checkOutDate})`);

      if (checkError) {
        console.error('Availability check error:', checkError);
        setError('Erreur lors de la vérification de disponibilité');
        return { success: false, error: 'Erreur lors de la vérification de disponibilité' };
      }

      // Vérifier aussi les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('start_date, end_date')
        .eq('property_id', bookingData.propertyId);

      if (blockedError) {
        console.error('Blocked dates check error:', blockedError);
        setError('Erreur lors de la vérification des dates bloquées');
        return { success: false, error: 'Erreur lors de la vérification des dates bloquées' };
      }

      // Vérifier les conflits avec les réservations confirmées
      if (existingBookings && existingBookings.length > 0) {
        setError('Ces dates sont déjà réservées');
        return { success: false, error: 'Ces dates sont déjà réservées' };
      }

      // Vérifier les conflits avec les dates bloquées
      const hasBlockedConflict = blockedDates?.some(({ start_date, end_date }) => {
        const blockedStart = new Date(start_date);
        const blockedEnd = new Date(end_date);
        const bookingStart = new Date(bookingData.checkInDate);
        const bookingEnd = new Date(bookingData.checkOutDate);
        
        return (
          (bookingStart >= blockedStart && bookingStart < blockedEnd) ||
          (bookingEnd > blockedStart && bookingEnd <= blockedEnd) ||
          (bookingStart <= blockedStart && bookingEnd >= blockedEnd)
        );
      });

      if (hasBlockedConflict) {
        setError('Ces dates sont bloquées par le propriétaire');
        return { success: false, error: 'Ces dates sont bloquées par le propriétaire' };
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
          payment_method: bookingData.paymentMethod || null,
          payment_plan: bookingData.paymentPlan || null,
          status: propertyData.auto_booking ? 'confirmed' : 'pending',
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        setError('Erreur lors de la création de la réservation');
        return { success: false, error: `Erreur lors de la création de la réservation: ${bookingError.message}` };
      }

      // Marquer le code promotionnel comme utilisé si un code a été fourni
      if (bookingData.voucherCode && booking?.id) {
        try {
          const { error: voucherError } = await supabase
            .from('user_discount_vouchers')
            .update({
              status: 'used',
              used_on_booking_id: booking.id,
              used_at: new Date().toISOString()
            })
            .eq('voucher_code', bookingData.voucherCode.toUpperCase().trim())
            .eq('user_id', user.id)
            .eq('status', 'active');

          if (voucherError) {
            console.error('Error updating voucher:', voucherError);
            // Ne pas faire échouer la réservation si la mise à jour du voucher échoue
          }
        } catch (voucherUpdateError) {
          console.error('Error updating voucher:', voucherUpdateError);
          // Ne pas faire échouer la réservation si la mise à jour du voucher échoue
        }
      }

      // Envoyer les emails après création de la réservation
      try {
        // Récupérer les informations complètes de la propriété, hôte et voyageur
        const { data: propertyInfo, error: propertyInfoError } = await supabase
          .from('properties')
          .select(`
            title,
            host_id,
            address,
            price_per_night,
            cleaning_fee,
            service_fee,
            taxes,
            cancellation_policy,
            check_in_time,
            check_out_time,
            house_rules,
            locations:location_id(
              id,
              name,
              type,
              latitude,
              longitude,
              parent_id
            ),
            profiles!properties_host_id_fkey(
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .eq('id', bookingData.propertyId)
          .single();

        if (propertyInfoError) {
          console.error('❌ [useBookings] Erreur récupération infos propriété:', propertyInfoError);
        } else {
          const hostProfile = propertyInfo.profiles;
          const guestName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur';
          const hostName = `${hostProfile.first_name} ${hostProfile.last_name}`;
          
          // Si auto_booking est true, la réservation est directement confirmée
          if (propertyData.auto_booking && booking?.status === 'confirmed') {
            // Préparer les données pour le PDF
            const pdfBookingData = {
              id: booking.id,
              property: {
                title: propertyInfo.title,
                address: propertyInfo.address || '',
                city_name: propertyInfo.locations?.name || '',
                city_region: propertyInfo.locations?.type === 'city' ? propertyInfo.locations?.name : '',
                price_per_night: propertyInfo.price_per_night || 0,
                cleaning_fee: propertyInfo.cleaning_fee || 0,
                service_fee: propertyInfo.service_fee || 0,
                taxes: propertyInfo.taxes || 0,
                cancellation_policy: propertyInfo.cancellation_policy || 'flexible'
              },
              guest: {
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || '',
                email: user.email || '',
                phone: user.user_metadata?.phone || ''
              },
              host: {
                first_name: hostProfile.first_name || '',
                last_name: hostProfile.last_name || '',
                email: hostProfile.email || '',
                phone: hostProfile.phone || ''
              },
              check_in_date: bookingData.checkInDate,
              check_out_date: bookingData.checkOutDate,
              guests_count: bookingData.guestsCount,
              total_price: bookingData.totalPrice,
              status: 'confirmed',
              created_at: booking.created_at,
              message: bookingData.messageToHost || '',
              discount_applied: bookingData.discountApplied || false,
              discount_amount: bookingData.discountAmount || 0,
              original_total: bookingData.originalTotal || bookingData.totalPrice,
              payment_method: bookingData.paymentMethod || '',
              payment_plan: bookingData.paymentPlan || ''
            };

            // Générer le PDF et envoyer les emails de confirmation
            try {
              const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-booking-pdf', {
                body: { bookingData: pdfBookingData }
              });

              if (pdfError) {
                console.log('⚠️ [useBookings] PDF non généré, envoi email sans pièce jointe');
                
                // Email au voyageur sans PDF
                await sendBookingConfirmed(
                  user.email || '',
                  guestName,
                  propertyInfo.title,
                  bookingData.checkInDate,
                  bookingData.checkOutDate,
                  bookingData.guestsCount,
                  bookingData.totalPrice,
                  hostName,
                  hostProfile.phone || '',
                  hostProfile.email || '',
                  propertyInfo.address || '',
                  bookingData.messageToHost
                );

                // Email à l'hôte sans PDF
                await sendBookingConfirmedHost(
                  hostProfile.email,
                  hostName,
                  guestName,
                  propertyInfo.title,
                  bookingData.checkInDate,
                  bookingData.checkOutDate,
                  bookingData.guestsCount,
                  bookingData.totalPrice
                );
              } else if (pdfData?.success && pdfData?.pdf) {
                console.log('✅ [useBookings] PDF généré avec succès');
                
                // Email au voyageur avec PDF
                await supabase.functions.invoke('send-email', {
                  body: {
                    type: 'booking_confirmed',
                    to: user.email || '',
                    data: {
                      bookingId: booking.id,
                      guestName: guestName,
                      propertyTitle: propertyInfo.title,
                      checkIn: bookingData.checkInDate,
                      checkOut: bookingData.checkOutDate,
                      guests: bookingData.guestsCount,
                      totalPrice: bookingData.totalPrice,
                      hostName: hostName,
                      hostPhone: hostProfile.phone || '',
                      hostEmail: hostProfile.email || '',
                      propertyAddress: propertyInfo.address || '',
                      specialMessage: bookingData.messageToHost
                    },
                    attachments: [{
                      filename: pdfData.filename || `reservation-${booking.id}.pdf`,
                      content: pdfData.pdf,
                      type: 'application/pdf'
                    }]
                  }
                });

                // Email à l'hôte avec PDF
                await supabase.functions.invoke('send-email', {
                  body: {
                    type: 'booking_confirmed_host',
                    to: hostProfile.email,
                    data: {
                      bookingId: booking.id,
                      hostName: hostName,
                      guestName: guestName,
                      propertyTitle: propertyInfo.title,
                      checkIn: bookingData.checkInDate,
                      checkOut: bookingData.checkOutDate,
                      guests: bookingData.guestsCount,
                      totalPrice: bookingData.totalPrice
                    },
                    attachments: [{
                      filename: pdfData.filename || `reservation-${booking.id}.pdf`,
                      content: pdfData.pdf,
                      type: 'application/pdf'
                    }]
                  }
                });
              }
            } catch (pdfEmailError) {
              console.error('❌ [useBookings] Erreur génération PDF/email:', pdfEmailError);
              // Envoyer les emails sans PDF en cas d'erreur
              await sendBookingConfirmed(
                user.email || '',
                guestName,
                propertyInfo.title,
                bookingData.checkInDate,
                bookingData.checkOutDate,
                bookingData.guestsCount,
                bookingData.totalPrice,
                hostName,
                hostProfile.phone || '',
                hostProfile.email || '',
                propertyInfo.address || '',
                bookingData.messageToHost
              );
              await sendBookingConfirmedHost(
                hostProfile.email,
                hostName,
                guestName,
                propertyInfo.title,
                bookingData.checkInDate,
                bookingData.checkOutDate,
                bookingData.guestsCount,
                bookingData.totalPrice
              );
            }
          } else {
            // Réservation en attente - envoyer les emails de demande
            // Email de notification à l'hôte
            await sendBookingRequest(
              hostProfile.email,
              hostName,
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
          }

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
            host_id,
            max_guests,
            cleaning_fee,
            service_fee,
            cancellation_policy,
            images,
            property_photos (
              id,
              url,
              category,
              display_order
            ),
            locations:location_id (
              id,
              name,
              type,
              latitude,
              longitude,
              parent_id
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
