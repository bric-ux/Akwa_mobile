import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { MonthlyRentalListing } from '../types';
import { resolveLocationIdsForSearchTerm } from '../lib/resolveSearchLocations';
import { calculateDistance } from '../utils/distance';

export interface ApprovedMonthlyFilters {
  city?: string;
  location?: string;
  /** Minimum de chambres */
  bedrooms?: number;
  /** true = meublé, false = non meublé, undefined = tous */
  isFurnished?: boolean;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

const DEFAULT_PLACE_RADIUS_KM = 25;

function debugMonthlyLog(tag: string, payload?: Record<string, unknown>) {
  if (payload !== undefined) {
    console.log(`🔎 [monthly] ${tag}`, payload);
  } else {
    console.log(`🔎 [monthly] ${tag}`);
  }
}

function listingCoords(l: MonthlyRentalListing): { lat: number; lng: number } | null {
  const lat = l.latitude != null ? Number(l.latitude) : NaN;
  const lng = l.longitude != null ? Number(l.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Hook pour récupérer les annonces bail longue durée approuvées (côté voyageur, public). */
export const useApprovedMonthlyRentalListings = () => {
  const [listings, setListings] = useState<MonthlyRentalListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(
    async (filters?: ApprovedMonthlyFilters): Promise<MonthlyRentalListing[]> => {
      setLoading(true);
      setError(null);
      try {
        const city = (filters?.city ?? filters?.location)?.trim();
        let centerLat =
          filters?.centerLat != null && Number.isFinite(Number(filters.centerLat))
            ? Number(filters.centerLat)
            : undefined;
        let centerLng =
          filters?.centerLng != null && Number.isFinite(Number(filters.centerLng))
            ? Number(filters.centerLng)
            : undefined;
        let mergeRadius =
          filters?.radiusKm != null && filters.radiusKm > 0
            ? filters.radiusKm
            : DEFAULT_PLACE_RADIUS_KM;

        let query = supabase
          .from('monthly_rental_listings')
          .select('*')
          .eq('status', 'approved')
          .eq('hidden_by_admin', false)
          .order('updated_at', { ascending: false });

        if (city) {
          debugMonthlyLog('début', {
            city,
            filtersCenter: { lat: centerLat ?? null, lng: centerLng ?? null },
            radiusKm: filters?.radiusKm ?? null,
          });

          const resolved = await resolveLocationIdsForSearchTerm(city, {
            centerLat,
            centerLng,
            radiusKm: filters?.radiusKm,
          });

          if (resolved.centerLat != null && resolved.centerLng != null) {
            centerLat = resolved.centerLat;
            centerLng = resolved.centerLng;
          }
          if (!(filters?.radiusKm != null && filters.radiusKm > 0)) {
            mergeRadius = DEFAULT_PLACE_RADIUS_KM;
          }

          debugMonthlyLog('après resolve', {
            locationIdsCount: resolved.locationIds?.length ?? 0,
            soft: resolved.geoSoftMatch,
            center: { lat: centerLat ?? null, lng: centerLng ?? null },
            mergeRadius,
            names: resolved.locationNames,
          });

          // Centre manquant → géocode (Faya près de Cocody, etc.)
          if (centerLat == null || centerLng == null) {
            try {
              const { forwardGeocodeNominatim } = await import('../lib/geolocation');
              const hits = await forwardGeocodeNominatim(`${city}, Côte d'Ivoire`);
              if (hits?.[0]) {
                centerLat = hits[0].latitude;
                centerLng = hits[0].longitude;
                debugMonthlyLog('centre via Nominatim', {
                  lat: centerLat,
                  lng: centerLng,
                });
              }
            } catch (e) {
              console.warn('🔎 [monthly] géocode centre:', e);
            }
          }

          const nameTerms = [city, ...(resolved.locationNames || [])]
            .map((n) => n.trim())
            .filter(Boolean)
            .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
            .slice(0, 8);

          if (resolved.locationIds && resolved.locationIds.length > 0) {
            const orParts = [
              `location_id.in.(${resolved.locationIds.join(',')})`,
              ...nameTerms.map((n) => `location.ilike.%${n}%`),
            ];
            query = query.or(orParts.join(','));
          } else if (nameTerms.length > 0) {
            query = query.or(nameTerms.map((n) => `location.ilike.%${n}%`).join(','));
          } else {
            query = query.ilike('location', `%${city}%`);
          }
        }

        if (filters?.bedrooms && filters.bedrooms > 0) {
          query = query.gte('bedrooms', filters.bedrooms);
        }

        if (filters?.isFurnished === true) {
          query = query.eq('is_furnished', true);
        } else if (filters?.isFurnished === false) {
          query = query.eq('is_furnished', false);
        }

        const { data, error: err } = await query;

        if (err) {
          setError(err.message);
          debugMonthlyLog('erreur query primaire', { error: err.message });
          return [];
        }

        let result = (data || []) as MonthlyRentalListing[];
        debugMonthlyLog('après query location', {
          count: result.length,
          sample: result.slice(0, 5).map((l) => ({
            title: l.title,
            location: l.location,
            lat: l.latitude,
            lng: l.longitude,
          })),
        });

        // Proximité géo : annonces proches hors arbre location_id (ex. Faya près de Cocody)
        if (city && centerLat != null && centerLng != null) {
          const latDelta = mergeRadius / 111;
          const cosLat = Math.cos((centerLat * Math.PI) / 180);
          const lngDelta = mergeRadius / (111 * Math.max(0.2, Math.abs(cosLat)));
          const bbox = {
            latMin: centerLat - latDelta,
            latMax: centerLat + latDelta,
            lngMin: centerLng - lngDelta,
            lngMax: centerLng + lngDelta,
          };

          debugMonthlyLog('proximité bbox', {
            mergeRadius,
            center: { lat: centerLat, lng: centerLng },
            bbox,
          });

          let nearbyQuery = supabase
            .from('monthly_rental_listings')
            .select('*')
            .eq('status', 'approved')
            .eq('hidden_by_admin', false)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .gte('latitude', bbox.latMin)
            .lte('latitude', bbox.latMax)
            .gte('longitude', bbox.lngMin)
            .lte('longitude', bbox.lngMax)
            .limit(150);

          if (filters?.bedrooms && filters.bedrooms > 0) {
            nearbyQuery = nearbyQuery.gte('bedrooms', filters.bedrooms);
          }
          if (filters?.isFurnished === true) {
            nearbyQuery = nearbyQuery.eq('is_furnished', true);
          } else if (filters?.isFurnished === false) {
            nearbyQuery = nearbyQuery.eq('is_furnished', false);
          }

          const { data: nearbyData, error: nearbyErr } = await nearbyQuery;
          debugMonthlyLog('proximité réponse DB', {
            error: nearbyErr?.message ?? null,
            nearbyCount: nearbyData?.length ?? 0,
            sample: (nearbyData || []).slice(0, 8).map((l: any) => ({
              title: l.title,
              location: l.location,
              lat: l.latitude,
              lng: l.longitude,
            })),
          });

          if (!nearbyErr && nearbyData?.length) {
            const byId = new Map(result.map((l) => [l.id, l]));
            let added = 0;
            let skippedFar = 0;
            for (const row of nearbyData as MonthlyRentalListing[]) {
              if (byId.has(row.id)) continue;
              const coords = listingCoords(row);
              if (!coords) continue;
              const d = calculateDistance(centerLat, centerLng, coords.lat, coords.lng);
              if (d <= mergeRadius) {
                byId.set(row.id, row);
                added++;
              } else {
                skippedFar++;
              }
            }
            result = Array.from(byId.values());
            debugMonthlyLog('après merge proximité', {
              added,
              skippedFar,
              total: result.length,
            });
          } else if (nearbyErr) {
            console.warn('🔎 [monthly] proximité:', nearbyErr.message);
          } else {
            debugMonthlyLog('proximité: 0 ligne dans la bbox');
          }

          // Tri par distance quand on a un centre
          result = [...result].sort((a, b) => {
            const ca = listingCoords(a);
            const cb = listingCoords(b);
            const da =
              ca != null
                ? calculateDistance(centerLat!, centerLng!, ca.lat, ca.lng)
                : Number.POSITIVE_INFINITY;
            const db =
              cb != null
                ? calculateDistance(centerLat!, centerLng!, cb.lat, cb.lng)
                : Number.POSITIVE_INFINITY;
            return da - db;
          });
        } else if (city) {
          debugMonthlyLog('proximité NON exécutée', {
            reason: 'pas de centre lat/lng',
            primaryCount: result.length,
          });
        }

        debugMonthlyLog('RÉSULTAT FINAL', {
          count: result.length,
          titles: result.slice(0, 15).map((l) => l.title),
        });

        setListings(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        debugMonthlyLog('exception', { error: msg });
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { listings, loading, error, fetchListings };
};
