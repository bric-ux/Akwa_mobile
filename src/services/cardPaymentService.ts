/**
 * Service centralisé pour le paiement par carte (Stripe).
 * Tous les appels à create-checkout-session et check-payment-status passent par ici.
 */
import { supabase } from './supabase';

const CREATE_CHECKOUT_SESSION = 'create-checkout-session';
const CHECK_PAYMENT_STATUS = 'check-payment-status';

export type BookingType = 'property' | 'vehicle';
export type PaymentType = 'booking' | 'modification_surplus' | 'vehicle_modification_surplus' | 'penalty' | 'platform_commission';

export interface CreateCheckoutSessionResult {
  url: string;
  checkout_token?: string;
  /** Stripe Checkout Session ID — à passer à checkPaymentStatus pour le surplus modification (évite de valider un ancien paiement) */
  session_id?: string;
}

export interface CheckPaymentStatusParams {
  booking_type?: BookingType;
  booking_id?: string;
  checkout_token?: string;
  payment_type?: PaymentType;
  /** Pour surplus modification : id de la session Stripe en cours — la confirmation ne vaut que pour ce paiement */
  stripe_session_id?: string;
  /** Pour commission plateforme : id de la ligne platform_commission_due (remplace booking_id) */
  commission_due_id?: string;
}

export interface CheckPaymentStatusResult {
  is_confirmed: boolean;
  payment_status?: string;
  booking_status?: string;
  booking_id?: string;
  error?: string;
}

/**
 * Crée une session Stripe Checkout. Utilisé pour :
 * - Réservation logement (booking_type: property, payment_type: booking)
 * - Réservation véhicule (booking_type: vehicle, payment_type: booking)
 * - Surplus de modification logement (payment_type: modification_surplus)
 * - Surplus de modification véhicule (payment_type: vehicle_modification_surplus)
 * - Pénalité (payment_type: penalty)
 */
export async function createCheckoutSession(
  body: Record<string, unknown>
): Promise<CreateCheckoutSessionResult> {
  const { data, error } = await supabase.functions.invoke(CREATE_CHECKOUT_SESSION, { body });

  if (error) {
    let serverMessage: string | null = null;
    try {
      const err = error as { context?: { json?: () => Promise<{ error?: string }> } };
      if (err?.context?.json) {
        const parsed = await err.context.json();
        serverMessage = parsed?.error ? String(parsed.error) : null;
      }
    } catch {
      // ignore
    }
    const msg = serverMessage && serverMessage.length < 120 ? serverMessage : error?.message || 'Erreur lors de l\'ouverture du paiement';
    throw new Error(msg);
  }

  const res = (data && typeof data === 'object' && (data as { data?: unknown }).data != null)
    ? (data as { data: { url?: string; session_id?: string; checkout_token?: string } }).data
    : (data as { url?: string; session_id?: string; checkout_token?: string });

  if (!res?.url) {
    const errMsg = (data as { error?: string })?.error || 'Impossible d\'ouvrir la page de paiement';
    throw new Error(errMsg);
  }

  return {
    url: res.url,
    checkout_token: res.checkout_token ?? (body.checkout_token as string | undefined),
    session_id: res.session_id,
  };
}

/**
 * Vérifie le statut d'un paiement Stripe (après retour de l'utilisateur).
 * Utilisé partout : BookingModal, VehicleBookingScreen, modals surplus, StripeReturnHandler, etc.
 */
export async function checkPaymentStatus(
  params: CheckPaymentStatusParams
): Promise<CheckPaymentStatusResult> {
  const { booking_type, booking_id, checkout_token, payment_type, stripe_session_id, commission_due_id } = params;
  const isCommissionCheck = payment_type === 'platform_commission' && commission_due_id;
  if (!isCommissionCheck && !booking_id && !checkout_token) {
    return { is_confirmed: false, payment_status: 'pending', booking_status: 'pending', error: 'booking_id ou checkout_token requis' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const body: Record<string, unknown> = { booking_type: booking_type ?? 'property' };
  if (checkout_token) body.checkout_token = checkout_token;
  if (booking_id) body.booking_id = booking_id;
  if (payment_type) body.payment_type = payment_type;
  if (stripe_session_id) body.stripe_session_id = stripe_session_id;
  if (commission_due_id) body.commission_due_id = commission_due_id;

  // Ne pas envoyer Content-Type manuellement : sur React Native/Expo ça peut vider le body (bug client Supabase)
  const options: { body: Record<string, unknown>; headers?: Record<string, string> } = { body };
  if (token) options.headers = { Authorization: `Bearer ${token}` };

  const { data: rawData, error } = await supabase.functions.invoke(CHECK_PAYMENT_STATUS, options);

  // Certains clients (ex. React Native) peuvent renvoyer la réponse dans data.data
  const data = (rawData && typeof rawData === 'object' && rawData.data != null)
    ? (rawData as { data: Record<string, unknown> }).data
    : (rawData as Record<string, unknown> | undefined);

  const ps = data?.payment_status != null ? String(data.payment_status) : 'pending';
  const bs = data?.booking_status != null ? String(data.booking_status) : 'pending';
  const resolvedBookingId = (data?.booking_id ?? booking_id) as string | undefined;

  if (error) {
    const errMsg = (data as { error?: string })?.error || error?.message || 'Erreur de vérification';
    return { is_confirmed: false, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId, error: errMsg };
  }

  const isConfirmed = data?.is_confirmed === true;
  if (isConfirmed) {
    return { is_confirmed: true, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId };
  }

  // Pour modification surplus : ne jamais confirmer sur booking_status (la résa est déjà confirmée, on vérifie uniquement le paiement du surplus).
  const isSurplusCheck = payment_type === 'modification_surplus' || payment_type === 'vehicle_modification_surplus';
  if (isSurplusCheck) {
    return { is_confirmed: false, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId };
  }

  const psLower = String(ps).toLowerCase();
  const bsLower = String(bs).toLowerCase();
  if (['completed', 'succeeded', 'paid'].includes(psLower) || ['confirmed', 'completed'].includes(bsLower)) {
    return { is_confirmed: true, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId };
  }

  return { is_confirmed: false, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId };
}
