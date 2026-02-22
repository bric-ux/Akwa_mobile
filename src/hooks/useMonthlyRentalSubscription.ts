import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { MonthlyRentalSubscription } from '../types/monthlyRental';

/**
 * Hook pour l'abonnement location mensuelle.
 * Si la table n'existe pas encore, retourne des listes vides (aucun crash).
 */
export function useMonthlyRentalSubscription(hostId: string | undefined) {
  const [subscriptions, setSubscriptions] = useState<MonthlyRentalSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    if (!hostId) {
      setSubscriptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('monthly_rental_subscriptions')
        .select(`
          id,
          host_id,
          property_id,
          status,
          plan_type,
          monthly_price,
          start_date,
          end_date,
          next_billing_date,
          auto_renew,
          trial_end_date,
          created_at,
          updated_at,
          property:properties(id, title)
        `)
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });

      if (err) {
        if (err.code === '42P01') {
          setSubscriptions([]);
          return;
        }
        throw err;
      }
      setSubscriptions((data as MonthlyRentalSubscription[]) || []);
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement abonnements');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const hasActiveSubscriptionForProperty = useCallback(
    (propertyId: string) => activeSubscriptions.some(s => s.property_id === propertyId),
    [activeSubscriptions]
  );

  return {
    subscriptions,
    activeSubscriptions,
    loading,
    error,
    refetch: fetchSubscriptions,
    hasActiveSubscriptionForProperty,
    activeCount: activeSubscriptions.length,
  };
}
