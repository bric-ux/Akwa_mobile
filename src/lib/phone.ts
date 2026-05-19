import { supabase } from '../services/supabase';

/** Indicatif Côte d'Ivoire — Twilio attend le 0 national après +225 (ex. +2250712345678). */
export const IVORY_COAST_DIAL = '+225';

/**
 * Partie nationale CI : 10 chiffres commençant par 0 (07, 05, 01…).
 * Si 9 chiffres sans 0 (712345678), on préfixe par 0.
 */
export function normalizeIvoryCoastNational(national: string): string | null {
  const d = national.replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 9) return `0${d}`;
  return null;
}

/** Partie locale selon le pays (CI : garde le 0 ; autres : retire les zéros en tête). */
export function normalizeLocalPart(dial: string, local: string): string {
  const d = local.replace(/\D/g, '');
  if (dial === IVORY_COAST_DIAL) {
    return normalizeIvoryCoastNational(d) ?? d;
  }
  return d.replace(/^0+/, '');
}

/** Construit un E.164 à partir de l'indicatif et du numéro local. */
export function buildE164(dial: string, local: string): string {
  const merged = `${dial}${normalizeLocalPart(dial, local)}`;
  return normalizePhoneE164(merged) ?? merged;
}

/** Normalise un numéro au format E.164 (+225…) ou null si invalide. */
export function normalizePhoneE164(phone: string): string | null {
  let p = phone.replace(/\s+/g, '');
  if (!p.startsWith('+')) {
    const digits = p.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;
    p = `+${digits}`;
  }

  if (p.startsWith(IVORY_COAST_DIAL)) {
    const national = p.slice(IVORY_COAST_DIAL.length);
    if (!/^\d+$/.test(national)) return null;
    const normNational = normalizeIvoryCoastNational(national);
    if (!normNational) return null;
    const result = `${IVORY_COAST_DIAL}${normNational}`;
    return /^\+\d{8,15}$/.test(result) ? result : null;
  }

  return /^\+\d{8,15}$/.test(p) ? p : null;
}

/** Alias explicite avant envoi SMS Twilio. */
export function normalizePhoneForTwilio(phone: string): string | null {
  return normalizePhoneE164(phone);
}

export type PhoneAvailabilityResult =
  | { ok: true }
  | { ok: false; message: string };

/** Vérifie que le numéro n'est pas déjà utilisé par un autre compte (sans migration obligatoire). */
export async function assertPhoneAvailableForProfile(
  phone: string,
  userId: string,
): Promise<PhoneAvailabilityResult> {
  const trimmed = phone.trim();
  if (!trimmed) return { ok: true };

  const norm = normalizePhoneE164(trimmed);
  if (!norm) {
    return {
      ok: false,
      message: 'Utilisez le format international, par exemple +225 07 12 34 56 78.',
    };
  }

  const { data: byE164, error: e164Error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('phone_e164', norm)
    .neq('user_id', userId)
    .maybeSingle();

  if (e164Error) {
    console.error('phone_e164 check:', e164Error);
    return { ok: false, message: 'Impossible de vérifier ce numéro. Réessayez.' };
  }
  if (byE164) {
    return {
      ok: false,
      message: 'Ce numéro est déjà associé à un autre compte AkwaHome.',
    };
  }

  const { data: withPhone, error: phoneError } = await supabase
    .from('profiles')
    .select('user_id, phone')
    .not('phone', 'is', null)
    .neq('user_id', userId)
    .limit(500);

  if (phoneError) {
    console.error('phone column check:', phoneError);
    return { ok: false, message: 'Impossible de vérifier ce numéro. Réessayez.' };
  }

  const taken = (withPhone || []).some((row) => {
    if (!row.phone) return false;
    return normalizePhoneE164(row.phone) === norm;
  });
  if (taken) {
    return {
      ok: false,
      message: 'Ce numéro est déjà associé à un autre compte AkwaHome.',
    };
  }

  return { ok: true };
}

export function isPhoneAlreadyUsedError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  return (error.message || '').toLowerCase().includes('déjà associé');
}
