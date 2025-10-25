import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface IdentityDocument {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  uploaded_at: string;
  verified: boolean | null;
  verified_at: string | null;
}

export const useIdentityVerification = () => {
  const [hasUploadedIdentity, setHasUploadedIdentity] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    console.log('🟡 [useIdentityVerification] useEffect déclenché - user:', user?.id, 'checked:', checked);
    
    if (user && !checked) {
      console.log('🟡 [useIdentityVerification] Vérification identité pour user:', user.id);
      checkIdentityStatus();
    } else if (!user) {
      console.log('🟡 [useIdentityVerification] Pas d\'utilisateur - reset');
      setHasUploadedIdentity(false);
      setChecked(false);
    } else {
      console.log('🟡 [useIdentityVerification] Déjà vérifié - pas de nouvelle vérification');
    }
  }, [user, checked]);

  const checkIdentityStatus = async (force = false) => {
    if (!user) return;

    // Si on force le rechargement, on ignore le flag checked
    if (!force && checked) {
      console.log('🟡 [useIdentityVerification] Déjà vérifié - pas de nouvelle vérification');
      return;
    }

    console.log('🟡 [useIdentityVerification] checkIdentityStatus appelé pour user:', user.id, 'force:', force);
    setLoading(true);
    try {
      // Récupérer le dernier document envoyé par l'utilisateur
      const { data: latestDoc, error } = await supabase
        .from('identity_documents')
        .select('id, verified, uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      console.log('🟡 [useIdentityVerification] Dernier document:', latestDoc);
      
      if (latestDoc) {
        setHasUploadedIdentity(true);
        
        // Se baser sur le statut verified du dernier document
        if (latestDoc.verified === true) {
          setVerificationStatus('verified');
          setIsVerified(true);
        } else if (latestDoc.verified === null) {
          setVerificationStatus('pending');
          setIsVerified(false);
        } else if (latestDoc.verified === false) {
          setVerificationStatus('rejected');
          setIsVerified(false);
        }
      } else {
        // Aucun document
        setHasUploadedIdentity(false);
        setVerificationStatus(null);
        setIsVerified(false);
      }
      
      setChecked(true);
    } catch (error) {
      console.error('🔴 [useIdentityVerification] Error checking identity status:', error);
      setChecked(true);
    } finally {
      setLoading(false);
    }
  };

  const uploadIdentityDocument = async (file: any, documentType: string) => {
    if (!user) throw new Error('Utilisateur non connecté');

    // Vérifier la taille du fichier (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Le fichier ne doit pas dépasser 5MB');
    }

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      throw new Error('Seules les images et les PDF sont acceptés');
    }

    setLoading(true);

    try {
      // Vérifier s'il existe déjà un document en attente ou refusé
      const { data: existingDocs, error: fetchError } = await supabase
        .from('identity_documents')
        .select('id, verified, uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (fetchError) {
        console.error('Erreur lors de la récupération des documents existants:', fetchError);
        throw fetchError;
      }

      console.log('📄 Documents existants:', existingDocs);

      // Supprimer TOUS les anciens documents (on ne garde qu'un seul document par utilisateur)
      if (existingDocs && existingDocs.length > 0) {
        console.log('🗑️ Suppression de', existingDocs.length, 'documents existants');
        
        const { error: deleteError } = await supabase
          .from('identity_documents')
          .delete()
          .eq('user_id', user.id);
          
        if (deleteError) {
          console.error('Erreur lors de la suppression des documents:', deleteError);
          throw deleteError;
        }
        
        console.log('✅ Documents supprimés avec succès');
      }

      // Upload vers storage - utiliser directement le fichier
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `identity-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      // Sauvegarder dans la base de données avec verified = null (en attente)
      const { error: dbError } = await supabase
        .from('identity_documents')
        .insert({
          user_id: user.id,
          document_type: documentType,
          document_url: publicUrl,
          verified: null // null = en attente de validation admin
        });

      if (dbError) throw dbError;

      console.log('✅ Document d\'identité uploadé avec succès');
      
      // Envoyer une notification aux admins
      try {
        const { error: notificationError } = await supabase.functions.invoke('send-admin-notification', {
          body: {
            type: 'identity_document_uploaded',
            data: {
              userId: user.id,
              documentType: documentType,
              documentUrl: publicUrl
            }
          }
        });

        if (notificationError) {
          console.error('Erreur notification admin:', notificationError);
          // Continue même si la notification échoue
        } else {
          console.log('✅ Notification admin envoyée');
        }
      } catch (notificationError) {
        console.error('Erreur lors de l\'envoi de la notification admin:', notificationError);
        // Continue même si la notification échoue
      }
      
      // Recharger le statut
      await checkIdentityStatus(true);
      
      return publicUrl;
    } catch (error) {
      console.error('🔴 Erreur lors de l\'upload du document:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { 
    hasUploadedIdentity, 
    isVerified,
    verificationStatus,
    loading,
    checkIdentityStatus,
    uploadIdentityDocument
  };
};
