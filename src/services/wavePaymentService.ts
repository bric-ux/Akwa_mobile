/**
 * Service unifié pour le paiement Wave.
 * Utilisé pour : réservation, modification surplus, pénalité, commission.
 * Même flux partout : create-wave-checkout-session → Wave → webhook → vérification.
 */
import { Linking } from 'react-native';
import { supabase } from './supabase';

const CREATE_WAVE_CHECKOUT = 'create-wave-checkout-session';

export type WavePaymentType = 'booking' | 'modification_surplus' | 'penalty' | 'platform_commission';

export interface CreateWaveCheckoutResult {
  wave_launch_url: string;
  checkout_token: string;
  checkout_id?: string;
  payment_type: WavePaymentType;
}

/**
 * Crée une session de paiement Wave et retourne l'URL à ouvrir.
 * Même API pour tous les types : résa, modification, pénalité, commission.
 */
export async function createWaveCheckoutSession(
  body: Record<string, unknown>
): Promise<CreateWaveCheckoutResult> {
  const { data, error } = await supabase.functions.invoke(CREATE_WAVE_CHECKOUT, { body });

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
    const msg =
      serverMessage && serverMessage.length < 120
        ? serverMessage
        : error?.message || "Erreur lors de l'ouverture du paiement Wave";
    throw new Error(msg);
  }

  const res =
    data && typeof data === 'object' && (data as { data?: unknown }).data != null
      ? (data as { data: CreateWaveCheckoutResult }).data
      : (data as CreateWaveCheckoutResult);

  if (!res?.wave_launch_url) {
    const errMsg = (data as { error?: string })?.error || "Impossible d'ouvrir Wave";
    throw new Error(errMsg);
  }

  return {
    wave_launch_url: res.wave_launch_url,
    checkout_token: res.checkout_token ?? (body.checkout_token as string),
    checkout_id: res.checkout_id,
    payment_type: (res.payment_type ?? body.payment_type ?? 'booking') as WavePaymentType,
  };
}

/**
 * Ouvre l'URL Wave pour le paiement (ouvre l'app Wave ou le navigateur).
 */
export async function openWavePayment(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    throw new Error("Impossible d'ouvrir Wave. Vérifiez que l'app Wave est installée.");
  }
}
