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
  status: 'pending' | 'registered' | 'application_submitted' | 'first_property' | 'completed';
  reward_amount: number;
  referrer_type: 'host' | 'guest';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  cash_reward_paid?: boolean;
  cash_reward_amount?: number;
  /** Récompense campagne actuelle (1000 FCFA à l’approbation) — utilisé pour le décompte du plafond 30 */
  approval_campaign_reward?: boolean | null;
  referral_payout_paid_at?: string | null;
  referral_payout_marked_by?: string | null;
  // Informations du filleul (ajoutées lors de la récupération)
  referred_user?: {
    first_name: string | null;
    last_name: string | null;
  };
}

/** Campagne parrainage : 1000 FCFA à l’approbation candidature, max 30 filleuls rémunérés */
export const REFERRAL_CAMPAIGN_UNIT_FCFA = 1000;
export const REFERRAL_CAMPAIGN_MAX_SLOTS = 30;

export type ReferralCampaignStats = {
  maxSlots: number;
  unitFcfa: number;
  /** Parrainages campagne avec récompense 1000 (ou 0 si plafond) */
  slotsUsed: number;
  slotsRemaining: number;
  /** Somme des montants campagne non encore marqués payés par l’admin */
  pendingFcfa: number;
  pendingLines: number;
  /** Total crédité campagne (tous statuts payés ou non) */
  totalCreditedCampaignFcfa: number;
};

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

/** Debug parrainage : uniquement en __DEV__ (évite le spam Metro en prod) */
const devLog = (...args: unknown[]) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(...args);
  }
};

