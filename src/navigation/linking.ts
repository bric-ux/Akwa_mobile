import {
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';
import { getWebAppOrigin } from '../utils/shareListingLink';
import type { RootStackParamList } from '../types';

const WEB_ORIGIN = getWebAppOrigin();

export const APP_LINK_PREFIXES = [
  WEB_ORIGIN,
  'https://akwahome.com',
  'https://www.akwahome.com',
  'akwahomemobile://',
];

function mapHostProfileQueryParams(params: Record<string, unknown>) {
  const next = { ...params };
  const listings = next.listings;
  if (next.showListings == null && (listings === '1' || listings === 1 || listings === true)) {
    next.showListings = true;
  }
  if (next.profileContext == null && next.type === 'vehicle') {
    next.profileContext = 'vehicle';
    if (next.listingsTab == null) {
      next.listingsTab = 'vehicles';
    }
  }
  if (
    next.listingsTab == null &&
    (next.tab === 'vehicles' || next.tab === 'properties' || next.tab === 'reviews')
  ) {
    next.listingsTab = next.tab;
  }
  if (typeof next.hostId === 'string') {
    next.hostId = decodeURIComponent(next.hostId);
  }
  return next;
}

/** Mappe les query params web (?listings=1&type=vehicle) vers les params de navigation mobile. */
function normalizeDeepLinkState(
  state: ReturnType<typeof defaultGetStateFromPath> | undefined,
) {
  if (!state?.routes?.length) return state;

  const routes = state.routes.map((route) => {
    if (route.name !== 'HostProfile' || !route.params || typeof route.params !== 'object') {
      return route;
    }
    return { ...route, params: mapHostProfileQueryParams(route.params as Record<string, unknown>) };
  });

  return { ...state, routes };
}

/** /profile/{uuid} ou /profil/{uuid} sans slug → /profil/_/{uuid} */
function toCanonicalProfilePath(path: string): string {
  const [pathname, query = ''] = path.split('?');
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (
    segments.length === 2 &&
    (segments[0] === 'profile' || segments[0] === 'profil')
  ) {
    const id = segments[1];
    const canonical = `/profil/_/${encodeURIComponent(decodeURIComponent(id))}`;
    return query ? `${canonical}?${query}` : canonical;
  }
  return path;
}

export const appLinking: LinkingOptions<RootStackParamList> = {
  prefixes: APP_LINK_PREFIXES,
  config: {
    screens: {
      Home: '',
      Search: 'search',
      HostProfile: {
        path: 'profil/:nameSlug/:hostId',
        parse: {
          hostId: (hostId: string) => decodeURIComponent(hostId),
          showListings: (value: string) => value === '1' || value === 'true',
          profileContext: (value: string) => (value === 'vehicle' ? 'vehicle' : 'host'),
          listingsTab: (value: string) =>
            value === 'vehicles' || value === 'properties' || value === 'reviews'
              ? value
              : undefined,
        },
      },
      PropertyDetails: {
        path: 'property/:propertyId',
        parse: {
          propertyId: (propertyId: string) => decodeURIComponent(propertyId),
        },
      },
      VehicleDetails: {
        path: 'vehicles/:vehicleId',
        parse: {
          vehicleId: (vehicleId: string) => decodeURIComponent(vehicleId),
        },
      },
    },
  },
  getStateFromPath(path, options) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const canonical = toCanonicalProfilePath(normalized);
    return normalizeDeepLinkState(defaultGetStateFromPath(canonical, options));
  },
};
