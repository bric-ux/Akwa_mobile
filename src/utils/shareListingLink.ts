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

export function getPropertyPublicWebUrl(propertyId: string): string {
  return `${getWebAppOrigin()}/property/${encodeURIComponent(propertyId)}`;
}

export function getVehiclePublicWebUrl(vehicleId: string): string {
  return `${getWebAppOrigin()}/vehicles/${encodeURIComponent(vehicleId)}`;
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
