import { supabase } from '../services/supabase';
import { isPhonePseudoEmail } from './displayContact';

export function isValidContactEmail(email: string): boolean {
  const norm = email.trim().toLowerCase();
  if (!norm || isPhonePseudoEmail(norm)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm);
}

export type EmailAvailabilityResult =
  | { ok: true }
  | { ok: false; message: string };

export async function assertEmailAvailableForProfile(
  email: string,
  userId: string,
): Promise<EmailAvailabilityResult> {
  const norm = email.trim().toLowerCase();
  if (!norm) return { ok: true };
  if (!isValidContactEmail(norm)) {
    return { ok: false, message: 'Adresse email invalide.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', norm)
    .neq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('email availability check:', error);
    return { ok: false, message: 'Impossible de vérifier cet email. Réessayez.' };
  }
  if (data) {
    return {
      ok: false,
      message: 'Cet email est déjà associé à un autre compte AkwaHome.',
    };
  }
  return { ok: true };
}
