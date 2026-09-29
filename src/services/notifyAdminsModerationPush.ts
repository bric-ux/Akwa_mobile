import { supabase } from './supabase';

export type ModerationEntityType =
  | 'monthly_listing'
  | 'hotel_establishment'
  | 'vehicle'
  | 'monthly_candidature';

export type NotifyAdminsModerationPushParams = {
  entityType: ModerationEntityType;
  entityId: string;
  title?: string;
  body?: string;
  adminScreen?: string;
};

/**
 * Push Expo vers tous les admins (soumissions modération, candidatures, etc.).
 */
export async function notifyAdminsModerationPush(
  params: NotifyAdminsModerationPushParams,
): Promise<void> {
  if (!params.entityId) return;
  try {
    await supabase.functions.invoke('notify-admins-moderation-push', {
      body: params,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[notifyAdminsModerationPush] failed:', e);
    }
  }
}
