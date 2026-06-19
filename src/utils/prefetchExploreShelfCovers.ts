import { Image } from 'expo-image';
import {
  EXPLORE_SHELF_CARD_WIDTH,
  EXPLORE_SHELF_IMAGE_HEIGHT,
} from '../constants/exploreShelfCard';
import { getHotelCoverUrl } from '../lib/hotelUtils';
import type { HotelEstablishment, MonthlyRentalListing, Property } from '../types';
import { getHomeShelfImageUrl, getPropertyCoverUrl } from './media';
import type { LayoutSection } from './exploreCityLayout';

const MAX_PREFETCH = 16;

function shelfUrl(rawUrl: string): string {
  return getHomeShelfImageUrl(
    rawUrl,
    EXPLORE_SHELF_CARD_WIDTH,
    EXPLORE_SHELF_IMAGE_HEIGHT,
  );
}

function prefetchUrls(urls: string[]): void {
  const unique = Array.from(
    new Set(
      urls
        .filter((url) => url && !url.includes('placeholder'))
        .map(shelfUrl),
    ),
  ).slice(0, MAX_PREFETCH);

  if (unique.length > 0) {
    void Image.prefetch(unique, 'memory-disk');
  }
}

export function prefetchPropertyShelfCovers(properties: Property[]): void {
  prefetchUrls(properties.map((property) => getPropertyCoverUrl(property)));
}

export function prefetchHotelShelfCovers(hotels: HotelEstablishment[]): void {
  prefetchUrls(hotels.map((hotel) => getHotelCoverUrl(hotel)));
}

export function prefetchMonthlyShelfCovers(listings: MonthlyRentalListing[]): void {
  prefetchUrls(
    listings.map((listing) =>
      Array.isArray(listing.images) && listing.images.length > 0
        ? listing.images[0]
        : '',
    ),
  );
}

export function prefetchExploreHomeSectionCovers(
  sections: LayoutSection<Property>[],
): void {
  const properties: Property[] = [];
  for (const section of sections) {
    if (section.kind === 'large') {
      properties.push(...section.group.properties);
    } else {
      for (const group of section.groups) {
        properties.push(...group.properties);
      }
    }
  }
  prefetchPropertyShelfCovers(properties);
}
