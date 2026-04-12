/**
 * Envoie une notification push sur le téléphone de l'utilisateur (sans email).
 * Appelle l'Edge Function send-push avec le userId du destinataire.
 * Les valeurs de data sont envoyées en string (recommandé Expo / iOS).
 */
import { supabase } from './supabase';

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string | number | boolean | null | undefined>
): Promise<void> {
  if (!userId || !title) return;
  try {
    const stringData =
      data &&
      Object.fromEntries(
        Object.entries(data)
          .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
          .map(([k, v]) => [k, String(v)])
      );
    await supabase.functions.invoke('send-push', {
      body: {
        userId,
        title,
        body,
        ...(stringData && Object.keys(stringData).length > 0 ? { data: stringData } : {}),
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('[pushNotificationService] sendPushToUser failed:', e);
  }
}
