import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
  mergeNearbyHotelEstablishments,
  resolveHotelSearchCenter,
} from '../lib/hotelSearchProximity';

export type HotelEstablishmentPublic = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  establishment_type: string;
  star_rating: number | null;
  rating: number;
  review_count: number;
  images: string[];
  amenities: string[];
  location_id: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  hide_from_home: boolean;
  created_at: string;
  updated_at: string;
};

export type ApprovedHotelFilters = {
  city?: string;
  starRating?: number;
  establishmentType?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  /** Accueil : exclure hide_from_home */
  forHome?: boolean;
};

const SELECT_COLS =
  'id, title, description, address, establishment_type, star_rating, rating, review_count, images, amenities, location_id, latitude, longitude, status, hide_from_home, created_at, updated_at';

/** Catalogue public des établissements hôteliers actifs. */
export const useApprovedHotelEstablishments = () => {
  const [establishments, setEstablishments] = useState<HotelEstablishmentPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstablishments = useCallback(
    async (filters?: ApprovedHotelFilters): Promise<HotelEstablishmentPublic[]> => {
      setLoading(true);
      setError(null);
      try {
        const city = filters?.city?.trim();
        const resolved = city
          ? await resolveHotelSearchCenter({
              city,
              centerLat: filters?.centerLat,
              centerLng: filters?.centerLng,
              radiusKm: filters?.radiusKm,
            })
          : null;

        let query = supabase
          .from('hotel_establishments')
          .select(SELECT_COLS)
          .eq('status', 'active')
          .eq('hidden_by_admin', false)
          .order('updated_at', { ascending: false });

        if (filters?.forHome) {
          query = query.eq('hide_from_home', false);
        }

        if (filters?.starRating && filters.starRating > 0) {
          query = query.gte('star_rating', filters.starRating);
        }

        if (filters?.establishmentType) {
          query = query.eq('establishment_type', filters.establishmentType);
        }

        if (city && resolved) {
          console.log('🔎 [hotel] début établissements', {
            city,
            center: { lat: resolved.centerLat, lng: resolved.centerLng },
            mergeRadius: resolved.mergeRadius,
          });
          if (resolved.locationIds && resolved.locationIds.length > 0) {
            const orParts = [
              `location_id.in.(${resolved.locationIds.join(',')})`,
              ...resolved.nameTerms.map((n) => `address.ilike.%${n}%`),
              ...resolved.nameTerms.map((n) => `title.ilike.%${n}%`),
            ];
            query = query.or(orParts.join(','));
          } else if (resolved.nameTerms.length > 0) {
            query = query.or(
              resolved.nameTerms
                .flatMap((n) => [`address.ilike.%${n}%`, `title.ilike.%${n}%`])
                .join(','),
            );
          } else {
            query = query.or(`address.ilike.%${city}%,title.ilike.%${city}%`);
          }
        }

        const { data, error: err } = await query.limit(60);
        if (err) {
          setError(err.message);
          return [];
        }
        let result = (data || []) as HotelEstablishmentPublic[];

        if (
          city &&
          resolved?.centerLat != null &&
          resolved.centerLng != null
        ) {
          result = await mergeNearbyHotelEstablishments(
            result,
            async (bbox) => {
              let nearbyQuery = supabase
                .from('hotel_establishments')
                .select(SELECT_COLS)
                .eq('status', 'active')
                .eq('hidden_by_admin', false)
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .gte('latitude', bbox.latMin)
                .lte('latitude', bbox.latMax)
                .gte('longitude', bbox.lngMin)
                .lte('longitude', bbox.lngMax)
                .limit(150);
              if (filters?.forHome) {
                nearbyQuery = nearbyQuery.eq('hide_from_home', false);
              }
              if (filters?.starRating && filters.starRating > 0) {
                nearbyQuery = nearbyQuery.gte('star_rating', filters.starRating);
              }
              if (filters?.establishmentType) {
                nearbyQuery = nearbyQuery.eq(
                  'establishment_type',
                  filters.establishmentType,
                );
              }
              const { data: nearby, error: nErr } = await nearbyQuery;
              if (nErr) throw nErr;
              return (nearby || []) as HotelEstablishmentPublic[];
            },
            resolved.centerLat,
            resolved.centerLng,
            resolved.mergeRadius,
          );
        }

        setEstablishments(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { establishments, loading, error, fetchEstablishments };
};
