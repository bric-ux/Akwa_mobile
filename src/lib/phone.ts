import * as Localization from 'expo-localization';
import { supabase } from '../services/supabase';

/** Indicatif Côte d'Ivoire — Twilio attend le 0 national après +225 (ex. +2250712345678). */
export const IVORY_COAST_DIAL = '+225';

/** Aligné sur PHONE_AUTH_COUNTRIES (évite import circulaire avec phoneAuth). */
const KNOWN_DIALS: { code: string; dial: string }[] = [
  { code: 'CI', dial: '+225' },
  { code: 'FR', dial: '+33' },
  { code: 'BE', dial: '+32' },
  { code: 'CH', dial: '+41' },
  { code: 'DE', dial: '+49' },
  { code: 'ES', dial: '+34' },
  { code: 'IT', dial: '+39' },
  { code: 'PT', dial: '+351' },
  { code: 'NL', dial: '+31' },
  { code: 'LU', dial: '+352' },
  { code: 'GB', dial: '+44' },
  { code: 'IE', dial: '+353' },
  { code: 'AT', dial: '+43' },
  { code: 'PL', dial: '+48' },
  { code: 'SE', dial: '+46' },
  { code: 'NO', dial: '+47' },
  { code: 'DK', dial: '+45' },
  { code: 'FI', dial: '+358' },
  { code: 'GR', dial: '+30' },
  { code: 'CZ', dial: '+420' },
  { code: 'HU', dial: '+36' },
  { code: 'RO', dial: '+40' },
  { code: 'BG', dial: '+359' },
  { code: 'HR', dial: '+385' },
  { code: 'SK', dial: '+421' },
  { code: 'SI', dial: '+386' },
  { code: 'LT', dial: '+370' },
  { code: 'LV', dial: '+371' },
  { code: 'EE', dial: '+372' },
  { code: 'CY', dial: '+357' },
  { code: 'MT', dial: '+356' },
  { code: 'IS', dial: '+354' },
  { code: 'LI', dial: '+423' },
];

const DIALS_BY_LENGTH = [...KNOWN_DIALS].sort((a, b) => b.dial.length - a.dial.length);

const PROFILE_COUNTRY_TO_CODE: Record<string, string> = {
  "cote d'ivoire": 'CI',
  "côte d'ivoire": 'CI',
  'ivory coast': 'CI',
  ci: 'CI',
  france: 'FR',
  fr: 'FR',
  belgique: 'BE',
  belgium: 'BE',
  be: 'BE',
  suisse: 'CH',
  switzerland: 'CH',
  ch: 'CH',
  'royaume-uni': 'GB',
  'united kingdom': 'GB',
  gb: 'GB',
  allemagne: 'DE',
  germany: 'DE',
  de: 'DE',
};

function dialForCountryCode(code: string | undefined): string {
  if (!code) return IVORY_COAST_DIAL;
  return KNOWN_DIALS.find((c) => c.code === code)?.dial ?? IVORY_COAST_DIAL;
}

/** Pays du profil (champ adresse) → indicatif téléphone. */
export function profileCountryToDial(country: string | null | undefined): string | undefined {
  if (!country?.trim()) return undefined;
  const key = country.trim().toLowerCase();
  const code = PROFILE_COUNTRY_TO_CODE[key] ?? (country.trim().length === 2 ? country.trim().toUpperCase() : undefined);
  return code ? dialForCountryCode(code) : undefined;
}

/**
 * Indicatif par défaut si le numéro stocké n'a pas de préfixe +.
 * Pays du profil → région de l'appareil (expo-localization) → +225.
 */
export function inferDefaultPhoneDial(profileCountry?: string | null): string {
  const fromProfile = profileCountryToDial(profileCountry);
  if (fromProfile) return fromProfile;

  try {
    const region = Localization.getLocales?.()?.[0]?.regionCode;
    if (region) return dialForCountryCode(region);
  } catch {
    /* ignore */
  }

  return IVORY_COAST_DIAL;
}

