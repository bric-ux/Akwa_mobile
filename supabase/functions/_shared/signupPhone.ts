import { isAfricanE164 } from "./sms.ts";

/** Indicatifs autorisés à l'inscription par téléphone (hors CI). */
const EUROPE_SIGNUP_DIAL_PREFIXES = [
  "+33", "+32", "+41", "+49", "+34", "+39", "+351", "+31", "+352", "+44", "+353",
  "+43", "+48", "+46", "+47", "+45", "+358", "+30", "+420", "+36", "+40", "+359",
  "+385", "+421", "+386", "+370", "+371", "+372", "+357", "+356", "+354", "+423",
] as const;

/** Inscription : Côte d'Ivoire (Termii) ou Europe (Twilio) uniquement. */
export function isAllowedSignupPhone(e164: string): boolean {
  if (e164.startsWith("+225")) return true;
  if (isAfricanE164(e164)) return false;
  return EUROPE_SIGNUP_DIAL_PREFIXES.some((p) => e164.startsWith(p));
}