/** PostgREST peut renvoyer une ligne unique comme objet au lieu d’un tableau */
function asRpcRows<T extends Record<string, unknown>>(data: unknown): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'object') return [data as T];
  return [];
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
        
        devLog('✅ [useReferrals] Code de parrainage récupéré:', data);
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
        
        devLog('🔍 [useReferrals] Début de la récupération des parrainages pour user:', user.id);
        
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
          devLog('🔍 [useReferrals] Récupération des profiles par user_id:', {
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
          devLog('🔍 [useReferrals] Récupération des profiles par email:', {
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
          
          devLog('✅ [useReferrals] Profiles récupérés par email:', {
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
        
        devLog('✅ [useReferrals] Profiles maps créés:', {
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
          
          devLog(`🔍 [useReferrals] Parrainage ${r.id}:`, {
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
        
        devLog('✅ [useReferrals] Parrainages récupérés:', {
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
        
        devLog('✅ [useReferrals] Vouchers récupérés:', {
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
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        return { valid: false, error: 'Code de parrainage invalide' };
      }

      // RPC SECURITY DEFINER : la table user_referral_codes n’est lisible par RLS que pour sa propre ligne ;
      // un SELECT direct sur le code d’un autre utilisateur renvoie toujours vide → « invalide » à tort.
      const { data: validationRows, error: referralError } = await supabase.rpc(
        'validate_referral_code',
        { p_code: normalized }
      );

      if (referralError) {
        console.error('Error verifying referral code:', referralError);
        throw referralError;
      }

      const validation = validationRows?.[0];
      if (!validation?.is_valid || !validation.referrer_user_id) {
        return { valid: false, error: 'Code de parrainage invalide' };
      }

      const referrerUserId = validation.referrer_user_id as string;

      if (user && referrerUserId === user.id) {
        return { valid: false, error: 'Vous ne pouvez pas vous auto-parrainer' };
      }

      // Récupérer le profil du parrain (RPC SECURITY DEFINER si déployé ; sinon host_public_info / profiles selon RLS)
      let parrainProfile: { first_name: string | null; last_name: string | null } | null = null;

      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_profile_info', {
          profile_user_id: referrerUserId,
        });

        if (rpcError) {
          console.error('Error fetching referrer profile (RPC):', rpcError);
        } else {
          const rows = asRpcRows<{ first_name: string | null; last_name: string | null }>(rpcData);
          const row0 = rows[0];
          if (row0 && (row0.first_name != null || row0.last_name != null)) {
            parrainProfile = {
              first_name: row0.first_name,
              last_name: row0.last_name,
            };
          }
        }

        if (!parrainProfile) {
          const { data: hostPub, error: hostPubError } = await supabase
            .from('host_public_info')
            .select('first_name, last_name')
            .eq('user_id', referrerUserId)
            .maybeSingle();

          if (hostPubError) {
            console.error('Error fetching referrer profile (host_public_info):', hostPubError);
          } else if (hostPub && (hostPub.first_name != null || hostPub.last_name != null)) {
            parrainProfile = {
              first_name: hostPub.first_name,
              last_name: hostPub.last_name,
            };
          }
        }

        if (!parrainProfile) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', referrerUserId)
            .maybeSingle();

          if (profileError) {
            console.error('Error fetching referrer profile (profiles):', profileError);
          } else if (profileData) {
            parrainProfile = {
              first_name: profileData.first_name,
              last_name: profileData.last_name,
            };
          } else {
            devLog(
              'Referrer display name unavailable: no RPC row, no host_public_info, profiles not visible (RLS).'
            );
          }
        }
      } catch (error) {
        console.error('Error fetching referrer profile:', error);
        // Ne pas faire échouer la validation si on ne peut pas récupérer le profil
      }

      devLog('🔍 Vérification code parrainage:', {
        code: normalized,
        parrainUserId: referrerUserId,
        parrainName: parrainProfile ? `${parrainProfile.first_name} ${parrainProfile.last_name}` : 'Inconnu',
        currentUserId: user?.id
      });

      devLog('✅ Code valide: le parrain peut être un hôte ou un voyageur');

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

  // Statistiques espace hôte : tous les filleuls (referrer_id = user).
  // referrer_type peut être 'guest' si le parrain n'avait pas encore de ligne dans properties au moment du lien
  // alors qu'il est déjà hôte (is_host) — les anciennes UIs filtraient referrer_type === 'host' et masquaient tout.
  const hostReferrals = referrals;

  const computeCampaignStats = (list: Referral[]): ReferralCampaignStats => {
    const campaign = list.filter(r => r.approval_campaign_reward === true);
    const slotsUsed = campaign.filter(r => (r.reward_amount || 0) >= REFERRAL_CAMPAIGN_UNIT_FCFA).length;
    const unpaid = campaign.filter(
      r =>
        (r.cash_reward_amount || 0) > 0 &&
        (r.cash_reward_paid === false || r.cash_reward_paid === null || r.cash_reward_paid === undefined)
    );
    const pendingFcfa = unpaid.reduce((s, r) => s + (r.cash_reward_amount || 0), 0);
    const totalCreditedCampaignFcfa = campaign.reduce((s, r) => s + (r.reward_amount || 0), 0);
    return {
      maxSlots: REFERRAL_CAMPAIGN_MAX_SLOTS,
      unitFcfa: REFERRAL_CAMPAIGN_UNIT_FCFA,
      slotsUsed,
      slotsRemaining: Math.max(0, REFERRAL_CAMPAIGN_MAX_SLOTS - slotsUsed),
      pendingFcfa,
      pendingLines: unpaid.length,
      totalCreditedCampaignFcfa,
    };
  };

  const campaignStats = computeCampaignStats(referrals);

  const hostStats = {
    total: hostReferrals.length,
    pending: hostReferrals.filter(r => r.status === 'pending').length,
    registered: hostReferrals.filter(r => r.status === 'registered').length,
    completed: hostReferrals.filter(r => r.status === 'completed').length,
    /** Somme historique (tous systèmes) */
    totalRewards: hostReferrals.reduce((sum, r) => sum + (r.reward_amount || 0), 0),
    pendingPayment: hostReferrals.filter(
      r =>
        r.status === 'completed' &&
        r.approval_campaign_reward === true &&
        (r.cash_reward_amount || 0) > 0 &&
        !r.cash_reward_paid
    ).length,
    campaign: campaignStats,
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
    /** Campagne cash (tous types de parrain) */
    campaign: campaignStats,
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
    /** Stats campagne 1000 FCFA (tous parrainages de l’utilisateur) */
    referralCampaign: campaignStats,
  };
};

