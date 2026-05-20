/** Indicatif Côte d'Ivoire — Twilio attend le 0 national après +225 (ex. +2250712345678). */
export const IVORY_COAST_DIAL = "+225";

/** Indicatifs avec 0 national stocké après le code pays (+3307…, +22507…). */
const DIALS_WITH_TRUNK_ZERO = [
  "+423", "+420", "+351", "+358", "+357", "+356", "+354", "+386", "+385", "+359",
  "+225", "+421", "+371", "+372", "+370", "+36", "+40", "+30", "+420", "+49", "+34",
  "+39", "+33", "+32", "+31", "+352", "+44", "+353", "+43", "+48", "+46", "+47", "+45",
].sort((a, b) => b.length - a.length);

function formatNationalWithTrunkZero(dial: string, national: string): string {
  const d = national.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) return d;
  if (dial === IVORY_COAST_DIAL) {
    return normalizeIvoryCoastNational(d) ?? `0${d}`;
  }
  if (d.length >= 8 && d.length <= 12) return `0${d}`;
  return d;
}

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

/** Normalise un numéro E.164 ; conserve le 0 national après l'indicatif. */
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

  for (const dial of DIALS_WITH_TRUNK_ZERO) {
    if (!p.startsWith(dial)) continue;
    const national = formatNationalWithTrunkZero(dial, p.slice(dial.length));
    if (!national) return null;
    const result = `${dial}${national}`;
    return /^\+\d{8,15}$/.test(result) ? result : null;
  }

  return /^\+\d{8,15}$/.test(p) ? p : null;
}

/**
 * Numéro pour envoi SMS (Twilio Europe = E.164 sans 0 trunk ; CI = +22507…).
 */
export function phoneE164ForSms(phone: string): string | null {
  const norm = normalizePhoneE164(phone);
  if (!norm) return null;
  if (norm.startsWith(IVORY_COAST_DIAL)) return norm;

  for (const dial of DIALS_WITH_TRUNK_ZERO) {
    if (!norm.startsWith(dial)) continue;
    const national = norm.slice(dial.length);
    if (national.startsWith("0")) {
      return `${dial}${national.replace(/^0+/, "")}`;
    }
    return norm;
  }
  return norm;
}

/** Alias avant envoi SMS (Termii Afrique, Twilio ailleurs). */
export function normalizePhoneForTwilio(phone: string): string | null {
  return phoneE164ForSms(phone);
}
