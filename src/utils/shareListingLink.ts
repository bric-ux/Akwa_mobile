import { Platform, Share } from 'react-native';
import { logError } from './logger';

const DEFAULT_WEB_ORIGIN = 'https://akwahome.com';

/**
 * Base URL du site voyageur (mêmes routes que cote-d-ivoire-stays : /property/:id, /vehicles/:id).
 * Surcharge : EXPO_PUBLIC_WEB_APP_URL (sans slash final).
 */
export function getWebAppOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_APP_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/\/+$/, '');
  }
  return DEFAULT_WEB_ORIGIN;
}

export function slugifyProfileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'hote'
  );
}

export function getPropertyPublicWebUrl(propertyId: string): string {
  return `${getWebAppOrigin()}/property/${encodeURIComponent(propertyId)}`;
}

export function getVehiclePublicWebUrl(vehicleId: string): string {
  return `${getWebAppOrigin()}/vehicles/${encodeURIComponent(vehicleId)}`;
}

export type PublicProfileShareType = 'host' | 'vehicle';

export function getOwnerPublicWebUrl(
  userId: string,
  options?: {
    name?: string;
    type?: PublicProfileShareType;
    listings?: boolean;
    tab?: 'properties' | 'vehicles' | 'reviews';
  },
): string {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.listings) params.set('listings', '1');
  if (options?.tab) params.set('tab', options.tab);
  const qs = params.toString();
  const slug = options?.name?.trim() ? slugifyProfileName(options.name.trim()) : null;
  const path = slug
    ? `/profil/${slug}/${encodeURIComponent(userId)}`
    : `/profile/${encodeURIComponent(userId)}`;
  return `${getWebAppOrigin()}${path}${qs ? `?${qs}` : ''}`;
}

export async function shareProfileLink(options: {
  url: string;
  name: string;
  type?: PublicProfileShareType;
}): Promise<void> {
  const roleLabel = options.type === 'vehicle' ? 'propriétaire véhicule' : 'hôte';
  const introLine = `Découvrez le profil ${roleLabel} de ${options.name} sur AkwaHome`;
  await shareListingLink({
    url: options.url,
    title: `Profil ${options.name}`,
    introLine,
  });
}

export async function shareListingLink(options: {
  url: string;
  title: string;
  introLine: string;
}): Promise<void> {
  const { url, title, introLine } = options;
  const message = `${introLine}\n\n${title}\n${url}`;
  try {
    await Share.share({
      message,
      title: 'AkwaHome',
      ...(Platform.OS === 'ios' ? { url } : {}),
    });
  } catch (e: unknown) {
    logError('shareListingLink', e);
  }
}
