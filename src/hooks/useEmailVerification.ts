import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export const useEmailVerification = () => {
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isCheckingRef = useRef(false);

  const checkEmailVerificationStatus = useCallback(async (force = false) => {
    if (!user) return;

    // Éviter les appels multiples simultanés avec une ref (sauf si force = true)
    if (!force && isCheckingRef.current) {
      console.log('⏭️ Vérification déjà en cours, ignorée');
      return;
    }
    
    // Si force=true, réinitialiser le flag pour permettre l'exécution
    if (force) {
      isCheckingRef.current = false;
    }
    
    isCheckingRef.current = true;

    setLoading(true);
    try {
      console.log('🔍 Vérification du statut email pour user:', user.id, force ? '(FORCÉ)' : '');
      
      // Forcer le rafraîchissement - récupérer tous les champs pour déboguer
      // Utiliser la même approche que le site web : select('*') pour être sûr d'avoir tous les champs
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('❌ Erreur lors de la récupération du statut email:', error);
        console.error('❌ Détails de l\'erreur:', JSON.stringify(error, null, 2));
        // Ne pas throw, juste logger l'erreur
        return;
      }

      if (!profile) {
        console.error('❌ Profil non trouvé pour user_id:', user.id);
        return;
      }

      console.log('📧 Données complètes du profil récupérées:', {
        user_id: profile.user_id,
        email: profile.email,
        email_verified: profile.email_verified,
        type_email_verified: typeof profile.email_verified
      });

      // Vérifier le statut - gérer les cas null, false, true, et string 'true'
      // Le site web utilise simplement: !profileData.email_verified
      // Donc on doit vérifier si c'est explicitement true
      const verified = profile.email_verified === true;
      
      console.log('📧 Statut email vérifié calculé:', verified, 'pour user:', user.id);
      console.log('📧 Valeur brute email_verified:', profile.email_verified);
      console.log('📧 Comparaison email_verified === true:', profile.email_verified === true);
      console.log('📧 Comparaison email_verified == true:', profile.email_verified == true);
      
      // Mettre à jour l'état - utiliser la même logique que le site web
      setIsEmailVerified(verified);
      
      if (verified) {
        console.log('✅ Statut mis à jour dans l\'état: Email vérifié');
      } else {
        console.log('⚠️ Statut mis à jour dans l\'état: Email non vérifié');
        console.log('⚠️ Raison: email_verified =', profile.email_verified, '(type:', typeof profile.email_verified, ')');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification du statut email:', error);
      setError('Impossible de vérifier le statut de l\'email');
    } finally {
      setLoading(false);
      // Réinitialiser le flag après un court délai pour permettre un nouveau rafraîchissement
      setTimeout(() => {
        isCheckingRef.current = false;
      }, 300);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Vérifier le statut au chargement initial et forcer le rafraîchissement
      console.log('🔄 Hook useEmailVerification: Vérification initiale du statut pour user:', user.id);
      // Forcer le rafraîchissement au chargement pour être sûr d'avoir la dernière valeur
      setTimeout(() => {
        checkEmailVerificationStatus(true);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Ne pas inclure checkEmailVerificationStatus pour éviter les boucles

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
      // Utiliser l'Edge Function verify-code qui contourne RLS avec service role key
      // C'est la même approche que le site web
      const { data, error: verifyError } = await supabase.functions.invoke('verify-code', {
        body: { email, code }
      });

      if (verifyError) {
        throw verifyError;
      }

      if (!data || !data.success) {
        console.error('❌ Erreur de vérification:', data);
        setError(data?.error || 'Code de vérification invalide');
        return { success: false, error: data?.error || 'Code invalide' };
      }

      // Vérifier si email_verified est retourné dans la réponse
      console.log('📧 Réponse complète de verify-code:', JSON.stringify(data, null, 2));
      
      if (data.email_verified === true) {
        console.log('✅ Email vérifié confirmé par la fonction:', data.email_verified);
        setIsEmailVerified(true);
      } else {
        console.warn('⚠️ La fonction verify-code a réussi mais email_verified n\'est pas true:', data.email_verified);
        console.warn('⚠️ Cela peut indiquer un problème de mise à jour en base de données');
      }
      
      // Attendre un peu pour que la base de données soit mise à jour
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Vérifier directement en base de données pour confirmer la mise à jour
      if (user) {
        console.log('🔍 Vérification directe en base de données après vérification...');
        const { data: directCheck, error: directError } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('user_id', user.id)
          .single();
        
        if (directError) {
          console.error('❌ Erreur lors de la vérification directe:', directError);
        } else {
          console.log('📧 Statut direct en base:', directCheck?.email_verified);
          if (directCheck?.email_verified === true) {
            console.log('✅ Confirmation: email_verified est bien true en base de données');
            setIsEmailVerified(true);
          } else {
            console.error('❌ PROBLÈME: email_verified n\'est PAS true en base après vérification!');
            console.error('❌ Valeur en base:', directCheck?.email_verified);
            console.error('❌ Cela indique que la fonction Edge verify-code n\'a pas mis à jour la base de données');
          }
        }
        
        // Réinitialiser le flag pour forcer le rafraîchissement
        isCheckingRef.current = false;
        // Forcer le rafraîchissement immédiatement avec force=true
        await checkEmailVerificationStatus(true);
        
        // Vérifier à nouveau après un délai pour être sûr que la DB est bien à jour
        setTimeout(async () => {
          isCheckingRef.current = false;
          await checkEmailVerificationStatus(true);
        }, 1500);
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











