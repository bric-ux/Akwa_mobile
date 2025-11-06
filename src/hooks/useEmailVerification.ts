import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export const useEmailVerification = () => {
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      checkEmailVerificationStatus();
    }
  }, [user]);

  const checkEmailVerificationStatus = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setIsEmailVerified(profile?.email_verified || false);
    } catch (error) {
      console.error('Erreur lors de la vérification du statut email:', error);
      setError('Impossible de vérifier le statut de l\'email');
    } finally {
      setLoading(false);
    }
  };

  const generateVerificationCode = async (email: string, firstName: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('📧 Génération du code de vérification pour:', email);
      
      const { data, error } = await supabase.functions.invoke('generate-verification-code', {
        body: {
          email,
          firstName
        }
      });

      if (error) {
        console.error('❌ Erreur lors de l\'appel de la fonction:', error);
        const errorMessage = error.message || 'Erreur lors de l\'appel de la fonction';
        setError(errorMessage);
        return { success: false, error: errorMessage, details: error };
      }

      // Vérifier si la réponse contient une erreur
      if (data && data.error) {
        console.error('❌ Erreur dans la réponse:', data.error);
        const errorMessage = data.error || 'Erreur lors de l\'envoi de l\'email';
        setError(errorMessage);
        return { success: false, error: errorMessage, details: data.details };
      }

      // Vérifier si le succès est confirmé
      if (data && data.success) {
        console.log('✅ Code généré et email envoyé avec succès');
        return { success: true, data };
      }

      // Si aucune erreur mais pas de confirmation explicite, considérer comme succès
      console.log('✅ Code généré (réponse:', data, ')');
      return { success: true, data };
      
    } catch (error: any) {
      console.error('❌ Erreur inattendue lors de la génération du code:', error);
      const errorMessage = error.message || 'Impossible de générer le code de vérification';
      setError(errorMessage);
      return { success: false, error: errorMessage, details: error };
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (email: string, code: string) => {
    setLoading(true);
    setError(null);

    try {
      // Vérifier le code dans la table email_verification_codes
      const { data: verificationData, error: verificationError } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (verificationError) throw verificationError;

      if (!verificationData || verificationData.length === 0) {
        setError('Code de vérification invalide');
        return { success: false, error: 'Code invalide' };
      }

      const verification = verificationData[0];

      // Vérifier si le code a expiré
      if (new Date(verification.expires_at) < new Date()) {
        setError('Le code a expiré. Veuillez demander un nouveau code.');
        return { success: false, error: 'Code expiré' };
      }

      // Marquer le code comme utilisé
      const { error: updateError } = await supabase
        .from('email_verification_codes')
        .update({ used: true })
        .eq('id', verification.id);

      if (updateError) throw updateError;

      // Mettre à jour le profil pour marquer l'email comme vérifié
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('user_id', user.id);

        if (profileError) throw profileError;
        
        // Recharger le statut depuis la base de données pour être sûr
        await checkEmailVerificationStatus();
      } else {
        setIsEmailVerified(true);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Erreur lors de la vérification du code:', error);
      setError(error.message || 'Erreur lors de la vérification');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async (email: string, firstName: string) => {
    return await generateVerificationCode(email, firstName);
  };

  return {
    isEmailVerified,
    loading,
    error,
    generateVerificationCode,
    verifyCode,
    resendCode,
    checkEmailVerificationStatus
  };
};











