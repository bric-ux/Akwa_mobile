import { PHONE_PSEUDO_EMAIL_DOMAIN } from './phoneAuth';
import { normalizePhoneE164 } from './phone';

export function isPhonePseudoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(PHONE_PSEUDO_EMAIL_DOMAIN);
}

/** Email de contact affiché (profil prioritaire, sinon auth si réel). */
export function getProfileContactEmail(
  authEmail?: string | null,
  profileEmail?: string | null,
): string {
  if (profileEmail && !isPhonePseudoEmail(profileEmail)) return profileEmail;
  if (authEmail && !isPhonePseudoEmail(authEmail)) return authEmail;
  return '';
}

/** Affiche le numéro pour les comptes créés par téléphone (email technique masqué). */
export function displayEmailOrPhone(
  email: string | null | undefined,
  fallbackPhone?: string | null,
): string {
  if (!email) return fallbackPhone || '';
  if (isPhonePseudoEmail(email)) {
    const digits = email.split('@')[0];
    if (!digits) return fallbackPhone || '';
    return normalizePhoneE164(`+${digits}`) ?? `+${digits}`;
  }
  return email;
}
