import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface CommissionDueItem {
  id: string;
  booking_type: 'property' | 'vehicle';
  booking_id: string;
  amount_due: number;
  status: string;
  label?: string;
}

export interface PlatformPaymentInfo {
  wave_phone?: string | null;
  bank_name?: string | null;
  rib_iban?: string | null;
  instructions_wave?: string | null;
  instructions_bank?: string | null;
}

export const useCommissions = (userId?: string) => {
  const [commissions, setCommissions] = useState<CommissionDueItem[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PlatformPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCommissions = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: dueRows, error: dueError } = await supabase
        .from('platform_commission_due')
        .select('id, booking_type, booking_id, amount_due, status')
        .eq('host_id', userId)
        .order('created_at', { ascending: false });

      if (dueError) throw dueError;

      const { data: infoRows } = await supabase
        .from('platform_payment_info')
        .select('wave_phone, bank_name, rib_iban, instructions_wave, instructions_bank')
        .limit(1)
        .maybeSingle();

      setPaymentInfo(infoRows ?? null);

      const list: CommissionDueItem[] = (dueRows || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        booking_type: r.booking_type as 'property' | 'vehicle',
        booking_id: r.booking_id as string,
        amount_due: r.amount_due as number,
        status: r.status as string,
      }));

      const propertyIds = list.filter((c) => c.booking_type === 'property').map((c) => c.booking_id);
      const vehicleIds = list.filter((c) => c.booking_type === 'vehicle').map((c) => c.booking_id);

      if (propertyIds.length > 0) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, property:properties(title)')
          .in('id', propertyIds);
        const titleByBookingId: Record<string, string> = {};
        (bookings || []).forEach((b: { id: string; property?: { title?: string } | null }) => {
          titleByBookingId[b.id] = b.property?.title ? `Résidence : ${b.property.title}` : `Résa #${b.id.slice(0, 8)}`;
        });
        list.forEach((c) => {
          if (c.booking_type === 'property') c.label = titleByBookingId[c.booking_id] || `Résa #${c.booking_id.slice(0, 8)}`;
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
        list.forEach((c) => {
          if (c.booking_type === 'vehicle') c.label = titleByVbId[c.booking_id] || `Location #${c.booking_id.slice(0, 8)}`;
        });
      }
      setCommissions(list);
    } catch (err) {
      console.error('useCommissions:', err);
      setError(err as Error);
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [userId]);

  const pendingCommissions = commissions.filter((c) => c.status === 'pending');
  const totalCommissionDue = pendingCommissions.reduce((sum, c) => sum + c.amount_due, 0);

  return {
    commissions,
    pendingCommissions,
    totalCommissionDue,
    paymentInfo,
    loading,
    error,
    refreshCommissions: fetchCommissions,
  };
};
