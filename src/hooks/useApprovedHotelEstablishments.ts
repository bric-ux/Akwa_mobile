import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { resolveLocationIdsForSearchTerm } from '../lib/resolveSearchLocations';

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
        let query = supabase
          .from('hotel_establishments')
          .select(
            'id, title, description, address, establishment_type, star_rating, rating, review_count, images, amenities, location_id, latitude, longitude, status, hide_from_home, created_at, updated_at',
          )
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

        const city = filters?.city?.trim();
        if (city) {
          const resolved = await resolveLocationIdsForSearchTerm(city, {
            centerLat: filters?.centerLat,
            centerLng: filters?.centerLng,
            radiusKm: filters?.radiusKm,
          });
          const nameTerms = [city, ...(resolved.locationNames || [])]
            .map((n) => n.trim())
            .filter(Boolean)
            .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
            .slice(0, 8);

          if (resolved.locationIds && resolved.locationIds.length > 0) {
            const orParts = [
              `location_id.in.(${resolved.locationIds.join(',')})`,
              ...nameTerms.map((n) => `address.ilike.%${n}%`),
              ...nameTerms.map((n) => `title.ilike.%${n}%`),
            ];
            query = query.or(orParts.join(','));
          } else if (nameTerms.length > 0) {
            query = query.or(
              nameTerms
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
        const result = (data || []) as HotelEstablishmentPublic[];
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
