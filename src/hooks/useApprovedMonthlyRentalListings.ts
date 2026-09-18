import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { MonthlyRentalListing } from '../types';
import { resolveLocationIdsForSearchTerm } from '../lib/resolveSearchLocations';

export interface ApprovedMonthlyFilters {
  city?: string;
  location?: string;
  /** Minimum de chambres */
  bedrooms?: number;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}

/** Hook pour récupérer les annonces location longue durée approuvées (côté voyageur, public). */
export const useApprovedMonthlyRentalListings = () => {
  const [listings, setListings] = useState<MonthlyRentalListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(
    async (filters?: ApprovedMonthlyFilters): Promise<MonthlyRentalListing[]> => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('monthly_rental_listings')
          .select('*')
          .eq('status', 'approved')
          .order('updated_at', { ascending: false });

        const city = (filters?.city ?? filters?.location)?.trim();
        if (city) {
          const resolved = await resolveLocationIdsForSearchTerm(city, {
            centerLat: filters?.centerLat,
            centerLng: filters?.centerLng,
            radiusKm: filters?.radiusKm,
          });

          const nameTerms = [
            city,
            ...(resolved.locationNames || []),
          ]
            .map((n) => n.trim())
            .filter(Boolean)
            .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
            .slice(0, 8);

          if (resolved.locationIds && resolved.locationIds.length > 0) {
            // location_id en base OU texte location correspondant à la zone
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

        const { data, error: err } = await query;

        if (err) {
          setError(err.message);
          return [];
        }
        const result = (data || []) as MonthlyRentalListing[];
        setListings(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { listings, loading, error, fetchListings };
};
