import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { MonthlyRentalListingPayment } from '../types';

const AMOUNT_FCFA = 200;

export const useMonthlyRentalPayments = (ownerId: string | undefined) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const uid = ownerId || user?.id;

  const getByOwner = useCallback(async (): Promise<MonthlyRentalListingPayment[]> => {
    if (!uid) return [];
    const { data, err } = await supabase
      .from('monthly_rental_listing_payments')
      .select('*')
      .eq('owner_id', uid)
      .order('created_at', { ascending: false });
    if (err) return [];
    return (data || []) as MonthlyRentalListingPayment[];
  }, [uid]);

  const getForListing = useCallback(
    async (listingId: string): Promise<MonthlyRentalListingPayment | null> => {
      if (!uid) return null;
      const { data, err } = await supabase
        .from('monthly_rental_listing_payments')
        .select('*')
        .eq('listing_id', listingId)
        .eq('owner_id', uid)
        .maybeSingle();
      if (err || !data) return null;
      return data as MonthlyRentalListingPayment;
    },
    [uid]
  );

  const hasCompletedPaymentForListing = useCallback(
    async (listingId: string): Promise<boolean> => {
      const p = await getForListing(listingId);
      return p?.status === 'completed';
    },
    [getForListing]
  );

  const createPayment = useCallback(
    async (listingId: string): Promise<{ success: boolean; paymentId?: string; error?: string }> => {
      if (!uid) return { success: false, error: 'Non connecté' };
      setLoading(true);
      setError(null);
      try {
        const { data, err } = await supabase
          .from('monthly_rental_listing_payments')
          .insert({
            owner_id: uid,
            listing_id: listingId,
            amount_fcfa: AMOUNT_FCFA,
            status: 'pending',
          })
          .select('id')
          .single();
        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }
        return { success: true, paymentId: data?.id };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [uid]
  );

  const markCompleted = useCallback(
    async (paymentId: string, externalId?: string): Promise<{ success: boolean; error?: string }> => {
      if (!uid) return { success: false, error: 'Non connecté' };
      setLoading(true);
      setError(null);
      try {
        const { err } = await supabase
          .from('monthly_rental_listing_payments')
          .update({
            status: 'completed',
            paid_at: new Date().toISOString(),
            ...(externalId != null && { external_id: externalId }),
          })
          .eq('id', paymentId)
          .eq('owner_id', uid);
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
    [uid]
  );

  return {
    amountFcfa: AMOUNT_FCFA,
    getByOwner,
    getForListing,
    hasCompletedPaymentForListing,
    createPayment,
    markCompleted,
    loading,
    error,
  };
};