/**
 * Affichage du champ « numéro local » : préfixe 0 national si absent (tous pays listés).
 */
export function formatNationalForDisplay(dial: string, nationalPart: string): string {
  const d = nationalPart.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) return d;

  if (dial === IVORY_COAST_DIAL) {
    return normalizeIvoryCoastNational(d) ?? `0${d}`;
  }

  if (KNOWN_DIALS.some((k) => k.dial === dial) && d.length >= 8 && d.length <= 12) {
    return `0${d}`;
  }

  return d;
}

/** Partie nationale stockée après l'indicatif (avec 0 : +3307…, +22507…). */
export function nationalPartForE164(dial: string, local: string): string {
  return formatNationalForDisplay(dial, local);
}

/** Décompose un E.164 en indicatif + numéro local pour PhoneNumberField. */
export function splitE164ToDialAndLocal(e164: string): { dial: string; local: string } | null {
  const norm = normalizePhoneE164(e164);
  if (!norm) return null;

  for (const c of DIALS_BY_LENGTH) {
    if (!norm.startsWith(c.dial)) continue;
    const national = norm.slice(c.dial.length);
    return { dial: c.dial, local: formatNationalForDisplay(c.dial, national) };
  }

  return null;
}

/**
 * Prépare un numéro déjà enregistré pour PhoneNumberField.
 * Si +225 / +33 présent, l'indicatif est lu depuis le numéro.
 */
export function resolveProfilePhoneForInput(params: {
  phone?: string | null;
  phoneE164?: string | null;
  profileCountry?: string | null;
}): { dial: string; local: string } {
  const fallbackDial = inferDefaultPhoneDial(params.profileCountry);
  const rawE164 = params.phoneE164?.trim() || null;
  const rawPhone = params.phone?.trim() || null;
  const candidate = rawE164 || rawPhone;

  if (candidate?.startsWith('+')) {
    const split = splitE164ToDialAndLocal(candidate);
    if (split) return split;
  }

  if (rawPhone) {
    const built = buildE164(fallbackDial, rawPhone);
    const splitBuilt = splitE164ToDialAndLocal(built);
    if (splitBuilt) return splitBuilt;
    return {
      dial: fallbackDial,
      local: formatNationalForDisplay(fallbackDial, rawPhone),
    };
  }

  return { dial: fallbackDial, local: '' };
}

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

/** @deprecated Utiliser nationalPartForE164 */
export function normalizeLocalPart(dial: string, local: string): string {
  return nationalPartForE164(dial, local);
}

/** Construit un E.164 à partir de l'indicatif et du numéro local. */
export function buildE164(dial: string, local: string): string {
  const merged = `${dial}${nationalPartForE164(dial, local)}`;
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

  for (const c of DIALS_BY_LENGTH) {
    if (!p.startsWith(c.dial)) continue;
    const national = formatNationalForDisplay(c.dial, p.slice(c.dial.length));
    const result = `${c.dial}${national}`;
    return /^\+\d{8,15}$/.test(result) ? result : null;
  }

  return /^\+\d{8,15}$/.test(p) ? p : null;
}

/** Indicatifs hors CI : Twilio / Termii Europe — E.164 sans 0 trunk (ex. +33605636597). */
const TWILIO_STRIP_ZERO_DIALS = DIALS_BY_LENGTH
  .map((c) => c.dial)
  .filter((d) => d !== IVORY_COAST_DIAL);

/** Alias explicite avant envoi SMS (Termii Afrique, Twilio ailleurs). */
export function normalizePhoneForTwilio(phone: string): string | null {
  const base = normalizePhoneE164(phone);
  if (!base) return null;
  if (base.startsWith(IVORY_COAST_DIAL)) return base;

  for (const dial of TWILIO_STRIP_ZERO_DIALS) {
    if (!base.startsWith(dial)) continue;
    let national = base.slice(dial.length).replace(/\D/g, '');
    if (national.startsWith('0')) national = national.slice(1);
    const result = `${dial}${national}`;
    return /^\+\d{8,15}$/.test(result) ? result : null;
  }

  return base;
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
