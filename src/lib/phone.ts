import { supabase } from '../services/supabase';

/** Normalise un numéro au format E.164 (+225...) ou null si invalide. */
export function normalizePhoneE164(phone: string): string | null {
  let p = phone.replace(/\s+/g, '');
  if (!p.startsWith('+')) {
    const digits = p.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;
    p = `+${digits}`;
  }
  return /^\+\d{8,15}$/.test(p) ? p : null;
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

  const taken = (withPhone || []).some(
    (row) => row.phone && normalizePhoneE164(row.phone) === norm,
  );
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
