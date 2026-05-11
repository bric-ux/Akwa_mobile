import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import type { Property, SearchFilters } from '../types';
import { getPricesForDateBatch } from '../utils/priceCalculator';
import { getAmenityIcon } from '../utils/amenityIcons';
import { logError } from '../utils/logger';
import { getPublicPropertyListVersion } from '../utils/publicPropertyListVersion';
import {
  buildLayoutSections,
  cityLabel,
  type CityGroup,
  type LayoutSection,
  MAX_CITY_SECTIONS,
  MIN_PER_CITY,
  PER_CITY_LIMIT,
} from '../utils/exploreCityLayout';

const EXPLORE_HOME_CACHE_TTL_MS = 2 * 60 * 1000;
let exploreHomeCache: {
  sections: ExploreCitySection[];
  at: number;
} | null = null;

function getRefDateStrForListPricing(filters?: SearchFilters): string {
  if (filters?.checkIn) {
    const ci = filters.checkIn as string | Date;
    if (typeof ci === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ci)) return ci;
    const d = new Date(ci);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

async function calculateRatingsFromReviewsBatch(
  propertyIds: string[],
): Promise<Map<string, { rating: number; review_count: number }>> {
  if (propertyIds.length === 0) return new Map();
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('property_id, rating, approved')
      .in('property_id', propertyIds)
      .eq('approved', true);

    if (error) {
      const result = new Map<string, { rating: number; review_count: number }>();
      propertyIds.forEach((id) => result.set(id, { rating: 0, review_count: 0 }));
      return result;
    }

    const ratingsMap = new Map<string, { rating: number; review_count: number }>();
    propertyIds.forEach((id) => ratingsMap.set(id, { rating: 0, review_count: 0 }));

    const reviewsByProperty = new Map<string, number[]>();
    (reviews || []).forEach((review) => {
      if (!reviewsByProperty.has(review.property_id)) {
        reviewsByProperty.set(review.property_id, []);
      }
      reviewsByProperty.get(review.property_id)!.push(review.rating);
    });

    reviewsByProperty.forEach((ratings, propertyId) => {
      const reviewCount = ratings.length;
      const rating =
        reviewCount > 0 ? ratings.reduce((sum, r) => sum + r, 0) / reviewCount : 0;
      ratingsMap.set(propertyId, {
        rating: Math.round(rating * 100) / 100,
        review_count: reviewCount,
      });
    });

    return ratingsMap;
  } catch {
    const result = new Map<string, { rating: number; review_count: number }>();
    propertyIds.forEach((id) => result.set(id, { rating: 0, review_count: 0 }));
    return result;
  }
}

let amenitiesLookupPromise: Promise<Map<string, { id: string; name: string; icon: string }>> | null = null;

async function loadAmenitiesLookup(): Promise<Map<string, { id: string; name: string; icon: string }>> {
  if (!amenitiesLookupPromise) {
    amenitiesLookupPromise = (async () => {
      const map = new Map<string, { id: string; name: string; icon: string }>();
      try {
        const { data: amenities, error } = await supabase.from('property_amenities').select('id, name');
        if (error || !amenities) return map;
        amenities.forEach((amenity) => {
          map.set(amenity.id, {
            id: amenity.id,
            name: amenity.name,
            icon: getAmenityIcon(amenity.name),
          });
          map.set(amenity.name.toLowerCase(), {
            id: amenity.id,
            name: amenity.name,
            icon: getAmenityIcon(amenity.name),
          });
        });
      } catch (e) {
        logError('[useExploreCityHome] amenities lookup', e);
      }
      return map;
    })();
  }
  return amenitiesLookupPromise;
}

