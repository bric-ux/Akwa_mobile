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
  payment_method?: string;
  host_net_amount?: number | null;
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
    property_photos?: Array<{
      id: string;
      url: string;
      category: string;
      display_order: number;
    }>;
    locations?: {
      id: string;
      name: string;
      type: string;
      latitude?: number;
      longitude?: number;
      parent_id?: string;
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
      
      // Première requête : récupérer les réservations avec les propriétés
      // Inclure explicitement tous les champs nécessaires pour le calcul
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          id,
          check_in_date,
          check_out_date,
          guests_count,
          total_price,
          status,
          host_net_amount,
          discount_amount,
          discount_applied,
          original_total,
          properties!inner(
            id,
            title,
            price_per_night,
            images,
            host_id,
            check_in_time,
            check_out_time,
            house_rules,
            cleaning_fee,
            service_fee,
            taxes,
            free_cleaning_min_days,
            discount_enabled,
            discount_min_nights,
            discount_percentage,
            long_stay_discount_enabled,
            long_stay_discount_min_nights,
            long_stay_discount_percentage,
            locations:location_id(
              id,
              name,
              type,
              latitude,
              longitude,
              parent_id
            ),
            property_photos (
              id,
              url,
              category,
              display_order
            )
          )
        `)
        .eq('properties.host_id', user.id)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('❌ [useHostBookings] Erreur lors du chargement des réservations:', bookingsError);
        setError('Erreur lors du chargement des réservations');
        return [];
      }

      if (!bookingsData || bookingsData.length === 0) {
        console.log('✅ [useHostBookings] Aucune réservation trouvée');
        return [];
      }

      // Deuxième requête : récupérer les profils des invités
      const guestIds = [...new Set(bookingsData.map(b => b.guest_id))];
      const { data: guestProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, phone')
        .in('user_id', guestIds);

      if (profilesError) {
        console.error('❌ [useHostBookings] Erreur lors du chargement des profils:', profilesError);
        // Continuer même si les profils ne peuvent pas être chargés
      }

      // Combiner les données
      const profilesMap = new Map(
        (guestProfiles || []).map(p => [p.user_id, p])
      );

      let data = bookingsData.map(booking => ({
        ...booking,
        guest_profile: profilesMap.get(booking.guest_id) || null
      }));

      // Ne pas montrer côté hôte les réservations carte "pending" non payées.
      const pendingCardBookingIds = data
        .filter((booking: any) => booking.status === 'pending' && booking.payment_method === 'card')
        .map((booking: any) => booking.id);

      if (pendingCardBookingIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('booking_id, status')
          .in('booking_id', pendingCardBookingIds);

        if (!paymentsError) {
          const paidBookingIds = new Set(
            (payments || [])
              .filter((payment: any) => ['completed', 'succeeded', 'paid'].includes(String(payment.status || '').toLowerCase()))
              .map((payment: any) => payment.booking_id)
          );

          data = data.filter((booking: any) => {
            if (booking.status === 'pending' && booking.payment_method === 'card') {
              return paidBookingIds.has(booking.id);
            }
            return true;
          });
        } else {
          console.error('❌ [useHostBookings] Erreur vérification paiements pending card:', paymentsError);
        }
      }

      // Log pour vérifier que discount_amount est bien récupéré
      if (data && data.length > 0) {
        const sampleBooking = data[0];
        console.log('📊 [useHostBookings] Vérification données récupérées (première réservation):', {
          id: sampleBooking.id,
          discount_amount: sampleBooking.discount_amount,
          discount_amount_type: typeof sampleBooking.discount_amount,
          discount_applied: sampleBooking.discount_applied,
          host_net_amount: sampleBooking.host_net_amount,
          total_price: sampleBooking.total_price,
          has_properties: !!sampleBooking.properties,
          property_price_per_night: sampleBooking.properties?.price_per_night,
          property_cleaning_fee: sampleBooking.properties?.cleaning_fee,
          property_taxes: sampleBooking.properties?.taxes,
          property_free_cleaning_min_days: sampleBooking.properties?.free_cleaning_min_days,
        });
      }

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
          host_net_amount,
          discount_amount,
          discount_applied,
          original_total,
          properties!inner(
            id,
            title,
            host_id,
            address,
            price_per_night,
            cleaning_fee,
            service_fee,
            taxes,
            free_cleaning_min_days,
            cancellation_policy,
            check_in_time,
            check_out_time,
            house_rules,
            locations:location_id(id, name, type, latitude, longitude, parent_id)
          )
        `)
        .eq('id', bookingId)
        .eq('properties.host_id', user.id)
        .single();

      console.log('📊 [useHostBookings] Données réservation récupérées:', {
        id: bookingData?.id,
        payment_method: bookingData?.payment_method,
        payment_plan: bookingData?.payment_plan
      });

      if (fetchError || !bookingData) {
        console.error('❌ [useHostBookings] Réservation non trouvée:', fetchError);
        const errorMessage = fetchError?.message || 'Réservation non trouvée';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Récupérer séparément le profil de l'invité
      let guestProfile: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null = null;
      
      try {
        // Essayer d'abord via la fonction RPC get_public_profile_info
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_public_profile_info', { profile_user_id: bookingData.guest_id });
        
        if (!rpcError && rpcData && rpcData.length > 0) {
          guestProfile = {
            first_name: rpcData[0].first_name,
            last_name: rpcData[0].last_name,
            email: rpcData[0].email,
            phone: null  // Phone non disponible via get_public_profile_info
          };
        } else {
          // Fallback : essayer directement depuis profiles (avec la nouvelle politique)
          const { data: fullProfile, error: fullProfileError } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('user_id', bookingData.guest_id)
            .maybeSingle();
          
          if (!fullProfileError && fullProfile) {
            guestProfile = {
              first_name: fullProfile.first_name || null,
              last_name: fullProfile.last_name || null,
              email: fullProfile.email || null,
              phone: fullProfile.phone || null
            };
          } else {
            console.error('❌ [useHostBookings] Erreur récupération profil invité:', fullProfileError || rpcError);
            console.warn('⚠️ [useHostBookings] Profil invité non trouvé, continuation sans email');
          }
        }
      } catch (error) {
        console.error('❌ [useHostBookings] Erreur récupération profil invité:', error);
        // Ne pas bloquer la mise à jour si le profil n'est pas trouvé
        console.warn('⚠️ [useHostBookings] Profil invité non trouvé, continuation sans email');
      }

      // Utiliser les données du profil si disponibles, sinon valeurs par défaut
      const guestEmail = guestProfile?.email || null;
      const guestFirstName = guestProfile?.first_name || '';
      const guestLastName = guestProfile?.last_name || '';
      const guestPhone = guestProfile?.phone || '';

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
        const errorMessage = updateError?.message || 'Erreur lors de la mise à jour du statut';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Envoyer les emails selon le statut
      try {
        // Vérifier que les données nécessaires existent
        if (!guestEmail) {
          console.warn('⚠️ [useHostBookings] Email invité manquant, emails non envoyés');
          return { success: true };
        }

        if (!user.email) {
          console.warn('⚠️ [useHostBookings] Email hôte manquant, emails non envoyés');
          return { success: true };
        }

        const guestName = `${guestFirstName} ${guestLastName}`.trim() || 'Invité';
        const hostName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim();

        if (status === 'confirmed') {
          // Envoyer les emails de confirmation avec PDF (générés automatiquement par send-email)
          try {
            console.log('📧 [useHostBookings] Envoi emails de confirmation avec PDF...');
            
            // Email au voyageur avec PDF (généré automatiquement)
            const guestEmailData = {
              type: 'booking_confirmed',
              to: guestEmail,
              data: {
                bookingId: bookingData.id,
                guestName: guestName,
                propertyTitle: bookingData.properties.title,
                checkIn: bookingData.check_in_date,
                checkOut: bookingData.check_out_date,
                guestsCount: bookingData.guests_count,
                totalPrice: bookingData.total_price,
                host_net_amount: bookingData.host_net_amount, // Inclure pour cohérence
                discountApplied: bookingData.discount_applied || false,
                discountAmount: bookingData.discount_amount || 0,
                originalTotal: bookingData.original_total || bookingData.total_price,
                property: {
                  title: bookingData.properties.title,
                  address: bookingData.properties.address || '',
                  city_name: bookingData.properties.location?.name || bookingData.properties.locations?.name || '',
                  city_region: bookingData.properties.location?.type === 'city' ? bookingData.properties.location?.name : '',
                  price_per_night: bookingData.properties.price_per_night || 0,
                  cleaning_fee: bookingData.properties.cleaning_fee || 0,
                  service_fee: bookingData.properties.service_fee || 0,
                  taxes: bookingData.properties.taxes || 0,
                  free_cleaning_min_days: bookingData.properties.free_cleaning_min_days || null, // Important pour le calcul
                  // BUG FIX: Ajouter les données de réduction pour que le PDF puisse recalculer correctement
                  discount_enabled: bookingData.properties.discount_enabled || false,
                  discount_min_nights: bookingData.properties.discount_min_nights || null,
                  discount_percentage: bookingData.properties.discount_percentage || null,
                  long_stay_discount_enabled: bookingData.properties.long_stay_discount_enabled || false,
                  long_stay_discount_min_nights: bookingData.properties.long_stay_discount_min_nights || null,
                  long_stay_discount_percentage: bookingData.properties.long_stay_discount_percentage || null,
                  cancellation_policy: bookingData.properties.cancellation_policy || 'flexible',
                  check_in_time: bookingData.properties.check_in_time,
                  check_out_time: bookingData.properties.check_out_time,
                  house_rules: bookingData.properties.house_rules
                },
                guest: {
                  first_name: guestFirstName,
                  last_name: guestLastName,
                  email: guestEmail,
                  phone: guestPhone
                },
                host: {
                  first_name: user.user_metadata?.first_name || '',
                  last_name: user.user_metadata?.last_name || '',
                  email: user.email || '',
                  phone: user.user_metadata?.phone || ''
                },
                status: 'confirmed',
                message: bookingData.message_to_host || '',
                payment_method: bookingData.payment_method || '',
                payment_plan: bookingData.payment_plan || ''
              }
            };

            const guestEmailResult = await supabase.functions.invoke('send-email', { body: guestEmailData });
            if (guestEmailResult.error) {
              console.error('❌ [useHostBookings] Erreur email voyageur:', guestEmailResult.error);
            } else {
              console.log('✅ [useHostBookings] Email avec PDF envoyé au voyageur');
            }

            // Délai pour éviter le rate limit
            await new Promise(resolve => setTimeout(resolve, 600));

            // Email à l'hôte avec PDF (généré automatiquement)
            const hostEmailData = {
              type: 'booking_confirmed_host',
              to: user.email,
              data: {
                bookingId: bookingData.id,
                hostName: hostName,
                guestName: guestName,
                propertyTitle: bookingData.properties.title,
                checkIn: bookingData.check_in_date,
                checkOut: bookingData.check_out_date,
                guestsCount: bookingData.guests_count,
                totalPrice: bookingData.total_price,
                host_net_amount: bookingData.host_net_amount, // Inclure host_net_amount stocké
                discountApplied: bookingData.discount_applied || false,
                discountAmount: bookingData.discount_amount || 0,
                originalTotal: bookingData.original_total || bookingData.total_price,
                property: {
                  title: bookingData.properties.title,
                  address: bookingData.properties.address || '',
                  city_name: bookingData.properties.location?.name || bookingData.properties.locations?.name || '',
                  city_region: bookingData.properties.location?.type === 'city' ? bookingData.properties.location?.name : '',
                  price_per_night: bookingData.properties.price_per_night || 0,
                  cleaning_fee: bookingData.properties.cleaning_fee || 0,
                  service_fee: bookingData.properties.service_fee || 0,
                  taxes: bookingData.properties.taxes || 0,
                  free_cleaning_min_days: bookingData.properties.free_cleaning_min_days || null, // Important pour le calcul
                  // BUG FIX: Ajouter les données de réduction pour que le PDF puisse recalculer correctement
                  discount_enabled: bookingData.properties.discount_enabled || false,
                  discount_min_nights: bookingData.properties.discount_min_nights || null,
                  discount_percentage: bookingData.properties.discount_percentage || null,
                  long_stay_discount_enabled: bookingData.properties.long_stay_discount_enabled || false,
                  long_stay_discount_min_nights: bookingData.properties.long_stay_discount_min_nights || null,
                  long_stay_discount_percentage: bookingData.properties.long_stay_discount_percentage || null,
                  cancellation_policy: bookingData.properties.cancellation_policy || 'flexible',
                  check_in_time: bookingData.properties.check_in_time,
                  check_out_time: bookingData.properties.check_out_time,
                  house_rules: bookingData.properties.house_rules
                },
                guest: {
                  first_name: guestFirstName,
                  last_name: guestLastName,
                  email: guestEmail,
                  phone: guestPhone
                },
                host: {
                  first_name: user.user_metadata?.first_name || '',
                  last_name: user.user_metadata?.last_name || '',
                  email: user.email || '',
                  phone: user.user_metadata?.phone || ''
                },
                status: 'confirmed',
                message: bookingData.message_to_host || '',
                payment_method: bookingData.payment_method || '',
                payment_plan: bookingData.payment_plan || ''
              }
            };
            
            console.log('📧 [useHostBookings] Envoi email hôte avec PDF, données:', {
              bookingId: hostEmailData.data.bookingId,
              host_net_amount: hostEmailData.data.host_net_amount,
              discountAmount: hostEmailData.data.discountAmount,
              free_cleaning_min_days: hostEmailData.data.property.free_cleaning_min_days,
            });

            const hostEmailResult = await supabase.functions.invoke('send-email', { body: hostEmailData });
            if (hostEmailResult.error) {
              console.error('❌ [useHostBookings] Erreur email hôte:', hostEmailResult.error);
            } else {
              console.log('✅ [useHostBookings] Email avec PDF envoyé à l\'hôte');
            }
          } catch (error) {
            console.error('❌ [useHostBookings] Erreur envoi emails:', error);
          }

          console.log('✅ [useHostBookings] Confirmation envoyée aux voyageurs et hôtes');
        } else if (status === 'cancelled') {
          // Email d'annulation au voyageur
          await sendBookingResponse(
            guestEmail,
            guestName,
            bookingData.properties.title,
            bookingData.check_in_date,
            bookingData.check_out_date,
            bookingData.guests_count,
            bookingData.total_price,
            'cancelled'
          );

          // Email d'annulation à l'hôte
          await sendBookingCancelledHost(
            user.email,
            hostName,
            guestName,
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
    } catch (err: any) {
      console.error('❌ [useHostBookings] Erreur inattendue:', err);
      const errorMessage = err?.message || 'Une erreur inattendue est survenue';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, sendBookingResponse, sendBookingConfirmedHost, sendBookingCancelledHost]);

  const cancelBooking = useCallback(async (
    bookingId: string,
    cancellationReason?: string,
    penaltyPaymentMethod?: 'deduct_from_next_booking' | 'pay_directly'
  ) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Récupérer les détails de la réservation
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          *,
          properties!inner(
            price_per_night,
            host_id,
            title
          )
        `)
        .eq('id', bookingId)
        .single();

      if (fetchError) throw fetchError;
      
      if (booking.properties.host_id !== user.id) {
        setError('Vous n\'êtes pas autorisé à annuler cette réservation');
        return { success: false };
      }

      // Calculer la pénalité basée sur le délai d'annulation (ou 40% sur nuitées non consommées si séjour en cours)
      const checkInDate = new Date(booking.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);
      const checkOutDate = booking.check_out_date ? new Date(booking.check_out_date) : null;
      if (checkOutDate) checkOutDate.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      const totalNights = checkOutDate
        ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
        : 1;
      const baseReservationAmount = booking.properties.price_per_night * totalNights;

      const isInProgress = checkOutDate && checkInDate <= now && now <= checkOutDate;
      let penalty = 0;

      if (isInProgress) {
        // Séjour en cours : Akwahome applique 40% sur les nuitées non consommées, remboursement intégral au voyageur
        const nightsElapsed = Math.max(0, Math.ceil((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
        const remainingNights = Math.max(0, totalNights - nightsElapsed);
        const remainingBaseAmount = remainingNights * booking.properties.price_per_night;
        penalty = Math.round(remainingBaseAmount * 0.40);
      } else if (hoursUntilCheckIn <= 48) {
        penalty = Math.round(baseReservationAmount * 0.40);
      } else if (daysUntilCheckIn > 2 && daysUntilCheckIn <= 28) {
        penalty = Math.round(baseReservationAmount * 0.20);
      } else if (daysUntilCheckIn > 28 && totalNights > 30) {
        penalty = 0;
      } else if (daysUntilCheckIn > 28) {
        penalty = 0;
      }

      const updateData: any = {
        status: 'cancelled',
        cancellation_penalty: penalty,
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason || 'Annulation par l\'hôte'
      };
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Si une pénalité existe, créer une entrée dans penalty_tracking
      if (penalty > 0) {
        try {
          await supabase
            .from('penalty_tracking')
            .insert({
              booking_id: bookingId,
              user_id: user.id,
              penalty_amount: penalty,
              penalty_type: 'host_cancellation',
              payment_method: penaltyPaymentMethod || null,
              status: 'pending',
            });
        } catch (penaltyError) {
          console.error('Erreur lors de la création de la pénalité:', penaltyError);
          // Ne pas faire échouer l'annulation si la pénalité ne peut pas être créée
        }
      }

      // Récupérer les profils complets pour les emails
      const { data: guestProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('user_id', booking.guest_id)
        .single();

      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('user_id', user.id)
        .single();

      // Envoyer les emails explicites aux deux parties
      try {
        // Email au voyageur (notification de l'annulation par l'hôte)
        if (guestProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_cancelled_by_host',
              to: guestProfile.email,
              data: {
                guestName: `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim(),
                propertyTitle: booking.properties.title,
                checkIn: booking.check_in_date,
                checkOut: booking.check_out_date,
                guests: booking.guests_count,
                totalPrice: booking.total_price,
                refundAmount: booking.total_price,
                penaltyAmount: penalty,
                reason: cancellationReason || 'Annulation par l\'hôte',
                siteUrl: 'https://akwahome.com'
              }
            }
          });
          console.log('✅ Email d\'annulation envoyé au voyageur');
        }

        // Email à l'hôte (confirmation de son annulation)
        if (hostProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_cancelled_host',
              to: hostProfile.email,
              data: {
                hostName: `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim(),
                propertyTitle: booking.properties.title,
                guestName: `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim(),
                checkIn: booking.check_in_date,
                checkOut: booking.check_out_date,
                guests: booking.guests_count,
                totalPrice: booking.total_price,
                penaltyAmount: penalty,
                reason: cancellationReason || 'Annulation par l\'hôte',
                siteUrl: 'https://akwahome.com'
              }
            }
          });
          console.log('✅ Email de confirmation d\'annulation envoyé à l\'hôte');
        }
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi des emails:', emailError);
        // Ne pas faire échouer l'annulation si l'email échoue
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation:', error);
      setError(error?.message || 'Impossible d\'annuler la réservation');
      return { success: false, error: error?.message || 'Impossible d\'annuler la réservation' };
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    getHostBookings,
    updateBookingStatus,
    cancelBooking,
    loading,
    error,
  };
};
