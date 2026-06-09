import { supabase } from './supabase';

export type NotifyAdminsBookingPushParams = {
  bookingId: string;
  bookingType: 'property' | 'vehicle';
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
