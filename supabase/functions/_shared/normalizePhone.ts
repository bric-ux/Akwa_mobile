/** Indicatif Côte d'Ivoire — format +22507… (Termii / Twilio via sendSmsSmart). */
export const IVORY_COAST_DIAL = "+225";

/**
 * Partie nationale CI : 10 chiffres commençant par 0 (07, 05, 01…).
 * Si 9 chiffres sans 0 (712345678), on préfixe par 0.
 */
export function normalizeIvoryCoastNational(national: string): string | null {
  const d = national.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10 && d.startsWith("0")) return d;
  if (d.length === 9) return `0${d}`;
  return null;
}

/** Normalise un numéro E.164 ; pour la CI conserve le 0 après +225. */
export function normalizePhoneE164(phone: string): string | null {
  let p = phone.replace(/\s+/g, "");
  if (!p.startsWith("+")) {
    const digits = p.replace(/\D/g, "");
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

/** Alias avant envoi SMS (Termii Afrique, Twilio ailleurs). */
export function normalizePhoneForTwilio(phone: string): string | null {
  return normalizePhoneE164(phone);
}
