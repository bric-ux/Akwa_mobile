import { supabase } from './supabase';

export type NotifyAdminsBookingPushParams = {
  bookingId: string;
  bookingType: 'property' | 'vehicle' | 'hotel';
  listingTitle?: string;
  guestName?: string;
  status?: 'pending' | 'confirmed' | string;
  title?: string;
  body?: string;
};

/**
 * Envoie une notification push à tous les administrateurs ayant l'app installée.
 */
export async function notifyAdminsNewBookingPush(
  params: NotifyAdminsBookingPushParams,
): Promise<void> {
  if (!params.bookingId) return;
  try {
    await supabase.functions.invoke('notify-admins-booking-push', {
      body: params,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[notifyAdminsNewBookingPush] failed:', e);
    }
  }
}

/** Annulation ou modification : même canal que la nouvelle réservation. */
export function notifyAdminsBookingChange(params: {
  bookingId: string;
  bookingType: 'property' | 'vehicle' | 'hotel';
  event: 'cancelled' | 'modified';
  listingTitle?: string;
  guestName?: string;
}): void {
  const listing = params.listingTitle?.trim() || 'Annonce';
  const guest = params.guestName?.trim() || 'Un voyageur';
  const title =
    params.event === 'cancelled'
      ? params.bookingType === 'vehicle'
        ? 'Réservation véhicule annulée'
        : params.bookingType === 'hotel'
          ? 'Réservation hôtel annulée'
          : 'Réservation annulée'
      : params.bookingType === 'vehicle'
        ? 'Réservation véhicule modifiée'
        : params.bookingType === 'hotel'
          ? 'Réservation hôtel modifiée'
          : 'Réservation modifiée';
  void notifyAdminsNewBookingPush({
    bookingId: params.bookingId,
    bookingType: params.bookingType,
    listingTitle: listing,
    guestName: guest,
    status: params.event,
    title,
    body: `${guest} — ${listing}`,
  });
}
