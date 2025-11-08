import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

interface ReferralCode {
  id: string;
  user_id: string;
  referral_code: string;
  created_at: string;
}

interface Referral {
  id: string;
  referrer_id: string;
  referred_email: string;
  referred_user_id: string | null;
  referral_code: string;
  status: 'pending' | 'registered' | 'first_property' | 'completed';
  reward_amount: number;
  referrer_type: 'host' | 'guest';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  cash_reward_paid?: boolean;
  cash_reward_amount?: number;
}

interface DiscountVoucher {
  id: string;
  user_id: string;
  discount_percentage: number;
  discount_amount: number | null;
  voucher_code: string;
  referral_id: string | null;
  status: 'active' | 'used' | 'expired';
  used_on_booking_id: string | null;
  valid_until: string | null;
  created_at: string;
  used_at: string | null;
}

export const useReferrals = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [vouchers, setVouchers] = useState<DiscountVoucher[]>([]);
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(true);

  // Récupérer le code de parrainage de l'utilisateur
  useEffect(() => {
    if (!user) {
      setIsLoadingCode(false);
      return;
    }

    const fetchReferralCode = async () => {
      try {
        const { data, error } = await supabase
          .from('user_referral_codes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setReferralCode(data);
      } catch (error) {
        console.error('Error fetching referral code:', error);
      } finally {
        setIsLoadingCode(false);
      }
    };

    fetchReferralCode();
  }, [user]);

  // Récupérer la liste des parrainages
  useEffect(() => {
    if (!user) {
      setIsLoadingReferrals(false);
      return;
    }

    const fetchReferrals = async () => {
      try {
        const { data, error } = await supabase
          .from('host_referrals')
          .select('*')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReferrals(data || []);
      } catch (error) {
        console.error('Error fetching referrals:', error);
      } finally {
        setIsLoadingReferrals(false);
      }
    };

    fetchReferrals();
  }, [user]);

  // Récupérer les bons de réduction (pour les voyageurs)
  useEffect(() => {
    if (!user) {
      setIsLoadingVouchers(false);
      return;
    }

    const fetchVouchers = async () => {
      try {
        const { data, error } = await supabase
          .from('user_discount_vouchers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setVouchers(data || []);
      } catch (error) {
        console.error('Error fetching vouchers:', error);
      } finally {
        setIsLoadingVouchers(false);
      }
    };

    fetchVouchers();
  }, [user]);

  // Créer un code de parrainage si l'utilisateur n'en a pas
  const createReferralCode = async () => {
    if (!user) throw new Error('Not authenticated');

    try {
      // Générer un code via la fonction SQL
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_referral_code');

      if (codeError) throw codeError;

      const { data, error } = await supabase
        .from('user_referral_codes')
        .insert({
          user_id: user.id,
          referral_code: codeData,
        })
        .select()
        .single();

      if (error) throw error;
      setReferralCode(data);
      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating referral code:', error);
      return { success: false, error: error.message };
    }
  };

  // Vérifier un code de parrainage
  const verifyReferralCode = async (code: string) => {
    try {
      const { data, error } = await supabase
        .from('user_referral_codes')
        .select('*, profiles:user_id(first_name, last_name)')
        .eq('referral_code', code.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return { valid: false, error: 'Code de parrainage invalide' };
      }

      // Vérifier que ce n'est pas l'utilisateur lui-même
      if (user && data.user_id === user.id) {
        return { valid: false, error: 'Vous ne pouvez pas vous auto-parrainer' };
      }

      // Vérifier que le parrain n'est pas déjà hôte (pour les nouveaux hôtes)
      const { data: parrainProfile } = await supabase
        .from('profiles')
        .select('is_host')
        .eq('user_id', data.user_id)
        .single();

      if (parrainProfile?.is_host) {
        return { valid: false, error: 'Ce parrain est déjà hôte, le parrainage n\'est pas valide' };
      }

      return { 
        valid: true, 
        referrerName: parrainProfile ? `${parrainProfile.first_name} ${parrainProfile.last_name}` : 'Utilisateur'
      };
    } catch (error: any) {
      console.error('Error verifying referral code:', error);
      return { valid: false, error: error.message || 'Erreur lors de la vérification' };
    }
  };

  // Statistiques pour les hôtes
  const hostReferrals = referrals.filter(r => r.referrer_type === 'host');
  
  const hostStats = {
    total: hostReferrals.length,
    pending: hostReferrals.filter(r => r.status === 'pending').length,
    registered: hostReferrals.filter(r => r.status === 'registered').length,
    completed: hostReferrals.filter(r => r.status === 'completed').length,
    totalRewards: hostReferrals.reduce((sum, r) => sum + (r.reward_amount || 0), 0),
    pendingPayment: hostReferrals.filter(r => r.status === 'completed' && !r.cash_reward_paid).length,
  };

  // Statistiques pour les voyageurs
  const guestReferrals = referrals.filter(r => r.referrer_type === 'guest');
  const activeVouchers = vouchers.filter(v => v.status === 'active');
  const usedVouchers = vouchers.filter(v => v.status === 'used');
  
  const guestStats = {
    total: guestReferrals.length,
    pending: guestReferrals.filter(r => r.status === 'pending').length,
    registered: guestReferrals.filter(r => r.status === 'registered').length,
    completed: guestReferrals.filter(r => r.status === 'completed').length,
    activeVouchers: activeVouchers.length,
    usedVouchers: usedVouchers.length,
    totalSavings: usedVouchers.reduce((sum, v) => sum + (v.discount_amount || 0), 0),
  };

  return {
    referralCode,
    isLoadingCode,
    createReferralCode,
    referrals,
    isLoadingReferrals,
    vouchers,
    isLoadingVouchers,
    verifyReferralCode,
    hostStats,
    guestStats,
  };
};

