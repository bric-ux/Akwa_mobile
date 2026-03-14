/**
 * Envoie une notification push sur le téléphone de l'utilisateur (sans email).
 * Appelle l'Edge Function send-push avec le userId du destinataire.
 */
import { supabase } from './supabase';

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string | number | boolean>
): Promise<void> {
  if (!userId || !title) return;
  try {
    await supabase.functions.invoke('send-push', {
      body: { userId, title, body, data },
    });
  } catch (e) {
    if (__DEV__) console.warn('[pushNotificationService] sendPushToUser failed:', e);
  }
}
