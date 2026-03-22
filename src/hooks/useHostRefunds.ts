import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface HostRefundDueItem {
  id: string;
  booking_type: 'property' | 'vehicle';
  booking_id: string;
  amount_due: number;
  status: string;
  label?: string;
  penalty_tracking_id?: string | null;
}

export const useHostRefunds = (userId?: string) => {
  const [refunds, setRefunds] = useState<HostRefundDueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRefunds = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: dueError } = await supabase
        .from('host_refund_due')
        .select('id, booking_type, booking_id, amount_due, status, penalty_tracking_id')
        .eq('host_id', userId)
        .order('created_at', { ascending: false });

      if (dueError) throw dueError;

      const list: HostRefundDueItem[] = (rows || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        booking_type: r.booking_type as 'property' | 'vehicle',
        booking_id: r.booking_id as string,
        amount_due: r.amount_due as number,
        status: r.status as string,
        penalty_tracking_id: r.penalty_tracking_id as string | null | undefined,
      }));

      const propertyIds = list.filter((r) => r.booking_type === 'property').map((r) => r.booking_id);
      const vehicleIds = list.filter((r) => r.booking_type === 'vehicle').map((r) => r.booking_id);

      if (propertyIds.length > 0) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, property:properties(title)')
          .in('id', propertyIds);
        const titleByBookingId: Record<string, string> = {};
        (bookings || []).forEach((b: { id: string; property?: { title?: string } | null }) => {
          titleByBookingId[b.id] = b.property?.title ? `Résidence : ${b.property.title}` : `Résa #${b.id}`;
        });
        list.forEach((r) => {
          if (r.booking_type === 'property') r.label = titleByBookingId[r.booking_id] || `Résa #${r.booking_id}`;
        });
      }
      if (vehicleIds.length > 0) {
        const { data: vbs } = await supabase
          .from('vehicle_bookings')
          .select('id, vehicle:vehicles(title)')
          .in('id', vehicleIds);
        const titleByVbId: Record<string, string> = {};
        (vbs || []).forEach((vb: { id: string; vehicle?: { title?: string } | null }) => {
          titleByVbId[vb.id] = vb.vehicle?.title ? `Véhicule : ${vb.vehicle.title}` : `Location #${vb.id.slice(0, 8)}`;
        });
        list.forEach((r) => {
          if (r.booking_type === 'vehicle') r.label = titleByVbId[r.booking_id] || `Location #${r.booking_id}`;
        });
      }
      setRefunds(list);
    } catch (err) {
      console.error('useHostRefunds:', err);
      setError(err as Error);
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [userId]);

  const pendingRefunds = refunds.filter((r) => r.status === 'pending');
  const totalRefundDue = pendingRefunds.reduce((sum, r) => sum + r.amount_due, 0);

  return {
    refunds,
    pendingRefunds,
    totalRefundDue,
    loading,
    error,
    refreshRefunds: fetchRefunds,
  };
};
