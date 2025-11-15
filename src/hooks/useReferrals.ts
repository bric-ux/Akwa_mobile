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
        // Récupérer tous les parrainages (hôtes et voyageurs)
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
  // Les hôtes ET les voyageurs peuvent créer des codes de parrainage
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
      // D'abord, récupérer le code de parrainage
      const { data: referralCodeData, error: referralError } = await supabase
        .from('user_referral_codes')
        .select('*')
        .eq('referral_code', code.toUpperCase())
        .maybeSingle();

      if (referralError) {
        console.error('Error verifying referral code:', referralError);
        throw referralError;
      }
      
      if (!referralCodeData) {
        return { valid: false, error: 'Code de parrainage invalide' };
      }

      // Vérifier que ce n'est pas l'utilisateur lui-même
      if (user && referralCodeData.user_id === user.id) {
        return { valid: false, error: 'Vous ne pouvez pas vous auto-parrainer' };
      }

      // Vérifier que l'utilisateur qui entre le code n'est pas déjà hôte
      if (user) {
        const { data: currentUserProfile, error: currentUserError } = await supabase
          .from('profiles')
          .select('is_host')
          .eq('user_id', user.id)
          .maybeSingle();

        if (currentUserError) {
          console.error('Error checking current user host status:', currentUserError);
        }

        // Vérifier aussi si l'utilisateur a des propriétés
        const { data: userProperties, error: userPropertiesError } = await supabase
          .from('properties')
          .select('id')
          .eq('host_id', user.id)
          .limit(1);

        if (userPropertiesError) {
          console.error('Error checking user properties:', userPropertiesError);
        }

        const userHasProperties = userProperties && userProperties.length > 0;
        const userIsHost = currentUserProfile?.is_host || userHasProperties;

        if (userIsHost) {
          return { valid: false, error: 'Vous êtes déjà hôte. Le parrainage n\'est disponible que pour devenir hôte pour la première fois.' };
        }
      }

      // Récupérer le profil du parrain
      const { data: parrainProfile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', referralCodeData.user_id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching referrer profile:', profileError);
        // Ne pas faire échouer la validation si on ne peut pas récupérer le profil
      }

      console.log('🔍 Vérification code parrainage:', {
        code: code.toUpperCase(),
        parrainUserId: referralCodeData.user_id,
        parrainName: parrainProfile ? `${parrainProfile.first_name} ${parrainProfile.last_name}` : 'Inconnu',
        currentUserId: user?.id
      });

      console.log('✅ Code valide: le parrain peut être un hôte ou un voyageur');

      const referrerName = parrainProfile 
        ? `${parrainProfile.first_name || ''} ${parrainProfile.last_name || ''}`.trim() || 'Utilisateur'
        : 'Utilisateur';

      return { 
        valid: true, 
        referrerName
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

