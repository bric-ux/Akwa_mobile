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
      console.log('🔍 Vérification du code pour:', email);
      
      // Vérifier le code dans la table email_verification_codes (même approche que le site web)
      const { data: verificationData, error: verifyError } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (verifyError) {
        console.error('❌ Erreur lors de la vérification du code:', verifyError);
        setError('Erreur lors de la vérification. Veuillez réessayer.');
        return { success: false, error: 'Erreur lors de la vérification' };
      }

      if (!verificationData || verificationData.length === 0) {
        console.error('❌ Code de vérification invalide');
        setError('Code de vérification invalide. Veuillez réessayer.');
        return { success: false, error: 'Code de vérification invalide' };
      }

      const verification = verificationData[0];

      // Vérifier si le code a expiré
      if (new Date(verification.expires_at) < new Date()) {
        console.error('❌ Code expiré');
        setError('Le code a expiré. Veuillez demander un nouveau code.');
        return { success: false, error: 'Le code a expiré' };
      }

      // Marquer le code comme utilisé
      const { error: updateCodeError } = await supabase
        .from('email_verification_codes')
        .update({ used: true })
        .eq('id', verification.id);

      if (updateCodeError) {
        console.error('❌ Erreur lors de la mise à jour du code:', updateCodeError);
        setError('Erreur lors de la mise à jour du code. Veuillez réessayer.');
        return { success: false, error: 'Erreur lors de la mise à jour du code' };
      }

      // Utiliser la fonction RPC pour marquer l'email comme vérifié (même approche que le site web)
      console.log('📧 Appel de la fonction RPC mark_email_as_verified...');
      const { error: rpcError } = await supabase.rpc('mark_email_as_verified');
      
      if (rpcError) {
        console.error('❌ Erreur lors de la mise à jour du profil via RPC:', rpcError);
        setError('Erreur lors de la mise à jour du profil. Veuillez réessayer.');
        return { success: false, error: 'Erreur lors de la mise à jour du profil' };
      }

      console.log('✅ RPC appelée avec succès, vérification en base de données...');
      
      // Vérifier directement en base de données que la mise à jour a bien eu lieu
      if (user) {
        // Attendre un court instant pour que la transaction soit commitée
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { data: profileCheck, error: checkError } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('user_id', user.id)
          .single();
        
        if (checkError) {
          console.error('❌ Erreur lors de la vérification en base:', checkError);
        } else {
          console.log('📧 Statut email_verified en base après RPC:', profileCheck?.email_verified);
          
          if (profileCheck?.email_verified === true) {
            console.log('✅ CONFIRMÉ: email_verified est bien true en base de données');
            setIsEmailVerified(true);
          } else {
            console.error('❌ PROBLÈME: email_verified n\'est PAS true après l\'appel RPC!');
            console.error('❌ Valeur actuelle:', profileCheck?.email_verified);
            console.error('❌ Cela indique que la fonction RPC n\'a pas mis à jour la base de données');
            // Essayer une deuxième fois
            console.log('🔄 Nouvelle tentative d\'appel RPC...');
            const { error: retryError } = await supabase.rpc('mark_email_as_verified');
            if (retryError) {
              console.error('❌ Erreur lors de la deuxième tentative:', retryError);
            } else {
              // Vérifier à nouveau
              await new Promise(resolve => setTimeout(resolve, 200));
              const { data: retryCheck } = await supabase
                .from('profiles')
                .select('email_verified')
                .eq('user_id', user.id)
                .single();
              
              if (retryCheck?.email_verified === true) {
                console.log('✅ Succès après nouvelle tentative');
                setIsEmailVerified(true);
              } else {
                console.error('❌ Échec même après nouvelle tentative');
                setError('La mise à jour du profil a échoué. Veuillez réessayer.');
                return { success: false, error: 'La mise à jour du profil a échoué' };
              }
            }
          }
        }
        
        // Forcer le rafraîchissement du statut depuis la base de données
        // Réinitialiser le flag pour forcer le rafraîchissement
        isCheckingRef.current = false;
        // Forcer le rafraîchissement immédiatement avec force=true
        await checkEmailVerificationStatus(true);
      } else {
        // Si pas d'utilisateur, on met quand même à jour l'état local
        setIsEmailVerified(true);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification du code:', error);
      setError(error.message || 'Erreur lors de la vérification');
      return { success: false, error: error.message || 'Erreur lors de la vérification' };
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











