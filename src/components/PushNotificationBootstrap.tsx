import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

/**
 * iOS / Android 13+ : enregistre ou met à jour le token Expo push après connexion.
 * - Premier lancement : si permission « undetermined », demande puis enregistrement.
 * - Déjà « granted » : enregistrement quand même (mise à jour App Store / nouveau binaire :
 *   l’ancien token en base peut ne plus être valide ; avant on ignorait ce cas).
 */
export function PushNotificationBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          if (cancelled || !Device.isDevice) return;

          const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
          if (!projectId) {
            console.warn('[PushNotificationBootstrap] extra.eas.projectId manquant');
            return;
          }

          const { status: before } = await Notifications.getPermissionsAsync();
          if (cancelled) return;
          if (before === 'denied') return;

          const persistExpoPushToken = async () => {
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const token = tokenData.data;
            if (!token || cancelled) return;
            const { error } = await supabase
              .from('profiles')
              .update({
                expo_push_token: token,
                push_notifications_enabled: true,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id);
            if (error) {
              console.warn('[PushNotificationBootstrap] Sauvegarde token:', error.message);
            }
          };

          // Déjà autorisé (ex. après passage TestFlight → App Store) : il faut quand même
          // rafraîchir le token — un nouveau binaire peut invalider l’ancien enregistré en base.
          if (before === 'granted') {
            await persistExpoPushToken();
            return;
          }

          const { status: after } = await Notifications.requestPermissionsAsync();
          if (cancelled) return;
          if (after !== 'granted') return;

          await persistExpoPushToken();
        } catch (e) {
          console.warn('[PushNotificationBootstrap]', e);
        }
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [user?.id]);

  return null;
}
