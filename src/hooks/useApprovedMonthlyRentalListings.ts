import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { MonthlyRentalListing } from '../types';
import {
  getCachedMonthly,
  monthlyCatalogKey,
  setCachedMonthly,
} from '../services/searchCatalogCache';

export interface ApprovedMonthlyFilters {
  city?: string;
  location?: string;
  propertyType?: string;
  priceMin?: number;
  priceMax?: number;
  isFurnished?: boolean;
  chargesIncluded?: boolean;
  minSurfaceM2?: number;
  minBedrooms?: number;
}

/** Hook pour récupérer les annonces location longue durée approuvées (côté voyageur, public). */
export const useApprovedMonthlyRentalListings = () => {
  const [listings, setListings] = useState<MonthlyRentalListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(
    async (filters?: ApprovedMonthlyFilters): Promise<MonthlyRentalListing[]> => {
      const cacheKey = monthlyCatalogKey(filters);
      const cached = getCachedMonthly(cacheKey);
      if (cached) {
        setListings(cached);
        setLoading(false);
        return cached;
      }

      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from('monthly_rental_listings')
          .select('*')
          .eq('status', 'approved')
          .order('updated_at', { ascending: false });

        const city = filters?.city ?? filters?.location;
        if (city && city.trim()) {
          query = query.ilike('location', `%${city.trim()}%`);
        }
        if (filters?.propertyType) {
          query = query.eq('property_type', filters.propertyType);
        }
        if (filters?.priceMin != null) {
          query = query.gte('monthly_rent_price', filters.priceMin);
        }
        if (filters?.priceMax != null) {
          query = query.lte('monthly_rent_price', filters.priceMax);
        }
        if (filters?.isFurnished === true) {
          query = query.eq('is_furnished', true);
        } else if (filters?.isFurnished === false) {
          query = query.eq('is_furnished', false);
        }
        if (filters?.chargesIncluded === true) {
          query = query.eq('charges_included', true);
        }
        if (filters?.minSurfaceM2 != null && filters.minSurfaceM2 > 0) {
          query = query.gte('surface_m2', filters.minSurfaceM2);
        }
        if (filters?.minBedrooms != null && filters.minBedrooms > 0) {
          query = query.gte('bedrooms', filters.minBedrooms);
        }

        const { data, error: err } = await query;

        if (err) {
          setError(err.message);
          return [];
        }
        const result = (data || []) as MonthlyRentalListing[];
        setListings(result);
        setCachedMonthly(cacheKey, result);
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

  return { listings, loading, error, fetchListings };
};
