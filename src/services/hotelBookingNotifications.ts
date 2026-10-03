import { supabase } from './supabase';
import { sendPushToUser } from './pushNotificationService';
import { PUSH_TYPE_HOTEL_BOOKING } from './pushNavigation';
import { notifyAdminsNewBookingPush } from './notifyAdminsBookingPush';

type HotelBookingContext = {
  id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  total_price: number;
  host_net_amount: number | null;
  guest_id: string;
  booking_code?: string | null;
  establishment: { id: string; title: string; host_id: string };
  guest: { email: string; name: string };
  host: { email: string; name: string; phone?: string | null };
};

async function loadHotelBookingContext(bookingId: string): Promise<HotelBookingContext | null> {
  const { data: booking, error } = await supabase
    .from('hotel_bookings')
    .select(`
      id,
      status,
      check_in_date,
      check_out_date,
      guests_count,
      total_price,
      host_net_amount,
      guest_id,
      booking_code,
      establishment_id,
      hotel_establishments(id, title, host_id)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) return null;

  const establishment = (booking as any).hotel_establishments;
  if (!establishment?.host_id) return null;

  const userIds = [booking.guest_id, establishment.host_id];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email, phone, phone_e164')
    .in('user_id', userIds);

  const byId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
  const guestProfile = byId[booking.guest_id];
  const hostProfile = byId[establishment.host_id];

  const guestName =
    [guestProfile?.first_name, guestProfile?.last_name].filter(Boolean).join(' ') || 'Voyageur';
  const hostName =
    [hostProfile?.first_name, hostProfile?.last_name].filter(Boolean).join(' ') || 'Hôtelier';

  return {
    id: booking.id,
    status: booking.status,
    check_in_date: booking.check_in_date,
    check_out_date: booking.check_out_date,
    guests_count: booking.guests_count,
    total_price: booking.total_price,
    host_net_amount:
      (booking as any).host_net_amount != null
        ? Number((booking as any).host_net_amount)
        : null,
    guest_id: booking.guest_id,
    booking_code: booking.booking_code,
    establishment: {
      id: establishment.id,
      title: establishment.title,
      host_id: establishment.host_id,
    },
    guest: { email: guestProfile?.email || '', name: guestName },
    host: {
      email: hostProfile?.email || '',
      name: hostName,
      phone: hostProfile?.phone_e164 || hostProfile?.phone,
    },
  };
}

async function invokeEmail(type: string, to: string, data: Record<string, unknown>): Promise<void> {
  if (!to.trim()) return;
  try {
    await supabase.functions.invoke('send-email', { body: { type, to, data } });
  } catch (e) {
    if (__DEV__) console.warn('[hotelBookingNotifications] email failed:', type, e);
  }
}

function hostEmailAmountFields(ctx: HotelBookingContext): Record<string, unknown> {
  return {
    totalPrice: ctx.total_price,
    host_net_amount: ctx.host_net_amount,
    hostNetAmount: ctx.host_net_amount,
  };
}

/** Nouvelle réservation hôtel (espèces ou demande en attente). */
export async function notifyHotelBookingCreated(bookingId: string): Promise<void> {
  const ctx = await loadHotelBookingContext(bookingId);
  if (!ctx) return;

  const title = ctx.establishment.title;
  const isConfirmed = ctx.status === 'confirmed';

  await Promise.all([
    invokeEmail('booking_request', ctx.host.email, {
      hostName: ctx.host.name,
      guestName: ctx.guest.name,
      propertyTitle: title,
      checkIn: ctx.check_in_date,
      checkOut: ctx.check_out_date,
      checkInDate: ctx.check_in_date,
      checkOutDate: ctx.check_out_date,
      guests: ctx.guests_count,
      ...hostEmailAmountFields(ctx),
      booking_code: ctx.booking_code,
      isHotel: true,
    }),
    invokeEmail('booking_request_sent', ctx.guest.email, {
      guestName: ctx.guest.name,
      propertyTitle: title,
      checkIn: ctx.check_in_date,
      checkOut: ctx.check_out_date,
      guests: ctx.guests_count,
      totalPrice: ctx.total_price,
      booking_code: ctx.booking_code,
      isHotel: true,
    }),
    sendPushToUser(
      ctx.establishment.host_id,
      'Nouvelle réservation hôtel',
      `${ctx.guest.name} — ${title}`,
      { type: PUSH_TYPE_HOTEL_BOOKING, bookingId: ctx.id, role: 'host' },
    ).catch(() => {}),
    sendPushToUser(
      ctx.guest_id,
      isConfirmed ? 'Réservation confirmée' : 'Demande envoyée',
      isConfirmed
        ? `Votre séjour à ${title} est confirmé.`
        : `Votre demande pour ${title} a été transmise à l'hôtel.`,
      { type: PUSH_TYPE_HOTEL_BOOKING, bookingId: ctx.id, role: 'guest' },
    ).catch(() => {}),
    notifyAdminsNewBookingPush({
      bookingId: ctx.id,
      bookingType: 'hotel',
      listingTitle: title,
      guestName: ctx.guest.name,
      status: ctx.status,
      title: 'Nouvelle réservation hôtel',
      body: `${ctx.guest.name} — ${title} (${isConfirmed ? 'confirmée' : 'en attente'})`,
    }),
  ]);
}

