import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { MonthlyRentalCandidature } from '../types';

export type MonthlyRentalCandidatureInput = {
  listing_id: string;
  full_name: string;
  email: string;
  phone: string;
  message?: string;
  desired_move_in_date?: string;
  duration_months?: number;
  application_documents?: { type: string; url: string; name: string }[];
};

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
    [user],
  );

  const getByOwnerId = useCallback(async (): Promise<
    (MonthlyRentalCandidature & { listing_title?: string })[]
  > => {
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
  }, [user]);

  const getMyCandidatureForListing = useCallback(
    async (listingId: string): Promise<MonthlyRentalCandidature | null> => {
      if (!user) return null;
      const { data, error: err } = await supabase
        .from('monthly_rental_candidatures')
        .select('*')
        .eq('listing_id', listingId)
        .eq('tenant_id', user.id)
        .maybeSingle();
      if (err || !data) return null;
      return data as MonthlyRentalCandidature;
    },
    [user],
  );

  const submitCandidature = useCallback(
    async (
      input: MonthlyRentalCandidatureInput,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Connectez-vous pour postuler' };
      setLoading(true);
      setError(null);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, phone_e164, email')
          .eq('user_id', user.id)
          .maybeSingle();

        const snapshot = {
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          submitted_at: new Date().toISOString(),
        };

        const { error: err } = await supabase.from('monthly_rental_candidatures').insert({
          listing_id: input.listing_id,
          tenant_id: user.id,
          full_name: input.full_name.trim(),
          email: input.email.trim(),
          phone: input.phone.trim(),
          message: input.message?.trim() || null,
          desired_move_in_date: input.desired_move_in_date || null,
          duration_months: input.duration_months ?? null,
          application_documents: input.application_documents || [],
          snapshot,
          status: 'sent',
        });

        if (err) {
          const msg =
            err.code === '23505'
              ? 'Vous avez déjà postulé pour cette annonce.'
              : err.message;
          setError(msg);
          return { success: false, error: msg };
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
    [user],
  );

  const updateStatus = useCallback(
    async (
      candidatureId: string,
      status: 'accepted' | 'rejected',
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
    [user],
  );

  return {
    getByListingId,
    getByOwnerId,
    getMyCandidatureForListing,
    submitCandidature,
    acceptCandidature: (id: string) => updateStatus(id, 'accepted'),
    rejectCandidature: (id: string) => updateStatus(id, 'rejected'),
    loading,
    error,
  };
};
