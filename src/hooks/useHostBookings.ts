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
    property_photos?: Array<{
      id: string;
      url: string;
      category: string;
      display_order: number;
    }>;
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
            ),
            property_photos (
              id,
              url,
              category,
              display_order
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
            address,
            price_per_night,
            cleaning_fee,
            service_fee,
            taxes,
            cancellation_policy,
            cities(name, region)
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
      const { data: guestProfile, error: guestError } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone')
        .eq('user_id', bookingData.guest_id)
        .single();

      if (guestError) {
        console.error('❌ [useHostBookings] Erreur récupération profil invité:', guestError);
        const errorMessage = guestError?.message || 'Erreur lors de la récupération du profil invité';
        setError(errorMessage);
        return { success: false, error: errorMessage };
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
        const errorMessage = updateError?.message || 'Erreur lors de la mise à jour du statut';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      // Envoyer les emails selon le statut
      try {
        // Vérifier que les données nécessaires existent
        if (!guestProfile?.email) {
          console.warn('⚠️ [useHostBookings] Email invité manquant, emails non envoyés');
          return { success: true };
        }

        if (!user.email) {
          console.warn('⚠️ [useHostBookings] Email hôte manquant, emails non envoyés');
          return { success: true };
        }

        const guestName = `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim();
        const hostName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim();

        if (status === 'confirmed') {
          // Préparer les données pour le PDF
          const pdfBookingData = {
            id: bookingData.id,
            property: {
              title: bookingData.properties.title,
              address: bookingData.properties.address || '',
              city_name: bookingData.properties.cities?.name || '',
              city_region: bookingData.properties.cities?.region || '',
              price_per_night: bookingData.properties.price_per_night || 0,
              cleaning_fee: bookingData.properties.cleaning_fee || 0,
              service_fee: bookingData.properties.service_fee || 0,
              taxes: bookingData.properties.taxes || 0,
              cancellation_policy: bookingData.properties.cancellation_policy || 'flexible'
            },
            guest: {
              first_name: guestProfile.first_name || '',
              last_name: guestProfile.last_name || '',
              email: guestProfile.email,
              phone: guestProfile.phone || ''
            },
            host: {
              first_name: user.user_metadata?.first_name || '',
              last_name: user.user_metadata?.last_name || '',
              email: user.email || '',
              phone: user.user_metadata?.phone || ''
            },
            check_in: bookingData.check_in_date,
            check_out: bookingData.check_out_date,
            guests_count: bookingData.guests_count,
            total_price: bookingData.total_price,
            status: bookingData.status,
            created_at: bookingData.created_at,
            message: bookingData.message_to_host || '',
            discount_applied: bookingData.discount_applied || false,
            discount_amount: bookingData.discount_amount || 0,
            original_total: bookingData.original_total || bookingData.total_price,
            payment_method: bookingData.payment_method || '',
            payment_plan: bookingData.payment_plan || ''
          };

          // Envoyer les emails de confirmation avec PDF
          try {
            console.log('📄 [useHostBookings] Génération PDF...');
            console.log('📊 [useHostBookings] Données PDF préparées:', {
              id: pdfBookingData.id,
              payment_method: pdfBookingData.payment_method,
              payment_plan: pdfBookingData.payment_plan
            });
            
            const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-booking-pdf', {
              body: { bookingData: pdfBookingData }
            });

            if (pdfError) {
              console.log('⚠️ [useHostBookings] PDF non généré, envoi email sans pièce jointe');
              
              // Email au voyageur sans PDF
              const { error: emailError } = await supabase.functions.invoke('send-email', {
                body: {
                  type: 'booking_confirmed',
                  to: guestProfile.email,
                  data: {
                    bookingId: bookingData.id,
                    guestName: guestName,
                    propertyTitle: bookingData.properties.title,
                    checkIn: bookingData.check_in_date,
                    checkOut: bookingData.check_out_date,
                    guests: bookingData.guests_count,
                    totalPrice: bookingData.total_price,
                    status: 'confirmed'
                  }
                }
              });

              if (emailError) {
                console.error('❌ [useHostBookings] Erreur email voyageur:', emailError);
              }

              // Email à l'hôte sans PDF
              const { error: hostEmailError } = await supabase.functions.invoke('send-email', {
                body: {
                  type: 'booking_confirmed_host',
                  to: user.email,
                  data: {
                    bookingId: bookingData.id,
                    hostName: hostName,
                    guestName: guestName,
                    propertyTitle: bookingData.properties.title,
                    checkIn: bookingData.check_in_date,
                    checkOut: bookingData.check_out_date,
                    guests: bookingData.guests_count,
                    totalPrice: bookingData.total_price
                  }
                }
              });

              if (hostEmailError) {
                console.error('❌ [useHostBookings] Erreur email hôte:', hostEmailError);
              }
            } else if (pdfData?.success && pdfData?.pdf) {
              console.log('✅ [useHostBookings] PDF généré, envoi emails avec pièce jointe');
              
              // Email au voyageur avec PDF
              const { error: emailError } = await supabase.functions.invoke('send-email', {
                body: {
                  type: 'booking_confirmed',
                  to: guestProfile.email,
                  data: {
                    bookingId: bookingData.id,
                    guestName: guestName,
                    propertyTitle: bookingData.properties.title,
                    checkIn: bookingData.check_in_date,
                    checkOut: bookingData.check_out_date,
                    guests: bookingData.guests_count,
                    totalPrice: bookingData.total_price,
                    status: 'confirmed'
                  },
                  attachments: [{
                    filename: pdfData.filename || `reservation-${bookingData.id}.pdf`,
                    content: pdfData.pdf,
                    type: 'application/pdf'
                  }]
                }
              });

              if (emailError) {
                console.error('❌ [useHostBookings] Erreur email voyageur:', emailError);
              } else {
                console.log('✅ [useHostBookings] Email avec PDF envoyé au voyageur');
              }

              // Email à l'hôte avec PDF
              const { error: hostEmailError } = await supabase.functions.invoke('send-email', {
                body: {
                  type: 'booking_confirmed_host',
                  to: user.email,
                  data: {
                    bookingId: bookingData.id,
                    hostName: hostName,
                    guestName: guestName,
                    propertyTitle: bookingData.properties.title,
                    checkIn: bookingData.check_in_date,
                    checkOut: bookingData.check_out_date,
                    guests: bookingData.guests_count,
                    totalPrice: bookingData.total_price
                  },
                  attachments: [{
                    filename: pdfData.filename || `reservation-${bookingData.id}.pdf`,
                    content: pdfData.pdf,
                    type: 'application/pdf'
                  }]
                }
              });

              if (hostEmailError) {
                console.error('❌ [useHostBookings] Erreur email hôte:', hostEmailError);
              } else {
                console.log('✅ [useHostBookings] Email avec PDF envoyé à l\'hôte');
              }
            }
          } catch (error) {
            console.error('❌ [useHostBookings] Erreur génération PDF:', error);
            // L'email sera envoyé sans PDF
          }

          console.log('✅ [useHostBookings] Confirmation envoyée aux voyageurs et hôtes');
        } else if (status === 'cancelled') {
          // Email d'annulation au voyageur
          await sendBookingResponse(
            guestProfile.email,
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

  return {
    getHostBookings,
    updateBookingStatus,
    loading,
    error,
  };
};