async function mapAmenitiesFromLookup(
  lookup: Map<string, { id: string; name: string; icon: string }>,
  amenityIdsOrNames: string[] | null,
): Promise<{ id: string; name: string; icon: string }[]> {
  if (!amenityIdsOrNames || !Array.isArray(amenityIdsOrNames) || amenityIdsOrNames.length === 0) {
    return [];
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return amenityIdsOrNames
    .map((idOrName) => {
      if (uuidRegex.test(idOrName)) {
        return lookup.get(idOrName) ?? null;
      }
      const cachedByName = lookup.get(idOrName.toLowerCase());
      if (cachedByName) return cachedByName;
      const amenity = Array.from(lookup.values()).find(
        (a) => a.name.toLowerCase() === idOrName.toLowerCase(),
      );
      if (amenity) return amenity;
      const trimmed = idOrName.trim();
      if (!trimmed) return null;
      return { id: `name-${trimmed}`, name: trimmed, icon: getAmenityIcon(trimmed) };
    })
    .filter(Boolean) as { id: string; name: string; icon: string }[];
}

async function transformRowsToProperties(rows: any[]): Promise<Property[]> {
  if (rows.length === 0) return [];
  const lookup = await loadAmenitiesLookup();
  const propertyIds = rows.map((p) => p.id);
  const ratingsMap = await calculateRatingsFromReviewsBatch(propertyIds);

  const transformed = await Promise.all(
    rows.map(async (property) => {
      const mappedAmenities = await mapAmenitiesFromLookup(lookup, property.amenities);
      const customAmenitiesList =
        property.custom_amenities && Array.isArray(property.custom_amenities)
          ? property.custom_amenities.map((name: string) => ({
              id: `custom-${name}`,
              name: name.trim(),
              icon: '➕',
            }))
          : [];
      const allAmenities = [...mappedAmenities, ...customAmenitiesList];

      const calculatedRating = ratingsMap.get(property.id) || { rating: 0, review_count: 0 };
      const finalRating = calculatedRating.rating || property.rating || 0;
      const finalReviewCount = calculatedRating.review_count || property.review_count || 0;

      const categorizedPhotos = property.property_photos || [];
      const sortedPhotos = categorizedPhotos.sort(
        (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0),
      );
      const imageUrls = sortedPhotos.map((photo: any) => photo.url);
      const fallbackImages = property.images || [];
      const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;

      const location = (property as any).locations;
      const latitude = location?.latitude || property.latitude;
      const longitude = location?.longitude || property.longitude;

      return {
        ...property,
        images: finalImages,
        photos: sortedPhotos,
        price_per_night: property.price_per_night || 0,
        rating: Math.round(finalRating * 100) / 100,
        review_count: finalReviewCount,
        amenities: allAmenities,
        custom_amenities: property.custom_amenities || [],
        house_rules: property.house_rules || '',
        check_in_time: property.check_in_time || null,
        check_out_time: property.check_out_time || null,
        address_details: property.address_details || '',
        host_guide: property.host_guide || '',
        discount_enabled: property.discount_enabled || false,
        discount_min_nights: property.discount_min_nights || null,
        discount_percentage: property.discount_percentage || null,
        long_stay_discount_enabled: property.long_stay_discount_enabled || false,
        long_stay_discount_min_nights: property.long_stay_discount_min_nights || null,
        long_stay_discount_percentage: property.long_stay_discount_percentage || null,
        location: location
          ? {
              id: location.id,
              name: location.name,
              type: location.type,
              latitude: location.latitude,
              longitude: location.longitude,
              parent_id: location.parent_id,
            }
          : undefined,
        latitude,
        longitude,
        locations: location,
      } as Property;
    }),
  );

  const refDate = getRefDateStrForListPricing(undefined);
  const baseMap = new Map(transformed.map((p) => [p.id, p.price_per_night || 0]));
  const priceMap = await getPricesForDateBatch(
    transformed.map((p) => p.id),
    refDate,
    baseMap,
  );

  return transformed.map((p) => ({
    ...p,
    dynamic_price_today: priceMap.get(p.id) ?? p.price_per_night,
  }));
}

export type ExploreCitySection = LayoutSection<Property>;

function mapAmenitiesFast(
  lookup: Map<string, { id: string; name: string; icon: string }>,
  amenityIdsOrNames: string[] | null,
): { id: string; name: string; icon: string }[] {
  if (!amenityIdsOrNames || !Array.isArray(amenityIdsOrNames) || amenityIdsOrNames.length === 0) {
    return [];
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return amenityIdsOrNames
    .map((idOrName) => {
      if (uuidRegex.test(idOrName)) {
        return lookup.get(idOrName) ?? null;
      }
      const cachedByName = lookup.get(idOrName.toLowerCase());
      if (cachedByName) return cachedByName;
      const trimmed = idOrName.trim();
      if (!trimmed) return null;
      return { id: `name-${trimmed}`, name: trimmed, icon: getAmenityIcon(trimmed) };
    })
    .filter(Boolean) as { id: string; name: string; icon: string }[];
}

async function transformRowsToPropertiesLight(rows: any[]): Promise<Property[]> {
  if (rows.length === 0) return [];
  const lookup = await loadAmenitiesLookup();
  return rows.map((property) => {
    const mappedAmenities = mapAmenitiesFast(lookup, property.amenities);
    const customAmenitiesList =
      property.custom_amenities && Array.isArray(property.custom_amenities)
        ? property.custom_amenities.map((name: string) => ({
            id: `custom-${name}`,
            name: name.trim(),
            icon: '➕',
          }))
        : [];
    const allAmenities = [...mappedAmenities, ...customAmenitiesList];

    const categorizedPhotos = property.property_photos || [];
    const sortedPhotos = categorizedPhotos.sort(
      (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0),
    );
    const imageUrls = sortedPhotos.map((photo: any) => photo.url);
    const fallbackImages = property.images || [];
    const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;

    const location = (property as any).locations;
    const latitude = location?.latitude || property.latitude;
    const longitude = location?.longitude || property.longitude;

    return {
      ...property,
      images: finalImages,
      photos: sortedPhotos,
      price_per_night: property.price_per_night || 0,
      dynamic_price_today: property.price_per_night || 0,
      rating: Math.round((property.rating || 0) * 100) / 100,
      review_count: property.review_count || 0,
      amenities: allAmenities,
      custom_amenities: property.custom_amenities || [],
      house_rules: property.house_rules || '',
      check_in_time: property.check_in_time || null,
      check_out_time: property.check_out_time || null,
      address_details: property.address_details || '',
      host_guide: property.host_guide || '',
      discount_enabled: property.discount_enabled || false,
      discount_min_nights: property.discount_min_nights || null,
      discount_percentage: property.discount_percentage || null,
      long_stay_discount_enabled: property.long_stay_discount_enabled || false,
      long_stay_discount_min_nights: property.long_stay_discount_min_nights || null,
      long_stay_discount_percentage: property.long_stay_discount_percentage || null,
      location: location
        ? {
            id: location.id,
            name: location.name,
            type: location.type,
            latitude: location.latitude,
            longitude: location.longitude,
            parent_id: location.parent_id,
          }
        : undefined,
      latitude,
      longitude,
      locations: location,
    } as Property;
  });
}

export function useExploreCityHome() {
  const [layoutSections, setLayoutSections] = useState<ExploreCitySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastHandledCatalogVersionRef = useRef<number | null>(null);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    try {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      const { data: countsData, error: countsError } = await supabase
        .from('properties')
        .select('city_slug')
        .eq('is_active', true)
        .eq('is_hidden', false)
        .eq('hide_from_home', false)
        .not('city_slug', 'is', null)
        .neq('property_type', 'long_term_rental');

      if (countsError || !countsData) {
        setLayoutSections([]);
        setLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      for (const row of countsData as { city_slug: string | null }[]) {
        if (!row.city_slug) continue;
        counts.set(row.city_slug, (counts.get(row.city_slug) || 0) + 1);
      }

      const eligibleCities = Array.from(counts.entries())
        .filter(([, c]) => c >= MIN_PER_CITY)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_CITY_SECTIONS)
        .map(([slug, total]) => ({ slug, total }));

      if (eligibleCities.length === 0) {
        setLayoutSections([]);
        setLoading(false);
        return;
      }

      const SELECT_HOME = `
        *,
        locations:location_id (
          id,
          name,
          type,
          latitude,
          longitude,
          parent_id
        ),
        property_photos (
          id,
          url,
          category,
          display_order,
          is_main,
          created_at
        )
      `;

      const results = await Promise.all(
        eligibleCities.map(async ({ slug, total }) => {
          const { data, error: qErr } = await supabase
            .from('properties')
            .select(SELECT_HOME)
            .eq('city_slug', slug)
            .eq('is_active', true)
            .eq('is_hidden', false)
            .eq('hide_from_home', false)
            .neq('property_type', 'long_term_rental')
            .order('created_at', { ascending: false })
            .limit(PER_CITY_LIMIT);

          if (qErr || !data) return null;

          const officialName = cityLabel(slug);
          return {
            citySlug: slug,
            cityName: officialName,
            totalCount: total,
            properties: data,
          } as CityGroup<any>;
        }),
      );

      const rawGroups = results.filter((g): g is CityGroup<any> => g !== null);

      const byId = new Map<string, any>();
      for (const g of rawGroups) {
        for (const p of g.properties) {
          if (!byId.has(p.id)) byId.set(p.id, p);
        }
      }
      const uniqueRows = Array.from(byId.values());
      const lightList = await transformRowsToPropertiesLight(uniqueRows);
      const lightById = new Map(lightList.map((p) => [p.id, p]));
      const lightGroups: CityGroup<Property>[] = rawGroups.map((g) => ({
        ...g,
        properties: g.properties
          .map((raw) => lightById.get(raw.id))
          .filter(Boolean) as Property[],
      }));
      const lightSections = buildLayoutSections(lightGroups);
      setLayoutSections(lightSections);
      exploreHomeCache = { sections: lightSections, at: Date.now() };

      // Enrichissement différé (prix dynamiques + ratings batch) sans bloquer l'affichage initial.
      const enrichedList = await transformRowsToProperties(uniqueRows);
      const enrichedById = new Map(enrichedList.map((p) => [p.id, p]));
      const enrichedGroups: CityGroup<Property>[] = rawGroups.map((g) => ({
        ...g,
        properties: g.properties
          .map((raw) => enrichedById.get(raw.id))
          .filter(Boolean) as Property[],
      }));

      const enrichedSections = buildLayoutSections(enrichedGroups);
      setLayoutSections(enrichedSections);
      exploreHomeCache = { sections: enrichedSections, at: Date.now() };
    } catch (e) {
      logError('[useExploreCityHome] load', e);
      setError('Erreur lors du chargement des annonces');
      if (!background) {
        setLayoutSections([]);
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    const hasWarmCache =
      !!exploreHomeCache && now - exploreHomeCache.at < EXPLORE_HOME_CACHE_TTL_MS;
    if (hasWarmCache && exploreHomeCache) {
      setLayoutSections(exploreHomeCache.sections);
      setLoading(false);
      load({ background: true });
      return;
    }
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const v = getPublicPropertyListVersion();
      if (lastHandledCatalogVersionRef.current === null) {
        lastHandledCatalogVersionRef.current = v;
        return;
      }
      if (v > lastHandledCatalogVersionRef.current) {
        lastHandledCatalogVersionRef.current = v;
        load({ background: true });
      }
    }, [load]),
  );

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    layoutSections,
    loading,
    error,
    refreshExploreCityHome: refresh,
  };
}
