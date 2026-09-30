import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { MonthlyRentalCandidature, MonthlyRentalCandidatureStatus } from '../types';
import {
  notifyMonthlyCandidatureStatusChange,
  notifyMonthlyCandidatureSubmitted,
} from '../services/monthlyCandidatureNotifications';

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

  const getByTenantId = useCallback(async (): Promise<
    (MonthlyRentalCandidature & { listing_title?: string; listing_location?: string })[]
  > => {
    if (!user) return [];

    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('monthly_rental_candidatures')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
        return [];
      }

      const candidatures = (data || []) as MonthlyRentalCandidature[];
      if (candidatures.length === 0) return [];

      const listingIds = [...new Set(candidatures.map((c) => c.listing_id))];
      const { data: listings } = await supabase
        .from('monthly_rental_listings')
        .select('id, title, location')
        .in('id', listingIds);

      const byId = Object.fromEntries((listings || []).map((l) => [l.id, l]));
      return candidatures.map((c) => ({
        ...c,
        listing_title: byId[c.listing_id]?.title,
        listing_location: byId[c.listing_id]?.location,
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

        const { data: inserted, error: err } = await supabase
          .from('monthly_rental_candidatures')
          .insert({
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
          })
          .select('id')
          .single();

        if (err) {
          const msg =
            err.code === '23505'
              ? 'Vous avez déjà postulé pour cette annonce.'
              : err.message;
          setError(msg);
          return { success: false, error: msg };
        }

        if (inserted?.id) {
          notifyMonthlyCandidatureSubmitted({
            listingId: input.listing_id,
            tenantId: user.id,
            tenantName: input.full_name.trim(),
            tenantEmail: input.email.trim(),
            candidatureId: inserted.id,
          }).catch(() => {});
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
      status: MonthlyRentalCandidatureStatus,
      extra?: {
        requested_documents?: string[];
        visit_authorized_at?: string;
        docs_requested_at?: string;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Non connecté' };

      setLoading(true);
      setError(null);
      try {
        const { data: candidature, error: fetchErr } = await supabase
          .from('monthly_rental_candidatures')
          .select('id, listing_id, tenant_id, full_name, email')
          .eq('id', candidatureId)
          .maybeSingle();

        if (fetchErr) {
          setError(fetchErr.message);
          return { success: false, error: fetchErr.message };
        }

        const patch: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (status === 'accepted' || status === 'rejected') {
          patch.decided_at = new Date().toISOString();
        }
        if (extra?.requested_documents) patch.requested_documents = extra.requested_documents;
        if (extra?.visit_authorized_at) patch.visit_authorized_at = extra.visit_authorized_at;
        if (extra?.docs_requested_at) patch.docs_requested_at = extra.docs_requested_at;

        const { error: err } = await supabase
          .from('monthly_rental_candidatures')
          .update(patch)
          .eq('id', candidatureId);

        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }

        if (
          candidature?.tenant_id &&
          candidature.listing_id &&
          (status === 'accepted' || status === 'rejected')
        ) {
          notifyMonthlyCandidatureStatusChange({
            listingId: candidature.listing_id,
            tenantId: candidature.tenant_id,
            tenantName: candidature.full_name || 'Candidat',
            tenantEmail: candidature.email || '',
            status,
          }).catch(() => {});
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

  const authorizeVisit = useCallback(
    (id: string) =>
      updateStatus(id, 'visit_authorized', {
        visit_authorized_at: new Date().toISOString(),
      }),
    [updateStatus],
  );

  const requestDocuments = useCallback(
    (id: string, docs: string[]) =>
      updateStatus(id, 'docs_requested', {
        requested_documents: docs,
        docs_requested_at: new Date().toISOString(),
      }),
    [updateStatus],
  );

  const appendDocuments = useCallback(
    async (
      candidatureId: string,
      docs: { type: string; url: string; name: string }[],
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Non connecté' };
      if (!docs.length) return { success: false, error: 'Aucun document' };
      setLoading(true);
      setError(null);
      try {
        const { data: current, error: fetchErr } = await supabase
          .from('monthly_rental_candidatures')
          .select('application_documents, status')
          .eq('id', candidatureId)
          .eq('tenant_id', user.id)
          .maybeSingle();
        if (fetchErr || !current) {
          const msg = fetchErr?.message || 'Candidature introuvable';
          setError(msg);
          return { success: false, error: msg };
        }
        const prev = Array.isArray(current.application_documents)
          ? current.application_documents
          : [];
        const { error: err } = await supabase
          .from('monthly_rental_candidatures')
          .update({
            application_documents: [...prev, ...docs],
            status: current.status === 'docs_requested' ? 'viewed' : current.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidatureId)
          .eq('tenant_id', user.id);
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

  /** Passe les candidatures « envoyées » en « vues » quand le proprio ouvre la liste. */
  const markSentAsViewed = useCallback(
    async (listingId: string): Promise<void> => {
      if (!user || !listingId) return;
      try {
        await supabase
          .from('monthly_rental_candidatures')
          .update({
            status: 'viewed',
            updated_at: new Date().toISOString(),
          })
          .eq('listing_id', listingId)
          .eq('status', 'sent');
      } catch {
        /* non bloquant */
      }
    },
    [user],
  );

  /** Supprime définitivement une demande (propriétaire). */
  const deleteCandidature = useCallback(
    async (candidatureId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Non connecté' };
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('monthly_rental_candidatures')
          .delete()
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
    getByTenantId,
    getMyCandidatureForListing,
    submitCandidature,
    markSentAsViewed,
    authorizeVisit,
    requestDocuments,
    appendDocuments,
    acceptCandidature: (id: string) => updateStatus(id, 'accepted'),
    rejectCandidature: (id: string) => updateStatus(id, 'rejected'),
    deleteCandidature,
    loading,
    error,
  };
};
