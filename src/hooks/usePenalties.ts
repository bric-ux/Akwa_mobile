import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface Penalty {
  id: string;
  booking_id: string;
  host_id: string;
  guest_id: string;
  penalty_amount: number;
  penalty_type: string;
  status: 'pending' | 'deducted' | 'waived' | 'collected_manually' | 'paid_directly';
  deducted_at?: string | null;
  waived_reason?: string | null;
  admin_notes?: string | null;
  created_at: string;
  booking?: {
    id: string;
    check_in_date?: string;
    check_out_date?: string;
    total_price?: number;
    guests_count?: number;
    status?: string;
    cancellation_reason?: string;
    property?: {
      title: string;
      address?: string;
      price_per_night?: number;
    } | null;
    guest?: {
      first_name?: string;
      last_name?: string;
      email?: string;
    } | null;
  } | null;
}

export const usePenalties = (userId?: string) => {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPenalties = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('penalty_tracking')
        .select(`
          *,
          booking:bookings(
            id,
            check_in_date,
            check_out_date,
            total_price,
            guests_count,
            status,
            cancellation_reason,
            property:properties(title, address, price_per_night),
            guest:profiles!guest_id(first_name, last_name, email)
          )
        `)
        .eq('host_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPenalties((data as Penalty[]) || []);
    } catch (err) {
      console.error('Erreur lors du chargement des pénalités:', err);
      setError(err as Error);
      setPenalties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPenalties();
  }, [userId]);

  const refreshPenalties = () => {
    fetchPenalties();
  };

  const pendingPenalties = penalties.filter(p => p.status === 'pending');
  const totalPendingAmount = pendingPenalties.reduce((sum, p) => sum + p.penalty_amount, 0);

  return {
    penalties,
    pendingPenalties,
    totalPendingAmount,
    loading,
    error,
    refreshPenalties,
  };
};














