import { useCallback, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';
import { useIdentityVerification } from './useIdentityVerification';
import { sendPushToUser } from '../services/pushNotificationService';
import { notifyAdminsNewBookingPush } from '../services/notifyAdminsBookingPush';
import {
  calculateHotelBookingPricing,
  type HotelBookingLineInput,
} from '../lib/hotelBookingPricing';
import type { HotelBookingItem, HotelRoomType } from '../types';

export interface HotelBookingLinePayload {
  room_type_id: string;
  quantity: number;
  price_per_night: number;
  cleaning_fee: number;
  taxes_per_night?: number;
}

export interface CreateHotelBookingData {
  establishmentId: string;
  establishmentTitle: string;
  hostId: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  lines: HotelBookingLinePayload[];
  totalPrice: number;
  hostNetAmount: number;
  messageToHost?: string;
  paymentMethod?: 'cash' | 'card' | 'wave';
  paymentPlan?: 'full' | 'split';
  paymentCurrency?: 'XOF' | 'EUR' | 'USD';
  paymentRate?: number;
  stripeCheckoutToken?: string;
  pricingSnapshot?: ReturnType<typeof calculateHotelBookingPricing>;
}

export interface HotelBooking {
  id: string;
  establishment_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  total_price: number;
  host_net_amount?: number | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_method?: string | null;
  payment_plan?: string | null;
  payment_currency?: string | null;
  exchange_rate?: number | null;
  message_to_host?: string | null;
  booking_code?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  hotel_establishments?: {
    id: string;
    title: string;
    host_id: string;
    address?: string | null;
    cancellation_policy?: string | null;
  };
  hotel_booking_items?: HotelBookingItem[];
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export function buildLinesFromRoomType(
  room: HotelRoomType,
  quantity: number,
): HotelBookingLineInput[] {
  return [
    {
      price_per_night: room.price_per_night,
      cleaning_fee: room.cleaning_fee,
      taxes_per_night: room.taxes_per_night,
      quantity,
      discount_enabled: room.discount_enabled,
      discount_min_nights: room.discount_min_nights,
      discount_percentage: room.discount_percentage,
      long_stay_discount_enabled: room.long_stay_discount_enabled,
      long_stay_discount_min_nights: room.long_stay_discount_min_nights,
      long_stay_discount_percentage: room.long_stay_discount_percentage,
    },
  ];
}

export function useHotelBookings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendBookingRequest, sendBookingRequestSent, sendBookingConfirmed, sendBookingConfirmedHost, sendBookingCancelled, sendBookingCancelledHost } =
    useEmailService();
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } =
    useIdentityVerification();

  const assertIdentity = useCallback(() => {
    if (!user) {
      setError('Vous devez être connecté pour effectuer une réservation');
      return false;
    }
    if (identityLoading) {
      setError('Vérification de l\'identité en cours...');
      return false;
    }
    if (!hasUploadedIdentity) {
      setError('IDENTITY_REQUIRED');
      return false;
    }
    if (!isVerified && verificationStatus !== 'pending') {
      setError('IDENTITY_NOT_VERIFIED');
      return false;
    }
    return true;
  }, [user, identityLoading, hasUploadedIdentity, isVerified, verificationStatus]);

  const createHotelBooking = useCallback(
    async (data: CreateHotelBookingData) => {
      if (!assertIdentity()) return { success: false, error };

      setLoading(true);
      setError(null);

      try {
        const itemsJson = data.lines.map((l) => ({
          room_type_id: l.room_type_id,
          quantity: l.quantity,
        }));

        const { data: available, error: availErr } = await supabase.rpc(
          'check_hotel_booking_availability',
          {
            p_establishment_id: data.establishmentId,
            p_check_in: data.checkInDate,
            p_check_out: data.checkOutDate,
            p_items: itemsJson,
            p_exclude_booking_id: null,
          },
        );

        if (availErr || !available) {
          setError('Ces chambres ne sont plus disponibles pour ces dates');
          return { success: false, error: 'Indisponible' };
        }

        const { data: estRow } = await supabase
          .from('hotel_establishments')
          .select('auto_booking')
          .eq('id', data.establishmentId)
          .single();

        const isOnline = data.paymentMethod === 'card' || data.paymentMethod === 'wave';
        const initialStatus = isOnline
          ? 'pending'
          : estRow?.auto_booking
            ? 'confirmed'
            : 'pending';

        const { data: booking, error: bookingErr } = await supabase
          .from('hotel_bookings')
          .insert({
            establishment_id: data.establishmentId,
            guest_id: user!.id,
            check_in_date: data.checkInDate,
            check_out_date: data.checkOutDate,
            guests_count: data.guestsCount,
            total_price: data.totalPrice,
            host_net_amount: data.hostNetAmount,
            message_to_host: data.messageToHost ?? null,
            special_requests: data.messageToHost ?? null,
            payment_method: data.paymentMethod ?? null,
            payment_plan: data.paymentPlan ?? 'full',
            payment_currency: data.paymentCurrency ?? 'XOF',
            exchange_rate: data.paymentRate ?? null,
            stripe_checkout_token: data.stripeCheckoutToken ?? null,
            status: initialStatus,
          })
          .select('id, status')
          .single();

        if (bookingErr || !booking) {
          setError('Erreur lors de la création de la réservation');
          return { success: false, error: bookingErr?.message };
        }

        const nights = nightsBetween(data.checkInDate, data.checkOutDate);
        const itemRows = data.lines.map((line) => ({
          booking_id: booking.id,
          room_type_id: line.room_type_id,
          quantity: line.quantity,
          price_per_night: line.price_per_night,
          cleaning_fee: line.cleaning_fee,
          line_total:
            line.price_per_night * nights * line.quantity + line.cleaning_fee * line.quantity,
        }));

        const { error: itemsErr } = await supabase.from('hotel_booking_items').insert(itemRows);
        if (itemsErr) {
          await supabase.from('hotel_bookings').delete().eq('id', booking.id);
          setError('Erreur lors de l\'enregistrement des chambres');
          return { success: false, error: itemsErr.message };
        }

        const snap = data.pricingSnapshot;
        if (snap) {
          await supabase.from('booking_calculation_details').insert({
            booking_id: booking.id,
            booking_type: 'hotel',
            base_price: snap.basePrice,
            price_after_discount: snap.priceAfterDiscount,
            discount_amount: 0,
            effective_cleaning_fee: snap.totalCleaningFee,
            effective_taxes: snap.totalTaxes,
            service_fee: snap.serviceFee,
            host_commission_ht: snap.hostCommission,
            host_commission_vat: 0,
            host_commission: snap.hostCommission,
            host_net_amount: snap.hostNetAmount,
            total_price: snap.finalTotal,
            nights: snap.nights,
          });
        }

        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('user_id', data.hostId)
          .maybeSingle();

        const { data: guestProfile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('user_id', user!.id)
          .maybeSingle();

        const guestName = `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim() || 'Voyageur';
        const hostName = `${hostProfile?.first_name || ''} ${hostProfile?.last_name || ''}`.trim() || 'Hôte';

        if (data.paymentMethod === 'cash') {
          try {
            if (hostProfile?.email) {
              await sendBookingRequest(
                hostProfile.email,
                hostName,
                guestName,
                data.establishmentTitle,
                data.checkInDate,
                data.checkOutDate,
                data.guestsCount,
                data.totalPrice,
                data.messageToHost,
                0,
                undefined,
                data.hostNetAmount,
                data.paymentCurrency,
                data.paymentRate,
              );
            }
            if (guestProfile?.email) {
              await sendBookingRequestSent(
                guestProfile.email,
                guestName,
                data.establishmentTitle,
                data.checkInDate,
                data.checkOutDate,
                data.guestsCount,
                data.totalPrice,
                data.paymentCurrency,
                data.paymentRate,
              );
            }
            if (initialStatus === 'confirmed' && guestProfile?.email && hostProfile?.email) {
              const emailExtra = {
                bookingId: booking.id,
                hostNetAmount: data.hostNetAmount,
                serviceType: 'hotel' as const,
              };
              await sendBookingConfirmed(
                guestProfile.email,
                guestName,
                data.establishmentTitle,
                data.checkInDate,
                data.checkOutDate,
                data.guestsCount,
                data.totalPrice,
                hostName,
                '',
                hostProfile.email,
                '',
                undefined,
                emailExtra,
              );
              await sendBookingConfirmedHost(
                hostProfile.email,
                hostName,
                guestName,
                data.establishmentTitle,
                data.checkInDate,
                data.checkOutDate,
                data.guestsCount,
                data.totalPrice,
                emailExtra,
              );
            }
          } catch (emailErr) {
            console.error('[useHotelBookings] emails', emailErr);
          }

          try {
            await sendPushToUser(data.hostId, {
              title: 'Nouvelle réservation hôtel',
              body: `${guestName} — ${data.establishmentTitle}`,
              data: { type: 'hotel_booking', bookingId: booking.id },
            });
          } catch {
            // non bloquant
          }

          try {
            await notifyAdminsNewBookingPush({
              bookingId: booking.id,
              bookingType: 'property',
              title: 'Nouvelle réservation hôtel',
              body: `${data.establishmentTitle} (${initialStatus})`,
            });
          } catch {
            // non bloquant
          }
        }

        return { success: true, bookingId: booking.id, status: booking.status };
      } catch (e) {
        console.error('[useHotelBookings] create', e);
        setError('Erreur inattendue');
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [
      assertIdentity,
      error,
      user,
      sendBookingRequest,
      sendBookingRequestSent,
      sendBookingConfirmed,
      sendBookingConfirmedHost,
    ],
  );

  const fetchGuestBookings = useCallback(async () => {
    if (!user) return [];
    const { data, error: fetchErr } = await supabase
      .from('hotel_bookings')
      .select(
        `
        *,
        hotel_establishments(id, title, host_id, address, cancellation_policy),
        hotel_booking_items(*, hotel_room_types(name, taxes_per_night))
      `,
      )
      .eq('guest_id', user.id)
      .order('created_at', { ascending: false });
    if (fetchErr) {
      console.error('[useHotelBookings] fetchGuest', fetchErr);
      return [];
    }
    return (data ?? []) as HotelBooking[];
  }, [user]);

  const fetchGuestBookingById = useCallback(
    async (bookingId: string) => {
      if (!user) return null;
      const { data, error: fetchErr } = await supabase
        .from('hotel_bookings')
        .select(
          `
          *,
          hotel_establishments(id, title, host_id, address, cancellation_policy),
          hotel_booking_items(*, hotel_room_types(name, taxes_per_night, cleaning_fee))
        `,
        )
        .eq('id', bookingId)
        .eq('guest_id', user.id)
        .maybeSingle();
      if (fetchErr || !data) return null;
      return data as HotelBooking;
    },
    [user],
  );

  const fetchHotelBookingById = useCallback(async (bookingId: string) => {
    const { data, error: fetchErr } = await supabase
      .from('hotel_bookings')
      .select(
        `
        *,
        hotel_establishments(id, title, host_id, address, cancellation_policy),
        hotel_booking_items(*, hotel_room_types(name, taxes_per_night, cleaning_fee)),
        profiles:guest_id(first_name, last_name, email, phone)
      `,
      )
      .eq('id', bookingId)
      .maybeSingle();
    if (fetchErr || !data) return null;
    return data as HotelBooking & {
      profiles?: { first_name?: string; last_name?: string; email?: string; phone?: string };
    };
  }, []);

  const cancelHotelBooking = useCallback(
    async (bookingId: string, reason?: string) => {
      if (!user) return { success: false, error: 'Non connecté' };
      setLoading(true);
      try {
        const { data: booking, error } = await supabase
          .from('hotel_bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancellation_reason: reason?.trim() || null,
          })
          .eq('id', bookingId)
          .eq('guest_id', user.id)
          .in('status', ['pending', 'confirmed'])
          .select(
            `
            *,
            hotel_establishments(id, title, host_id)
          `,
          )
          .single();

        if (error || !booking) {
          return { success: false, error: 'Impossible d\'annuler cette réservation' };
        }

        const est = (booking as HotelBooking).hotel_establishments;
        const { data: guestProfile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle();
        const { data: hostProfile } = est?.host_id
          ? await supabase
              .from('profiles')
              .select('email, first_name, last_name')
              .eq('user_id', est.host_id)
              .maybeSingle()
          : { data: null };

        const guestName = `${guestProfile?.first_name || ''} ${guestProfile?.last_name || ''}`.trim();
        const title = est?.title || 'Hôtel';

        try {
          if (guestProfile?.email) {
            await sendBookingCancelled(
              guestProfile.email,
              guestName,
              title,
              booking.check_in_date,
              booking.check_out_date,
              booking.guests_count,
              booking.total_price,
            );
          }
          if (hostProfile?.email) {
            const hostName = `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim();
            await sendBookingCancelledHost(
              hostProfile.email,
              hostName,
              guestName,
              title,
              booking.check_in_date,
              booking.check_out_date,
              booking.guests_count,
              booking.total_price,
            );
          }
        } catch (emailErr) {
          console.error('[useHotelBookings] cancel emails', emailErr);
        }

        return { success: true };
      } catch (e) {
        console.error('[useHotelBookings] cancel', e);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [user, sendBookingCancelled, sendBookingCancelledHost],
  );

  return {
    loading,
    error,
    createHotelBooking,
    fetchGuestBookings,
    fetchGuestBookingById,
    fetchHotelBookingById,
    cancelHotelBooking,
    calculateHotelBookingPricing,
    buildLinesFromRoomType,
  };
}