/** Confirmation ou refus par l'hôtelier. */
export async function notifyHotelBookingStatusChange(
  bookingId: string,
  newStatus: 'confirmed' | 'cancelled',
): Promise<void> {
  const ctx = await loadHotelBookingContext(bookingId);
  if (!ctx) return;

  const title = ctx.establishment.title;

  if (newStatus === 'confirmed') {
    await Promise.all([
      invokeEmail('booking_confirmed', ctx.guest.email, {
        guestName: ctx.guest.name,
        propertyTitle: title,
        checkIn: ctx.check_in_date,
        checkOut: ctx.check_out_date,
        guests: ctx.guests_count,
        totalPrice: ctx.total_price,
        hostName: ctx.host.name,
        hostPhone: ctx.host.phone || '',
        hostEmail: ctx.host.email,
        propertyAddress: '',
        isHotel: true,
      }),
      invokeEmail('booking_confirmed_host', ctx.host.email, {
        hostName: ctx.host.name,
        guestName: ctx.guest.name,
        propertyTitle: title,
        checkIn: ctx.check_in_date,
        checkOut: ctx.check_out_date,
        guests: ctx.guests_count,
        ...hostEmailAmountFields(ctx),
        isHotel: true,
      }),
      sendPushToUser(
        ctx.guest_id,
        'Réservation confirmée',
        `Votre séjour à ${title} a été confirmé.`,
        { type: PUSH_TYPE_HOTEL_BOOKING, bookingId: ctx.id, role: 'guest' },
      ).catch(() => {}),
    ]);
    return;
  }

  await Promise.all([
    invokeEmail('booking_cancelled', ctx.guest.email, {
      guestName: ctx.guest.name,
      propertyTitle: title,
      checkIn: ctx.check_in_date,
      checkOut: ctx.check_out_date,
      guests: ctx.guests_count,
      totalPrice: ctx.total_price,
      isHotel: true,
    }),
    invokeEmail('booking_cancelled_host', ctx.host.email, {
      hostName: ctx.host.name,
      guestName: ctx.guest.name,
      propertyTitle: title,
      checkIn: ctx.check_in_date,
      checkOut: ctx.check_out_date,
      guests: ctx.guests_count,
      ...hostEmailAmountFields(ctx),
      isHotel: true,
    }),
    sendPushToUser(
      ctx.guest_id,
      'Réservation refusée',
      `Votre demande pour ${title} a été refusée.`,
      { type: PUSH_TYPE_HOTEL_BOOKING, bookingId: ctx.id, role: 'guest' },
    ).catch(() => {}),
  ]);
}

/** Annulation par le voyageur → notifie l’hôtelier. */
export async function notifyHotelBookingCancelledByGuest(bookingId: string): Promise<void> {
  const ctx = await loadHotelBookingContext(bookingId);
  if (!ctx) return;

  const title = ctx.establishment.title;

  await Promise.all([
    invokeEmail('booking_cancelled_host', ctx.host.email, {
      hostName: ctx.host.name,
      guestName: ctx.guest.name,
      propertyTitle: title,
      checkIn: ctx.check_in_date,
      checkOut: ctx.check_out_date,
      guests: ctx.guests_count,
      ...hostEmailAmountFields(ctx),
      isHotel: true,
    }),
    sendPushToUser(
      ctx.establishment.host_id,
      'Réservation annulée',
      `${ctx.guest.name} a annulé sa demande pour ${title}.`,
      { type: PUSH_TYPE_HOTEL_BOOKING, bookingId: ctx.id, role: 'host' },
    ).catch(() => {}),
  ]);
}
