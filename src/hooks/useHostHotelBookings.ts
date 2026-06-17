import { useCallback, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';
import { sendPushToUser } from '../services/pushNotificationService';
import type { HotelBooking } from './useHotelBookings';

export function useHostHotelBookings() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { sendBookingConfirmed, sendBookingConfirmedHost, sendBookingResponse } = useEmailService();

  const fetchHostBookings = useCallback(async () => {
    if (!user) return [];
    const { data: establishments } = await supabase
      .from('hotel_establishments')
      .select('id')
      .eq('host_id', user.id);

    const ids = (establishments ?? []).map((e) => e.id);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('hotel_bookings')
      .select(
        `
        *,
        hotel_establishments(id, title, host_id, address),
        hotel_booking_items(*, hotel_room_types(name))
      `,
      )
      .in('establishment_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useHostHotelBookings] fetch', error);
      return [];
    }
    return (data ?? []) as HotelBooking[];
  }, [user]);

  const updateBookingStatus = useCallback(
    async (bookingId: string, status: 'confirmed' | 'cancelled') => {
      if (!user) return { success: false };
      setLoading(true);
      try {
        const { data: booking, error } = await supabase
          .from('hotel_bookings')
          .update({
            status,
            ...(status === 'cancelled'
              ? {
                  cancelled_at: new Date().toISOString(),
                  cancelled_by: user.id,
                }
              : {}),
          })
          .eq('id', bookingId)
          .select(
            `
            *,
            hotel_establishments(id, title, host_id),
            profiles:guest_id(first_name, last_name, email)
          `,
          )
          .single();

        if (error || !booking) return { success: false };

        const guest = (booking as any).profiles;
        const est = (booking as any).hotel_establishments;
        const guestName = `${guest?.first_name || ''} ${guest?.last_name || ''}`.trim();
        const guestEmail = guest?.email;

        if (status === 'confirmed' && guestEmail) {
          const { data: hostProfile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', user.id)
            .maybeSingle();
          const hostName = `${hostProfile?.first_name || ''} ${hostProfile?.last_name || ''}`.trim();
          const emailExtra = {
            bookingId,
            hostNetAmount: booking.host_net_amount ?? undefined,
            serviceType: 'hotel' as const,
          };
          await sendBookingConfirmed(
            guestEmail,
            guestName,
            est?.title || 'Hôtel',
            booking.check_in_date,
            booking.check_out_date,
            booking.guests_count,
            booking.total_price,
            hostName,
            '',
            hostProfile?.email || '',
            '',
            undefined,
            emailExtra,
          );
          if (hostProfile?.email) {
            await sendBookingConfirmedHost(
              hostProfile.email,
              hostName,
              guestName,
              est?.title || 'Hôtel',
              booking.check_in_date,
              booking.check_out_date,
              booking.guests_count,
              booking.total_price,
              emailExtra,
            );
          }
          try {
            await sendPushToUser(booking.guest_id, {
              title: 'Réservation confirmée',
              body: `Votre séjour à ${est?.title} est confirmé.`,
              data: { type: 'hotel_booking_confirmed', bookingId },
            });
          } catch {
            // non bloquant
          }
        }

        if (status === 'cancelled' && guestEmail) {
          await sendBookingResponse(
            guestEmail,
            guestName,
            est?.title || 'Hôtel',
            booking.check_in_date,
            booking.check_out_date,
            booking.guests_count,
            booking.total_price,
            'cancelled',
          );
        }

        return { success: true };
      } catch (e) {
        console.error('[useHostHotelBookings] update', e);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [user, sendBookingConfirmed, sendBookingConfirmedHost, sendBookingResponse],
  );

  return { loading, fetchHostBookings, updateBookingStatus };
}
