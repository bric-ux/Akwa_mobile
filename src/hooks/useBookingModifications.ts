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
      // Récupérer les informations de la réservation pour les emails
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          properties!inner(
            title,
            host_id
          ),
          profiles!bookings_guest_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', data.bookingId)
        .single();

      if (bookingError) throw bookingError;

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

      // Envoyer les emails de notification
      try {
        // Récupérer les profils de l'hôte et du voyageur
        const [hostResult, guestResult] = await Promise.all([
          bookingData?.properties?.host_id
            ? supabase
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('user_id', bookingData.properties.host_id)
                .single()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', data.guestId)
            .single()
        ]);

        const hostData = hostResult.data;
        const guestData = guestResult.data;

        // Email à l'hôte
        if (hostData?.email) {
          try {
            const hostEmailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'booking_modification_requested',
                to: hostData.email,
                data: {
                  hostName: `${hostData.first_name || ''} ${hostData.last_name || ''}`.trim(),
                  guestName: `${guestData?.first_name || ''} ${guestData?.last_name || ''}`.trim() || 'Voyageur',
                  propertyTitle: bookingData.properties.title,
                  originalCheckIn: data.originalCheckIn,
                  originalCheckOut: data.originalCheckOut,
                  originalGuests: data.originalGuestsCount,
                  originalPrice: data.originalTotalPrice,
                  requestedCheckIn: data.requestedCheckIn,
                  requestedCheckOut: data.requestedCheckOut,
                  requestedGuests: data.requestedGuestsCount,
                  requestedPrice: data.requestedTotalPrice,
                  guestMessage: data.guestMessage || null,
                  bookingId: data.bookingId
                }
              }
            });
            
            if (hostEmailResponse.error) {
              console.error('❌ Erreur envoi email à l\'hôte:', hostEmailResponse.error);
            } else {
              console.log('✅ Email de demande de modification envoyé à l\'hôte:', hostData.email);
            }
          } catch (hostEmailError) {
            console.error('❌ Erreur lors de l\'envoi de l\'email à l\'hôte:', hostEmailError);
          }
        } else {
          console.warn('⚠️ Pas d\'email hôte trouvé pour host_id:', bookingData?.properties?.host_id);
        }

        // Email au voyageur (confirmation explicite)
        if (guestData?.email) {
          try {
            // S'assurer que toutes les données nécessaires sont présentes
            const emailData = {
              guestName: `${guestData.first_name || ''} ${guestData.last_name || ''}`.trim() || 'Cher voyageur',
              propertyTitle: bookingData.properties?.title || 'Propriété',
              requestedCheckIn: data.requestedCheckIn,
              requestedCheckOut: data.requestedCheckOut,
              requestedGuests: data.requestedGuestsCount || 1,
              requestedPrice: typeof data.requestedTotalPrice === 'number' ? data.requestedTotalPrice : Number(data.requestedTotalPrice) || 0,
            };
            
            // Vérifier que le type d'email est correct
            const emailType = 'booking_modification_request_sent';
            
            console.log('📧 [useBookingModifications] Envoi email explicite au voyageur:', {
              to: guestData.email,
              type: emailType,
              data: emailData
            });
            
            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: emailType,
                to: guestData.email,
                data: emailData
              }
            });
            
            if (emailResponse.error) {
              console.error('❌ [useBookingModifications] Erreur envoi email au voyageur:', emailResponse.error);
              console.error('❌ [useBookingModifications] Détails erreur:', JSON.stringify(emailResponse.error, null, 2));
            } else {
              console.log('✅ [useBookingModifications] Email explicite de confirmation envoyé au voyageur:', guestData.email);
              console.log('✅ [useBookingModifications] Type d\'email utilisé:', emailType);
              console.log('✅ [useBookingModifications] Réponse email:', emailResponse.data);
            }
          } catch (guestEmailError: any) {
            console.error('❌ [useBookingModifications] Erreur lors de l\'envoi de l\'email au voyageur:', guestEmailError);
            console.error('❌ [useBookingModifications] Stack trace:', guestEmailError?.stack);
          }
        } else {
          console.warn('⚠️ [useBookingModifications] Pas d\'email voyageur trouvé pour guest_id:', data.guestId);
          console.warn('⚠️ [useBookingModifications] Données guestData:', guestData);
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email demande modification:', emailError);
        // Ne pas faire échouer la création si l'email échoue
      }

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
      // Récupérer la demande avec les détails de la réservation et du voyageur
      const { data: request, error: fetchError } = await supabase
        .from('booking_modification_requests')
        .select(`
          *,
          booking:bookings(
            id,
            property_id,
            discount_amount,
            discount_applied,
            payment_method,
            payment_plan,
            properties(
              title,
              host_id,
              price_per_night,
              cleaning_fee,
              service_fee,
              taxes,
              address,
              check_in_time,
              check_out_time,
              house_rules,
              cancellation_policy,
              free_cleaning_min_days,
              discount_enabled,
              discount_min_nights,
              discount_percentage,
              long_stay_discount_enabled,
              long_stay_discount_min_nights,
              long_stay_discount_percentage,
              locations(
                name,
                type
              )
            )
          )
        `)
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

      // Récupérer la réservation mise à jour pour obtenir les nouvelles valeurs (discount_amount, etc.)
      const { data: updatedBooking, error: fetchUpdatedError } = await supabase
        .from('bookings')
        .select('discount_amount, discount_applied, original_total')
        .eq('id', request.booking_id)
        .single();

      if (fetchUpdatedError) {
        console.warn('⚠️ Impossible de récupérer la réservation mise à jour, utilisation des valeurs de la demande:', fetchUpdatedError);
      }

      // Récupérer les profils du voyageur et de l'hôte
      const { data: guestProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone')
        .eq('user_id', request.guest_id)
        .single();

      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone')
        .eq('user_id', request.host_id)
        .single();

      // Envoyer les emails avec PDF
      if (guestProfile?.email) {
        const bookingData = {
          bookingId: request.booking_id,
          propertyTitle: request.booking?.properties?.title || 'Votre réservation',
          guestName: `${guestProfile.first_name} ${guestProfile.last_name}`,
          hostName: hostProfile ? `${hostProfile.first_name} ${hostProfile.last_name}` : 'L\'hôte',
          checkIn: request.requested_check_in,
          checkOut: request.requested_check_out,
          check_in_date: request.requested_check_in,
          check_out_date: request.requested_check_out,
          guestsCount: request.requested_guests_count,
          guests: request.requested_guests_count,
          totalPrice: request.requested_total_price,
          total_price: request.requested_total_price,
          pricePerNight: request.booking?.properties?.price_per_night || 0,
          discountAmount: updatedBooking?.discount_amount ?? request.booking?.discount_amount ?? 0,
          discount_amount: updatedBooking?.discount_amount ?? request.booking?.discount_amount ?? 0,
          discountApplied: updatedBooking?.discount_applied ?? request.booking?.discount_applied ?? false,
          discount_applied: updatedBooking?.discount_applied ?? request.booking?.discount_applied ?? false,
          original_total: updatedBooking?.original_total ?? request.booking?.original_total ?? undefined,
          cleaningFee: request.booking?.properties?.cleaning_fee || 0,
          property: {
            title: request.booking?.properties?.title || 'Votre réservation',
            address: request.booking?.properties?.address || '',
            city_name: request.booking?.properties?.locations?.name || '',
            city_region: request.booking?.properties?.locations?.type === 'region' ? request.booking?.properties?.locations?.name : '',
            price_per_night: request.booking?.properties?.price_per_night || 0,
            cleaning_fee: request.booking?.properties?.cleaning_fee || 0,
            service_fee: request.booking?.properties?.service_fee || 0,
            taxes: request.booking?.properties?.taxes || 0,
            free_cleaning_min_days: request.booking?.properties?.free_cleaning_min_days || null,
            discount_enabled: request.booking?.properties?.discount_enabled || false,
            discount_min_nights: request.booking?.properties?.discount_min_nights || null,
            discount_percentage: request.booking?.properties?.discount_percentage || null,
            long_stay_discount_enabled: request.booking?.properties?.long_stay_discount_enabled || false,
            long_stay_discount_min_nights: request.booking?.properties?.long_stay_discount_min_nights || null,
            long_stay_discount_percentage: request.booking?.properties?.long_stay_discount_percentage || null,
            cancellation_policy: request.booking?.properties?.cancellation_policy || 'flexible',
            check_in_time: request.booking?.properties?.check_in_time,
            check_out_time: request.booking?.properties?.check_out_time,
            house_rules: request.booking?.properties?.house_rules
          },
          guest: {
            first_name: guestProfile.first_name,
            last_name: guestProfile.last_name,
            email: guestProfile.email,
            phone: guestProfile.phone
          },
          host: {
            first_name: hostProfile?.first_name,
            last_name: hostProfile?.last_name,
            email: hostProfile?.email,
            phone: hostProfile?.phone
          }
        };

        // Email de modification approuvée avec nouvelle facture au voyageur
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'booking_modification_approved',
            to: guestProfile.email,
            data: {
              ...bookingData,
              newCheckIn: request.requested_check_in,
              newCheckOut: request.requested_check_out,
              newGuests: request.requested_guests_count,
              newPrice: request.requested_total_price,
              originalCheckIn: request.original_check_in,
              originalCheckOut: request.original_check_out,
              originalGuests: request.original_guests_count,
              originalPrice: request.original_total_price,
              hostMessage: hostMessage || null,
              isModification: true,
              isHostEmail: false,
              payment_method: request.booking?.payment_method || '',
              payment_plan: request.booking?.payment_plan || ''
            }
          }
        });
        console.log('✅ Email de modification approuvée avec facture envoyé au voyageur');

        // Délai pour éviter le rate limit
        await new Promise(resolve => setTimeout(resolve, 600));

        // Email à l'hôte avec justificatif mis à jour
        if (hostProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_confirmed_host',
              to: hostProfile.email,
              data: {
                ...bookingData,
                isModification: true,
                payment_method: request.booking?.payment_method || '',
                payment_plan: request.booking?.payment_plan || ''
              }
            }
          });
          console.log('✅ Email de modification approuvée avec justificatif envoyé à l\'hôte');
        }

        // Délai pour éviter le rate limit
        await new Promise(resolve => setTimeout(resolve, 600));

        // Email à l'admin avec facture admin
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'booking_confirmed_admin',
            to: 'admin@akwahome.com',
            data: {
              ...bookingData,
              isModification: true,
              serviceFee: request.booking?.properties?.service_fee || 0,
              cleaning_fee: request.booking?.properties?.cleaning_fee || 0,
              payment_method: request.booking?.payment_method || '',
              payment_plan: request.booking?.payment_plan || ''
            }
          }
        });
        console.log('✅ Email de modification approuvée avec facture envoyé à l\'admin');
      }

      Alert.alert(
        'Modification approuvée',
        'La réservation a été mise à jour et les nouvelles factures ont été envoyées.',
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
      // Récupérer la demande avec les détails du voyageur et de la réservation
      const { data: request, error: fetchError } = await supabase
        .from('booking_modification_requests')
        .select(`
          *,
          booking:bookings(
            id,
            property_id,
            properties(
              title
            )
          )
        `)
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Mettre à jour le statut de la demande
      const { error } = await supabase
        .from('booking_modification_requests')
        .update({
          status: 'rejected',
          host_response_message: hostMessage || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Envoyer un email au voyageur pour l'informer du refus
      try {
        const { data: guestProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', request.guest_id)
          .single();

        if (guestProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_modification_rejected',
              to: guestProfile.email,
              data: {
                guestName: `${guestProfile.first_name} ${guestProfile.last_name}`,
                propertyTitle: request.booking?.properties?.title || 'Votre réservation',
                requestedCheckIn: request.requested_check_in,
                requestedCheckOut: request.requested_check_out,
                requestedGuests: request.requested_guests_count,
                requestedPrice: request.requested_total_price,
                originalCheckIn: request.original_check_in,
                originalCheckOut: request.original_check_out,
                originalGuests: request.original_guests_count,
                originalPrice: request.original_total_price,
                hostMessage: hostMessage || null,
                bookingId: request.booking_id
              }
            }
          });
          console.log('✅ Email de modification refusée envoyé au voyageur');
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email modification refusée:', emailError);
        // Ne pas faire échouer le rejet si l'email échoue
      }

      Alert.alert(
        'Modification refusée',
        'La demande de modification a été refusée et le voyageur a été notifié.',
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
      // Récupérer la demande avant de l'annuler pour les emails
      const { data: request, error: fetchError } = await supabase
        .from('booking_modification_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Récupérer les informations de la réservation pour les emails
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          properties!inner(
            title,
            host_id
          ),
          profiles!bookings_guest_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', request.booking_id)
        .single();

      if (bookingError) {
        console.error('Erreur récupération réservation:', bookingError);
        // Continuer même si on ne peut pas récupérer les données de la réservation
      }

      // Mettre à jour le statut
      const { error } = await supabase
        .from('booking_modification_requests')
        .update({
          status: 'cancelled'
        })
        .eq('id', requestId);

      if (error) throw error;

      // Envoyer les emails de notification
      try {
        console.log('📧 [cancelModificationRequest] Données récupérées:', {
          requestId,
          bookingId: request.booking_id,
          guestId: request.guest_id,
          hasBookingData: !!bookingData,
          hasProperties: !!bookingData?.properties,
          hostId: bookingData?.properties?.host_id,
        });

        // Récupérer les profils de l'hôte et du voyageur directement
        const [hostResult, guestResult] = await Promise.all([
          bookingData?.properties?.host_id
            ? supabase
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('user_id', bookingData.properties.host_id)
                .single()
            : Promise.resolve({ data: null, error: null }),
          request.guest_id
            ? supabase
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('user_id', request.guest_id)
                .single()
            : Promise.resolve({ data: null, error: null })
        ]);

        if (hostResult.error) {
          console.error('❌ [cancelModificationRequest] Erreur récupération profil hôte:', hostResult.error);
        }
        if (guestResult.error) {
          console.error('❌ [cancelModificationRequest] Erreur récupération profil voyageur:', guestResult.error);
        }

        const hostData = hostResult.data;
        const guestData = guestResult.data;

        console.log('📧 [cancelModificationRequest] Profils récupérés:', {
          hostData: hostData ? { email: hostData.email, name: `${hostData.first_name} ${hostData.last_name}` } : null,
          guestData: guestData ? { email: guestData.email, name: `${guestData.first_name} ${guestData.last_name}` } : null,
        });

        // Email à l'hôte pour l'informer de l'annulation (même type que la fonction Edge expire-pending-requests)
        // Essayer d'abord avec hostData, sinon essayer de récupérer directement depuis request.host_id
        let hostEmail = hostData?.email;
        let hostName = hostData ? `${hostData.first_name || ''} ${hostData.last_name || ''}`.trim() : 'Cher hôte';
        
        if (!hostEmail && request.host_id) {
          const { data: hostDataFromRequest } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', request.host_id)
            .single();
          
          if (hostDataFromRequest?.email) {
            hostEmail = hostDataFromRequest.email;
            hostName = `${hostDataFromRequest.first_name || ''} ${hostDataFromRequest.last_name || ''}`.trim() || 'Cher hôte';
          }
        }
        
        if (hostEmail) {
          try {
            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            };

            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'booking_modification_cancelled_host',
                to: hostEmail,
                data: {
                  hostName: hostName,
                  guestName: `${guestData?.first_name || ''} ${guestData?.last_name || ''}`.trim() || 'Un voyageur',
                  propertyTitle: bookingData?.properties?.title || 'Propriété',
                  originalCheckIn: request.original_check_in,
                  originalCheckOut: request.original_check_out,
                  originalGuests: request.original_guests_count,
                  originalPrice: request.original_total_price
                }
              }
            });
            
            if (emailResponse.error) {
              console.error('❌ [cancelModificationRequest] Erreur envoi email à l\'hôte:', emailResponse.error);
            } else {
              console.log('✅ [cancelModificationRequest] Email d\'annulation envoyé à l\'hôte:', hostEmail);
            }
          } catch (hostEmailError: any) {
            console.error('❌ [cancelModificationRequest] Erreur lors de l\'envoi de l\'email à l\'hôte:', hostEmailError);
          }
        }

        // Email au voyageur (même type que la fonction Edge expire-pending-requests)
        if (guestData?.email) {
          try {
            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            };

            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'booking_modification_cancelled',
                to: guestData.email,
                data: {
                  guestName: `${guestData.first_name || ''} ${guestData.last_name || ''}`.trim() || 'Cher client',
                  propertyTitle: bookingData?.properties?.title || 'Propriété',
                  originalCheckIn: request.original_check_in,
                  originalCheckOut: request.original_check_out,
                  originalGuests: request.original_guests_count,
                  originalPrice: request.original_total_price
                }
              }
            });
            
            if (emailResponse.error) {
              console.error('❌ [cancelModificationRequest] Erreur envoi email au voyageur:', emailResponse.error);
            } else {
              console.log('✅ [cancelModificationRequest] Email d\'annulation envoyé au voyageur:', guestData.email);
            }
          } catch (guestEmailError: any) {
            console.error('❌ [cancelModificationRequest] Erreur lors de l\'envoi de l\'email au voyageur:', guestEmailError);
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email annulation demande:', emailError);
        // Ne pas faire échouer l'annulation si l'email échoue
      }

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















