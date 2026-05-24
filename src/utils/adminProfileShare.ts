import { getOwnerPublicWebUrl, PublicProfileShareType } from './shareListingLink';

export type ProfileShareRecipient = {
  user_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  phone_e164?: string | null;
  is_host: boolean;
  is_vehicle_owner: boolean;
};

export type ProfileShareAudience =
  | 'single'
  | 'hosts'
  | 'vehicle_owners'
  | 'all_hosts_and_owners';

export const DEFAULT_PROFILE_SHARE_MESSAGE = `Bonjour {{firstName}},

Votre vitrine AkwaHome est prête ! Partagez ce lien sur vos réseaux (WhatsApp, Facebook, Instagram…) pour que les voyageurs découvrent vos annonces :

{{profileUrl}}

Merci de faire vivre AkwaHome !
L'équipe AkwaHome`;

export function getRecipientDisplayName(r: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Hôte';
}

export function resolveProfileShareType(
  recipient: Pick<ProfileShareRecipient, 'is_host' | 'is_vehicle_owner'>,
): PublicProfileShareType {
  if (recipient.is_vehicle_owner && !recipient.is_host) {
    return 'vehicle';
  }
  return 'host';
}

export function buildProfileUrlForRecipient(recipient: ProfileShareRecipient): string {
  const name = getRecipientDisplayName(recipient);
  const type = resolveProfileShareType(recipient);
  return getOwnerPublicWebUrl(recipient.user_id, {
    name,
    type,
    listings: true,
  });
}

export function fillProfileShareMessage(
  template: string,
  vars: { firstName: string; profileUrl: string },
): string {
  return template
    .replace(/\{\{firstName\}\}/g, vars.firstName)
    .replace(/\{\{profileUrl\}\}/g, vars.profileUrl);
}

/** Chiffres uniquement, préfixe 225 pour numéros ivoiriens locaux. */
export function phoneForWhatsApp(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '225' + d.slice(1);
  if (d.length < 8) return null;
  return d;
}

/** Format E.164 (+225…) pour Twilio / send-email SMS. */
export function phoneForSmsE164(
  phone?: string | null,
  phoneE164?: string | null,
): string | null {
  if (phoneE164?.trim()) {
    let normalized = phoneE164.trim().replace(/\s+/g, '');
    if (!normalized.startsWith('+')) {
      const digits = normalized.replace(/\D/g, '');
      if (!digits) return null;
      normalized = `+${digits}`;
    }
    if (/^\+\d{8,15}$/.test(normalized)) return normalized;
  }
  const waDigits = phoneForWhatsApp(phone);
  if (!waDigits) return null;
  return `+${waDigits}`;
}

/** Adresse fictive routée vers SMS par send-email. */
export function phoneToSmsRoutingEmail(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  return `${digits}@phone.akwahome.local`;
}

export function truncateSmsBody(text: string, maxLen = 480): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

export function recipientHasSmsChannel(r: ProfileShareRecipient): boolean {
  return phoneForSmsE164(r.phone, r.phone_e164) !== null;
}

export function recipientHasEmailChannel(r: ProfileShareRecipient): boolean {
  const email = r.email?.trim();
  if (!email) return false;
  return !email.toLowerCase().endsWith('@phone.akwahome.local');
}
