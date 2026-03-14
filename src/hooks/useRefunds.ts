import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface Refund {
  id: string;
  payment_id: string;
  booking_id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  external_refund_id?: string | null;
  refund_type: 'full' | 'partial';
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Moyen de paiement utilisé par le voyageur pour cette réservation (pour indiquer à l'hôte comment rembourser). */
  guest_payment_method?: string | null;
  booking?: {
    id: string;
    check_in_date?: string;
    check_out_date?: string;
    total_price?: number;
    guests_count?: number;
    status?: string;
    cancellation_reason?: string;
    payment_method?: string;
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
  payment?: { payment_method?: string } | null;
}

export const useRefunds = (userId?: string) => {
  const [refunds, setRefunds] = useState<Refund[]>([]);
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
      // Essayer d'abord de récupérer depuis la table refunds si elle existe
      // Sinon, calculer les remboursements à partir des réservations annulées
      
      // Récupérer d'abord les IDs des réservations où l'utilisateur est l'hôte
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          property:properties!inner(
            host_id
          )
        `)
        .eq('property.host_id', userId);

      if (bookingsError) throw bookingsError;

      const bookingIds = bookingsData?.map((b) => b.id) || [];

      if (bookingIds.length === 0) {
        setRefunds([]);
        setLoading(false);
        return;
      }

      // Essayer de récupérer depuis la table refunds
      let refundsData: any[] = [];
      const { data: refundsFromTable, error: refundsError } = await supabase
        .from('refunds')
        .select(`
          *,
          payment:payments(payment_method),
          booking:bookings(
            id,
            check_in_date,
            check_out_date,
            total_price,
            guests_count,
            status,
            cancellation_reason,
            payment_method,
            property:properties(
              title,
              address,
              price_per_night
            ),
            guest:profiles!guest_id(
              first_name,
              last_name,
              email
            )
          )
        `)
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false });

      // Si la table refunds n'existe pas (code PGRST205), calculer depuis les bookings annulés
      if (refundsError && (refundsError.code === 'PGRST205' || refundsError.message?.includes('refunds'))) {
        console.log('Table refunds non trouvée, calcul des remboursements depuis les bookings annulés');
        
        // Récupérer les réservations annulées où l'utilisateur est l'hôte
        const { data: cancelledBookings, error: cancelledError } = await supabase
          .from('bookings')
          .select(`
            id,
            check_in_date,
            check_out_date,
            total_price,
            guests_count,
            status,
            cancellation_reason,
            cancelled_at,
            payment_method,
            property:properties!inner(
              title,
              address,
              price_per_night,
              cancellation_policy,
              host_id
            ),
            guest:profiles!guest_id(
              first_name,
              last_name,
              email
            ),
            payments(payment_method)
          `)
          .eq('property.host_id', userId)
          .eq('status', 'cancelled')
          .order('cancelled_at', { ascending: false });

        if (cancelledError) throw cancelledError;

        // Calculer les remboursements pour chaque réservation annulée
        refundsData = (cancelledBookings || []).map((booking) => {
          // Calculer le pourcentage de remboursement selon la politique
          const prop = Array.isArray((booking as any).property) ? (booking as any).property?.[0] : (booking as any).property;
          const policy = prop?.cancellation_policy || 'flexible';
          const checkInDate = new Date(booking.check_in_date);
          const cancelledDate = booking.cancelled_at ? new Date(booking.cancelled_at) : new Date();
          const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - cancelledDate.getTime()) / (1000 * 60 * 60 * 24));

          let refundPercentage = 0;
          switch (policy) {
            case 'flexible':
              refundPercentage = daysUntilCheckIn >= 1 ? 100 : 50;
              break;
            case 'moderate':
              refundPercentage = daysUntilCheckIn >= 5 ? 100 : 50;
              break;
            case 'strict':
              refundPercentage = daysUntilCheckIn >= 7 ? 50 : 0;
              break;
            case 'non_refundable':
              refundPercentage = 0;
              break;
            default:
              refundPercentage = daysUntilCheckIn >= 1 ? 100 : 50;
          }

            // total_price est en FCFA (comme sur le site web), on calcule le remboursement en FCFA aussi
            const refundAmount = Math.round((booking.total_price * refundPercentage) / 100);

          const guestPaymentMethod =
            (Array.isArray((booking as any).payments) && (booking as any).payments?.[0]?.payment_method) ||
            (booking as any).payment_method ||
            null;

          return {
            id: `calculated-${booking.id}`,
            payment_id: null,
            booking_id: booking.id,
            amount: refundAmount,
            reason: booking.cancellation_reason || 'Annulation par le voyageur',
            status: refundAmount > 0 ? 'completed' : 'failed',
            refund_type: refundPercentage === 100 ? 'full' : 'partial',
            processed_at: booking.cancelled_at,
            created_at: booking.cancelled_at || booking.check_in_date,
            updated_at: booking.cancelled_at || booking.check_in_date,
            guest_payment_method: guestPaymentMethod,
            booking: {
              id: booking.id,
              check_in_date: booking.check_in_date,
              check_out_date: booking.check_out_date,
              total_price: booking.total_price,
              guests_count: booking.guests_count,
              status: booking.status,
              cancellation_reason: booking.cancellation_reason,
              payment_method: (booking as any).payment_method,
              property: booking.property,
              guest: booking.guest,
            },
          };
        }).filter((refund) => refund.amount > 0); // Ne garder que les remboursements avec montant > 0
      } else if (refundsError) {
        // Autre erreur que l'absence de table
        throw refundsError;
      } else if (refundsFromTable) {
        // Table refunds existe : ajouter le moyen de paiement du voyageur (pour affichage à l'hôte)
        refundsData = refundsFromTable.map((r: any) => ({
          ...r,
          guest_payment_method:
            r.payment?.payment_method ?? r.booking?.payment_method ?? null,
        }));
      }

      setRefunds(refundsData as Refund[]);
    } catch (err) {
      console.error('Erreur lors du chargement des remboursements:', err);
      setError(err as Error);
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [userId]);

  const refreshRefunds = () => {
    fetchRefunds();
  };

  const pendingRefunds = refunds.filter((r) => r.status === 'pending' || r.status === 'processing');
  const completedRefunds = refunds.filter((r) => r.status === 'completed');
  const totalRefundedAmount = completedRefunds.reduce((sum, r) => sum + r.amount, 0);
  const totalPendingAmount = pendingRefunds.reduce((sum, r) => sum + r.amount, 0);

  const declareRefundDone = async (refund: Refund): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Non connecté' };
    const now = new Date().toISOString();
    const isCalculated = typeof refund.id === 'string' && refund.id.startsWith('calculated-');

    try {
      if (isCalculated) {
        const bookingId = refund.booking_id;
        const { data: paymentRow } = await supabase
          .from('payments')
          .select('id')
          .eq('booking_id', bookingId)
          .limit(1)
          .maybeSingle();
        const paymentId = paymentRow?.id;
        if (!paymentId) {
          return { success: false, error: 'Aucun paiement trouvé pour cette réservation. Contactez le support.' };
        }
        const { error: insertError } = await supabase.from('refunds').insert({
          payment_id: paymentId,
          booking_id: bookingId,
          amount: refund.amount,
          reason: refund.reason || 'Remboursement effectué par l\'hôte',
          status: 'completed',
          refund_type: refund.refund_type || (refund.amount >= (refund.booking?.total_price || 0) ? 'full' : 'partial'),
          processed_by: userId,
          processed_at: now,
          updated_at: now,
        });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from('refunds')
          .update({
            status: 'completed',
            processed_by: userId,
            processed_at: now,
            updated_at: now,
          })
          .eq('id', refund.id);
        if (updateError) throw updateError;
      }
      await fetchRefunds();
      return { success: true };
    } catch (e: any) {
      console.error('declareRefundDone:', e);
      return { success: false, error: e.message || 'Impossible d\'enregistrer le remboursement' };
    }
  };

  return {
    refunds,
    pendingRefunds,
    completedRefunds,
    totalRefundedAmount,
    totalPendingAmount,
    loading,
    error,
    refreshRefunds,
    declareRefundDone,
  };
};

