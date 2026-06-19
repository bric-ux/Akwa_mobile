import type { ExploreCitySection } from '../hooks/useExploreCityHome';
import type { HotelEstablishment, MonthlyRentalListing, Property } from '../types';
import type { HomeCategoryId } from '../types/homeCategory';
import { getHotelCoverUrl } from '../lib/hotelUtils';
import { getPropertyCoverUrl } from './media';
import { getCachedHotels, getCachedMonthly, getCachedProperties, monthlyCatalogKey, propertyCatalogKey } from '../services/searchCatalogCache';

function normalizeLabel(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function collectExploreProperties(sections: ExploreCitySection[] | undefined): Property[] {
  const items: Property[] = [];
  for (const section of sections ?? []) {
    if (section.kind === 'large') {
      items.push(...(section.group?.properties ?? []));
    } else {
      for (const group of section.groups ?? []) {
        items.push(...(group.properties ?? []));
      }
    }
  }
  return items;
}

function mergeUniqueHotels(...lists: (HotelEstablishment[] | null | undefined)[]): HotelEstablishment[] {
  const seen = new Set<string>();
  const merged: HotelEstablishment[] = [];
  for (const list of lists) {
    for (const hotel of list ?? []) {
      if (seen.has(hotel.id)) continue;
      seen.add(hotel.id);
      merged.push(hotel);
    }
  }
  return merged;
}

function findPreferredHotel(hotels: HotelEstablishment[]): HotelEstablishment | undefined {
  const allHotels = mergeUniqueHotels(hotels, getCachedHotels() ?? []);
  const rivieraCocody = allHotels.find((hotel) => {
    const title = normalizeLabel(hotel.title);
    const slug = normalizeLabel(hotel.slug ?? '');
    const combined = `${title} ${slug}`;
    const isRiviera = combined.includes('riviera');
    const isCocody = combined.includes('cocody') || combined.includes('coocdy');
    return isRiviera && isCocody;
  });
  if (rivieraCocody) return rivieraCocody;

  return (
    allHotels.find((hotel) => normalizeLabel(`${hotel.title} ${hotel.slug ?? ''}`).includes('riviera-test')) ??
    allHotels[0]
  );
}

export function buildHomeCategoryPillImages(input: {
  exploreSections?: ExploreCitySection[];
  exploreHotels?: HotelEstablishment[];
  exploreMonthlyListings?: MonthlyRentalListing[];
}): Partial<Record<HomeCategoryId, string>> {
  const images: Partial<Record<HomeCategoryId, string>> = {};

  const preferredHotel = findPreferredHotel(input.exploreHotels ?? []);
  if (preferredHotel) {
    const url = getHotelCoverUrl(preferredHotel);
    if (url && !url.includes('placeholder')) {
      images.hotel = url;
    }
  }

  const cachedResidences =
    getCachedProperties(
      propertyCatalogKey('search', { rentalType: 'short_term', accommodationType: 'property' }),
    ) ?? [];

  const firstResidence = collectExploreProperties(input.exploreSections)[0] ?? cachedResidences[0];
  if (firstResidence) {
    const url = getPropertyCoverUrl(firstResidence);
    if (url && !url.includes('placeholder')) {
      images.residence = url;
    }
  }

  const firstMonthly =
    input.exploreMonthlyListings?.[0] ?? getCachedMonthly(monthlyCatalogKey({}))?.[0];
  if (firstMonthly?.images?.[0]) {
    images.monthly = firstMonthly.images[0];
  }

  return images;
}
