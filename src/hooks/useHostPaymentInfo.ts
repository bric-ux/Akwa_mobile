import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface HostPaymentInfo {
  id: string;
  user_id: string;
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_holder_name?: string;
  mobile_money_provider?: 'orange_money' | 'mtn_money' | 'moov_money' | 'wave';
  mobile_money_number?: string;
  paypal_email?: string;
  swift_code?: string;
  iban?: string;
  preferred_payment_method: 'bank_transfer' | 'mobile_money' | 'paypal';
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentInfoFormData {
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_holder_name?: string;
  mobile_money_provider?: 'orange_money' | 'mtn_money' | 'moov_money' | 'wave';
  mobile_money_number?: string;
  paypal_email?: string;
  swift_code?: string;
  iban?: string;
  preferred_payment_method: 'bank_transfer' | 'mobile_money' | 'paypal';
}

export const useHostPaymentInfo = () => {
  const [paymentInfo, setPaymentInfo] = useState<HostPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPaymentInfo = async (): Promise<HostPaymentInfo | null> => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        console.error('❌ [useHostPaymentInfo] Utilisateur non connecté');
        throw new Error('Utilisateur non connecté');
      }

      console.log('🔄 [useHostPaymentInfo] Récupération des informations de paiement pour user:', user.id);

      const { data, error: fetchError } = await supabase
        .from('host_payment_info')
        .select('*')
        .eq('user_id', user.id)
        .single();

      console.log('📊 [useHostPaymentInfo] Résultat de la requête:', {
        hasData: !!data,
        data: data,
        hasError: !!fetchError,
        errorCode: fetchError?.code,
        errorMessage: fetchError?.message
      });

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Aucune donnée trouvée
          console.log('⚠️ [useHostPaymentInfo] Aucune information de paiement trouvée (code PGRST116)');
          setPaymentInfo(null);
          return null;
        } else {
          // Autre erreur
          console.error('❌ [useHostPaymentInfo] Erreur Supabase:', fetchError);
          throw fetchError;
        }
      }

      if (!data) {
        console.log('⚠️ [useHostPaymentInfo] Aucune donnée retournée');
        setPaymentInfo(null);
        return null;
      }

      console.log('✅ [useHostPaymentInfo] Informations de paiement récupérées:', {
        id: data.id,
        preferred_payment_method: data.preferred_payment_method,
        verification_status: data.verification_status,
        bank_name: data.bank_name,
        account_number: data.account_number,
        mobile_money_provider: data.mobile_money_provider,
        mobile_money_number: data.mobile_money_number,
        paypal_email: data.paypal_email
      });
      
      setPaymentInfo(data as HostPaymentInfo);
      return data as HostPaymentInfo;
    } catch (err) {
      console.error('❌ [useHostPaymentInfo] Erreur lors de la récupération des informations de paiement:', err);
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      setPaymentInfo(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createPaymentInfo = async (formData: PaymentInfoFormData) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error: createError } = await supabase
        .from('host_payment_info')
        .insert({
          user_id: user.id,
          ...formData
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      setPaymentInfo(data as HostPaymentInfo);
      return { data, error: null };
    } catch (err) {
      console.error('Erreur lors de la création des informations de paiement:', err);
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentInfo = async (formData: Partial<PaymentInfoFormData>) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error: updateError } = await supabase
        .from('host_payment_info')
        .update(formData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setPaymentInfo(data as HostPaymentInfo);
      return { data, error: null };
    } catch (err) {
      console.error('Erreur lors de la mise à jour des informations de paiement:', err);
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const deletePaymentInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { error: deleteError } = await supabase
        .from('host_payment_info')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw deleteError;
      }

      setPaymentInfo(null);
      return { error: null };
    } catch (err) {
      console.error('Erreur lors de la suppression des informations de paiement:', err);
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const validatePaymentInfo = (formData: PaymentInfoFormData): string[] => {
    const errors: string[] = [];

    if (!formData.preferred_payment_method) {
      errors.push('Veuillez sélectionner une méthode de paiement');
    }

    if (formData.preferred_payment_method === 'bank_transfer') {
      if (!formData.bank_name) errors.push('Le nom de la banque est requis');
      if (!formData.account_number) errors.push('Le numéro de compte est requis');
      if (!formData.account_holder_name) errors.push('Le nom du titulaire du compte est requis');
    }

    if (formData.preferred_payment_method === 'mobile_money') {
      if (!formData.mobile_money_provider) errors.push('Le fournisseur Mobile Money est requis');
      if (!formData.mobile_money_number) errors.push('Le numéro Mobile Money est requis');
    }

    if (formData.preferred_payment_method === 'paypal') {
      if (!formData.paypal_email) errors.push('L\'email PayPal est requis');
    }

    return errors;
  };

  const hasPaymentInfo = (): boolean => {
    return paymentInfo !== null;
  };

  const isPaymentInfoComplete = (info?: HostPaymentInfo | null): boolean => {
    const infoToCheck = info !== undefined ? info : paymentInfo;
    
    if (!infoToCheck) {
      console.log('❌ isPaymentInfoComplete: paymentInfo is null');
      return false;
    }
    
    const errors = validatePaymentInfo(infoToCheck);
    console.log('🔍 Validation paiement:', {
      preferred_payment_method: infoToCheck.preferred_payment_method,
      errors: errors,
      isValid: errors.length === 0
    });
    
    return errors.length === 0;
  };

  const isPaymentInfoVerified = (): boolean => {
    return paymentInfo?.is_verified === true;
  };

  useEffect(() => {
    if (user) {
      console.log('🔄 [useHostPaymentInfo] useEffect - Chargement initial pour user:', user.id);
      fetchPaymentInfo();
    } else {
      console.log('⚠️ [useHostPaymentInfo] useEffect - Pas d\'utilisateur');
      setPaymentInfo(null);
      setLoading(false);
    }
  }, [user]);

  return {
    paymentInfo,
    loading,
    error,
    fetchPaymentInfo,
    createPaymentInfo,
    updatePaymentInfo,
    deletePaymentInfo,
    validatePaymentInfo,
    hasPaymentInfo,
    isPaymentInfoComplete,
    isPaymentInfoVerified
  };
};
