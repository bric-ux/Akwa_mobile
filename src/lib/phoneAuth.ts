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

export const COUNTRIES: CountryDial[] = [
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: 'BJ', dial: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: 'BF', dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'ML', dial: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: 'TG', dial: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: 'NE', dial: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: 'GN', dial: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: 'GA', dial: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: 'CG', dial: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: 'CD', dial: '+243', flag: '🇨🇩', name: 'RD Congo' },
  { code: 'MA', dial: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: 'TN', dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: 'BE', dial: '+32', flag: '🇧🇪', name: 'Belgique' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Suisse' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
];

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
