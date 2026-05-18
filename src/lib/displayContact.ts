import { PHONE_PSEUDO_EMAIL_DOMAIN } from './phoneAuth';

export function isPhonePseudoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(PHONE_PSEUDO_EMAIL_DOMAIN);
}

/** Affiche le numéro pour les comptes créés par téléphone (email technique masqué). */
export function displayEmailOrPhone(
  email: string | null | undefined,
  fallbackPhone?: string | null,
): string {
  if (!email) return fallbackPhone || '';
  if (isPhonePseudoEmail(email)) {
    const digits = email.split('@')[0];
    return digits ? `+${digits}` : fallbackPhone || '';
  }
  return email;
}
