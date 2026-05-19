/** Aligné sur cote-d-ivoire-stays/src/components/auth/PhoneAuthForms.tsx */

import { buildE164, normalizePhoneE164 } from './phone';

export { buildE164, normalizePhoneE164 };

export const PHONE_PSEUDO_EMAIL_DOMAIN = '@phone.akwahome.local';

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const E164_REGEX = /^\+\d{8,15}$/;

export type CountryDial = {
  code: string;
  dial: string;
  flag: string;
  name: string;
};

/** Téléphone (inscription, connexion, reset) : Côte d'Ivoire + Europe. */
export const PHONE_AUTH_COUNTRIES: CountryDial[] = [
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'BE', dial: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Allemagne' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'Espagne' },
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italie' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'NL', dial: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
  { code: 'LU', dial: '+352', flag: '🇱🇺', name: 'Luxembourg' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'IE', dial: '+353', flag: '🇮🇪', name: 'Irlande' },
  { code: 'AT', dial: '+43', flag: '🇦🇹', name: 'Autriche' },
  { code: 'PL', dial: '+48', flag: '🇵🇱', name: 'Pologne' },
  { code: 'SE', dial: '+46', flag: '🇸🇪', name: 'Suède' },
  { code: 'NO', dial: '+47', flag: '🇳🇴', name: 'Norvège' },
  { code: 'DK', dial: '+45', flag: '🇩🇰', name: 'Danemark' },
  { code: 'FI', dial: '+358', flag: '🇫🇮', name: 'Finlande' },
  { code: 'GR', dial: '+30', flag: '🇬🇷', name: 'Grèce' },
  { code: 'CZ', dial: '+420', flag: '🇨🇿', name: 'Tchéquie' },
  { code: 'HU', dial: '+36', flag: '🇭🇺', name: 'Hongrie' },
  { code: 'RO', dial: '+40', flag: '🇷🇴', name: 'Roumanie' },
  { code: 'BG', dial: '+359', flag: '🇧🇬', name: 'Bulgarie' },
  { code: 'HR', dial: '+385', flag: '🇭🇷', name: 'Croatie' },
  { code: 'SK', dial: '+421', flag: '🇸🇰', name: 'Slovaquie' },
  { code: 'SI', dial: '+386', flag: '🇸🇮', name: 'Slovénie' },
  { code: 'LT', dial: '+370', flag: '🇱🇹', name: 'Lituanie' },
  { code: 'LV', dial: '+371', flag: '🇱🇻', name: 'Lettonie' },
  { code: 'EE', dial: '+372', flag: '🇪🇪', name: 'Estonie' },
  { code: 'CY', dial: '+357', flag: '🇨🇾', name: 'Chypre' },
  { code: 'MT', dial: '+356', flag: '🇲🇹', name: 'Malte' },
  { code: 'IS', dial: '+354', flag: '🇮🇸', name: 'Islande' },
  { code: 'LI', dial: '+423', flag: '🇱🇮', name: 'Liechtenstein' },
];

/** @deprecated Utiliser PHONE_AUTH_COUNTRIES */
export const PHONE_SIGNUP_COUNTRIES = PHONE_AUTH_COUNTRIES;

/** @deprecated Utiliser PHONE_AUTH_COUNTRIES */
export const COUNTRIES = PHONE_AUTH_COUNTRIES;

/** @deprecated Utiliser normalizeLocalPart / buildE164 depuis ./phone */
export function digitsOnly(raw: string, dial = '+225'): string {
  const d = raw.replace(/\D/g, '');
  if (dial === '+225') return d;
  return d.replace(/^0+/, '');
}

export function isPhonePseudoEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(PHONE_PSEUDO_EMAIL_DOMAIN);
}

/** JJ/MM/AAAA */
export function formatDateDdMmYyyy(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseDdMmYyyyToDate(dateString: string): Date | null {
  if (!dateString) return null;
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

/** Dernière date de naissance autorisée (18 ans révolus aujourd’hui). */
export function getMaxDateOfBirth(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

export function getMinDateOfBirth(): Date {
  const d = new Date(1920, 0, 1, 12, 0, 0, 0);
  return d;
}

export function getDefaultDateOfBirthPickerValue(current?: string): Date {
  const parsed = current ? parseDdMmYyyyToDate(current) : null;
  if (parsed) return clampDateOfBirth(parsed);
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setFullYear(d.getFullYear() - 25);
  return clampDateOfBirth(d);
}

/** Garde la date dans les bornes du picker (évite plantages / dates invalides sur Android). */
export function clampDateOfBirth(date: Date): Date {
  const min = getMinDateOfBirth().getTime();
  const max = getMaxDateOfBirth().getTime();
  const t = date.getTime();
  const clamped = new Date(Math.min(Math.max(t, min), max));
  clamped.setHours(12, 0, 0, 0);
  return clamped;
}

/** DD/MM/YYYY → YYYY-MM-DD pour l’API verify-phone-otp */
export function dateDdMmYyyyToIso(dateString: string): string | null {
  if (!dateString) return null;
  const parts = dateString.split('/');
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

export function validateAdultAgeDdMmYyyy(dateOfBirth: string): { isValid: boolean; message: string } {
  if (!dateOfBirth) return { isValid: false, message: 'La date de naissance est requise' };
  const parts = dateOfBirth.split('/');
  if (parts.length !== 3) return { isValid: false, message: 'Format JJ/MM/AAAA' };
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { isValid: false, message: 'Date invalide' };
  }
  const birthDate = new Date(year, month, day);
  const today = new Date();
  if (birthDate > today) return { isValid: false, message: 'La date ne peut pas être dans le futur' };
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 18
    ? { isValid: true, message: '' }
    : { isValid: false, message: 'Vous devez avoir au moins 18 ans' };
}
