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
    if (file.size && file.size > 5 * 1024 * 1024) {
      throw new Error('Le fichier ne doit pas dépasser 5MB');
    }

    // Vérifier le type de fichier
    if (file.type && !file.type.startsWith('image/') && !file.type.includes('pdf')) {
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

      // Préparer le contenu pour Supabase Storage (gérer les URI locaux iOS/Android)
      // Nettoyer le nom, forcer l'extension et le content-type
      const originalName: string = String(file.name || 'identity.pdf');
      const isPdf = (file.type && String(file.type).includes('pdf')) || originalName.toLowerCase().endsWith('.pdf');
      const safeBase = originalName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'document';
      const ext = isPdf ? 'pdf' : (originalName.split('.').pop() || 'jpg');
      const fileName = `${user.id}-${Date.now()}-${safeBase}.${ext}`.toLowerCase();
      const filePath = `identity-documents/${fileName}`;

      // Récupérer les octets depuis l'URI local si présent (React Native compatible)
      let dataToUpload: any = file;
      try {
        if (file.uri) {
          console.log('📤 Conversion du fichier URI en ArrayBuffer:', file.uri);
          const res = await fetch(file.uri);
          if (!res.ok) {
            throw new Error(`Erreur HTTP: ${res.status}`);
          }
          // Utiliser arrayBuffer() au lieu de blob() pour React Native
          const arrayBuffer = await res.arrayBuffer();
          // Convertir ArrayBuffer en Uint8Array pour Supabase Storage
          const uint8Array = new Uint8Array(arrayBuffer);
          console.log('✅ ArrayBuffer créé, taille:', uint8Array.length, 'bytes');
          dataToUpload = uint8Array;
        } else if (file instanceof Uint8Array) {
          // Si c'est déjà un Uint8Array, l'utiliser directement
          dataToUpload = file;
        } else if (file instanceof ArrayBuffer) {
          // Si c'est un ArrayBuffer, le convertir en Uint8Array
          dataToUpload = new Uint8Array(file);
        }
      } catch (e: any) {
        console.error('⚠️ Erreur lors de la conversion du fichier:', e);
        console.warn('⚠️ Tentative upload direct du fichier');
        // Continuer avec le fichier original si la conversion échoue
      }

      const contentType = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, dataToUpload, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

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
      
      // Envoyer les emails de notification
      try {
        // Récupérer les informations de l'utilisateur
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', user.id)
          .single();

        if (!profileError && userProfile?.email) {
          // Email de confirmation à l'utilisateur
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'identity_document_submitted',
              to: userProfile.email,
              data: {
                firstName: userProfile.first_name || 'Utilisateur',
                lastName: userProfile.last_name || '',
                documentType: documentType,
                siteUrl: 'https://akwahome.com'
              }
            }
          });
          console.log('✅ Email de confirmation envoyé à l\'utilisateur');
        }

        // Email de notification aux administrateurs
        const { data: adminUsers, error: adminError } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('role', 'admin')
          .not('email', 'is', null);

        if (!adminError && adminUsers && adminUsers.length > 0) {
          console.log(`📧 Envoi notification à ${adminUsers.length} admin(s)...`);
          
          for (const admin of adminUsers) {
            try {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'identity_document_received',
                  to: admin.email,
                  data: {
                    adminName: admin.first_name || 'Administrateur',
                    userName: userProfile?.first_name && userProfile?.last_name 
                      ? `${userProfile.first_name} ${userProfile.last_name}` 
                      : userProfile?.first_name || 'Utilisateur',
                    userEmail: userProfile?.email || '',
                    documentType: documentType,
                    siteUrl: 'https://akwahome.com'
                  }
                }
              });
              console.log(`✅ Email envoyé à l'admin: ${admin.email}`);
              
              // Délai pour éviter le rate limit
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (emailError) {
              console.error(`❌ Erreur envoi email admin ${admin.email}:`, emailError);
            }
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur lors de l\'envoi des emails:', emailError);
        // Ne pas faire échouer l'upload si l'email échoue
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
