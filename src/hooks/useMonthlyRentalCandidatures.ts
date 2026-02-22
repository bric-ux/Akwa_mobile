import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { MonthlyRentalCandidature } from '../types';

export const useMonthlyRentalCandidatures = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getByListingId = useCallback(
    async (listingId: string): Promise<MonthlyRentalCandidature[]> => {
      if (!user) return [];

      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('monthly_rental_candidatures')
          .select('*')
          .eq('listing_id', listingId)
          .order('created_at', { ascending: false });

        if (err) {
          setError(err.message);
          return [];
        }
        return (data || []) as MonthlyRentalCandidature[];
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  /** Toutes les candidatures pour les logements du propriétaire (avec titre du logement). */
  const getByOwnerId = useCallback(
    async (): Promise<(MonthlyRentalCandidature & { listing_title?: string })[]> => {
      if (!user) return [];

      setLoading(true);
      setError(null);
      try {
        const { data: listings, error: listErr } = await supabase
          .from('monthly_rental_listings')
          .select('id, title')
          .eq('owner_id', user.id);

        if (listErr || !listings?.length) {
          if (listErr) setError(listErr.message);
          return [];
        }
        const listingIds = listings.map((l) => l.id);
        const { data, error: err } = await supabase
          .from('monthly_rental_candidatures')
          .select('*')
          .in('listing_id', listingIds)
          .order('created_at', { ascending: false });

        if (err) {
          setError(err.message);
          return [];
        }
        const byId = Object.fromEntries(listings.map((l) => [l.id, l.title]));
        return (data || []).map((c) => ({
          ...(c as MonthlyRentalCandidature),
          listing_title: byId[c.listing_id],
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const updateStatus = useCallback(
    async (
      candidatureId: string,
      status: 'accepted' | 'rejected'
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Non connecté' };

      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('monthly_rental_candidatures')
          .update({
            status,
            decided_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidatureId);

        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }
        return { success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return {
    getByListingId,
    getByOwnerId,
    acceptCandidature: (id: string) => updateStatus(id, 'accepted'),
    rejectCandidature: (id: string) => updateStatus(id, 'rejected'),
    loading,
    error,
  };
};
