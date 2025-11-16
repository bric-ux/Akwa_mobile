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
  // Informations du filleul (ajoutées lors de la récupération)
  referred_user?: {
    first_name: string | null;
    last_name: string | null;
  };
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
        setIsLoadingCode(true);
        const { data, error } = await supabase
          .from('user_referral_codes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('❌ [useReferrals] Erreur lors de la récupération du code de parrainage:', error);
          throw error;
        }
        
        console.log('✅ [useReferrals] Code de parrainage récupéré:', data);
        setReferralCode(data);
      } catch (error) {
        console.error('❌ [useReferrals] Erreur lors de la récupération du code de parrainage:', error);
        setReferralCode(null);
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
        setIsLoadingReferrals(true);
        
        console.log('🔍 [useReferrals] Début de la récupération des parrainages pour user:', user.id);
        
        // Récupérer tous les parrainages (hôtes et voyageurs)
        const { data, error } = await supabase
          .from('host_referrals')
          .select('*')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ [useReferrals] Erreur lors de la récupération des parrainages:', {
            error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          throw error;
        }
        
        // Récupérer les informations des profiles pour les filleuls
        // Récupérer par user_id ET par email (au cas où referred_user_id serait null)
        const referredUserIds = (data || [])
          .map((r: any) => r.referred_user_id)
          .filter((id: string | null) => id !== null);
        
        const referredEmails = (data || [])
          .map((r: any) => r.referred_email)
          .filter((email: string | null) => email !== null && email !== '');
        
        let profilesMap: { [key: string]: { first_name: string | null; last_name: string | null; email: string | null } } = {};
        let profilesMapByEmail: { [key: string]: { first_name: string | null; last_name: string | null; email: string | null } } = {};
        
        // Récupérer les profiles par user_id
        if (referredUserIds.length > 0) {
          console.log('🔍 [useReferrals] Récupération des profiles par user_id:', {
            count: referredUserIds.length,
            ids: referredUserIds,
          });
          
          const profilesPromises = referredUserIds.map(async (userId: string) => {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, email')
              .eq('user_id', userId)
              .maybeSingle();
            
            if (error) {
              console.error(`❌ [useReferrals] Erreur pour user ${userId}:`, error);
              return null;
            }
            
            return profile;
          });
          
          const profilesResults = await Promise.all(profilesPromises);
          const validProfiles = profilesResults.filter(p => p !== null);
          
          profilesMap = validProfiles.reduce((acc: any, profile: any) => {
            if (profile && profile.user_id) {
              acc[profile.user_id] = {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
              };
            }
            return acc;
          }, {});
        }
        
        // Récupérer les profiles par email (pour les parrainages où referred_user_id est null)
        if (referredEmails.length > 0) {
          console.log('🔍 [useReferrals] Récupération des profiles par email:', {
            count: referredEmails.length,
            emails: referredEmails,
          });
          
          const profilesByEmailPromises = referredEmails.map(async (email: string) => {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, email')
              .eq('email', email)
              .maybeSingle();
            
            if (error) {
              console.error(`❌ [useReferrals] Erreur pour email ${email}:`, error);
              return null;
            }
            
            return profile;
          });
          
          const profilesByEmailResults = await Promise.all(profilesByEmailPromises);
          const validProfilesByEmail = profilesByEmailResults.filter(p => p !== null);
          
          console.log('✅ [useReferrals] Profiles récupérés par email:', {
            count: validProfilesByEmail.length,
            profiles: validProfilesByEmail,
          });
          
          profilesMapByEmail = validProfilesByEmail.reduce((acc: any, profile: any) => {
            if (profile && profile.email) {
              acc[profile.email.toLowerCase()] = {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
              };
            }
            return acc;
          }, {});
        }
        
        console.log('✅ [useReferrals] Profiles maps créés:', {
          byUserId: profilesMap,
          byEmail: profilesMapByEmail,
        });
        
        // Transformer les données pour inclure les infos des filleuls
        const referralsWithUserInfo = (data || []).map((r: any) => {
          // Essayer d'abord par user_id, puis par email
          let userInfo = null;
          if (r.referred_user_id && profilesMap[r.referred_user_id]) {
            userInfo = profilesMap[r.referred_user_id];
          } else if (r.referred_email && profilesMapByEmail[r.referred_email.toLowerCase()]) {
            userInfo = profilesMapByEmail[r.referred_email.toLowerCase()];
          }
          
          console.log(`🔍 [useReferrals] Parrainage ${r.id}:`, {
            referred_user_id: r.referred_user_id,
            referred_email: r.referred_email,
            userInfo: userInfo,
            foundByUserId: !!(r.referred_user_id && profilesMap[r.referred_user_id]),
            foundByEmail: !!(r.referred_email && profilesMapByEmail[r.referred_email.toLowerCase()]),
          });
          
          return {
            ...r,
            referred_user: userInfo,
          };
        });
        
        console.log('✅ [useReferrals] Parrainages récupérés:', {
          userId: user.id,
          count: referralsWithUserInfo.length,
          data: referralsWithUserInfo.map((r: any) => ({
            id: r.id,
            referrer_id: r.referrer_id,
            referrer_type: r.referrer_type,
            status: r.status,
            referred_email: r.referred_email,
            referred_user_id: r.referred_user_id,
            referred_user: r.referred_user,
            reward_amount: r.reward_amount,
            cash_reward_amount: r.cash_reward_amount,
            cash_reward_paid: r.cash_reward_paid,
            completed_at: r.completed_at,
            created_at: r.created_at,
          })),
        });
        
        // Vérifier si les referred_user_id sont présents
        const referralsWithoutUserId = referralsWithUserInfo.filter((r: any) => !r.referred_user_id);
        if (referralsWithoutUserId.length > 0) {
          console.warn('⚠️ [useReferrals] Parrainages sans referred_user_id:', referralsWithoutUserId.map((r: any) => ({
            id: r.id,
            email: r.referred_email,
            status: r.status,
          })));
        }
        
        // Vérifier si les données sont vides mais qu'on s'attend à en avoir
        if (!data || data.length === 0) {
          console.warn('⚠️ [useReferrals] Aucun parrainage trouvé pour user:', user.id);
        }
        
        setReferrals(referralsWithUserInfo);
      } catch (error) {
        console.error('❌ [useReferrals] Erreur lors de la récupération des parrainages:', error);
        setReferrals([]);
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
        setIsLoadingVouchers(true);
        const { data, error } = await supabase
          .from('user_discount_vouchers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ [useReferrals] Erreur lors de la récupération des vouchers:', error);
          throw error;
        }
        
        console.log('✅ [useReferrals] Vouchers récupérés:', {
          count: data?.length || 0,
          data: data,
        });
        
        setVouchers(data || []);
      } catch (error) {
        console.error('❌ [useReferrals] Erreur lors de la récupération des vouchers:', error);
        setVouchers([]);
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
  // Inclure seulement les parrainages où referrer_type est explicitement 'host'
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
  // Un hôte est aussi un voyageur, donc on affiche TOUS les parrainages dans la page voyageur
  // On sépare juste pour les statistiques détaillées
  const guestReferrals = referrals.filter(r => {
    // Inclure tous les parrainages où referrer_type est 'guest' ou null/undefined
    return !r.referrer_type || r.referrer_type === 'guest';
  });
  const hostReferralsForGuest = referrals.filter(r => r.referrer_type === 'host');
  
  // Statistiques combinées (tous les parrainages)
  const allReferrals = referrals;
  const activeVouchers = vouchers.filter(v => v.status === 'active');
  const usedVouchers = vouchers.filter(v => v.status === 'used');
  
  // Statistiques pour les voyageurs (incluant les parrainages hôtes car un hôte est aussi un voyageur)
  const guestStats = {
    total: allReferrals.length, // Total de TOUS les parrainages
    pending: allReferrals.filter(r => r.status === 'pending').length,
    registered: allReferrals.filter(r => r.status === 'registered').length,
    completed: allReferrals.filter(r => r.status === 'completed').length,
    // Statistiques détaillées par type
    guestReferrals: guestReferrals.length,
    hostReferrals: hostReferralsForGuest.length,
    activeVouchers: activeVouchers.length,
    usedVouchers: usedVouchers.length,
    totalSavings: usedVouchers.reduce((sum, v) => sum + (v.discount_amount || 0), 0),
  };

  // Log pour debug
  console.log('🔍 [useReferrals] Données récupérées:', {
    referralsCount: referrals.length,
    referralsWithTypes: referrals.map(r => ({
      id: r.id,
      referrer_type: r.referrer_type,
      status: r.status,
      referred_email: r.referred_email,
    })),
    guestReferralsCount: guestReferrals.length,
    hostReferralsCount: hostReferrals.length,
    vouchersCount: vouchers.length,
    activeVouchersCount: activeVouchers.length,
    guestStats,
    hostStats,
  });

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

