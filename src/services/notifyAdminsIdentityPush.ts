import { supabase } from './supabase';

export type NotifyAdminsIdentityPushParams = {
  documentId?: string;
  userId?: string;
  userName?: string;
  documentType?: string;
};

/**
 * Envoie une notification push à tous les administrateurs lors d'une soumission de pièce d'identité.
 */
export async function notifyAdminsIdentityDocumentPush(
  params: NotifyAdminsIdentityPushParams,
): Promise<void> {
  try {
    await supabase.functions.invoke('notify-admins-identity-push', {
      body: params,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[notifyAdminsIdentityDocumentPush] failed:', e);
    }
  }
}
