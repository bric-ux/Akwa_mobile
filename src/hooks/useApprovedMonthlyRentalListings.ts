import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { MonthlyRentalListing } from '../types';

export interface ApprovedMonthlyFilters {
  city?: string;
  location?: string;
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

        const city = filters?.city ?? filters?.location;
        if (city && city.trim()) {
          query = query.ilike('location', `%${city.trim()}%`);
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
