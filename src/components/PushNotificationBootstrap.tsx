import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

/**
 * iOS / Android 13+ : l’app n’apparaît souvent pas dans Réglages → Notifications tant que
 * le système n’a jamais reçu de demande d’autorisation. Avant, seul le switch Paramètres
 * de l’app appelait requestPermissions — les utilisateurs qui ne l’ouvraient jamais n’étaient
 * pas enregistrés côté OS.
 *
 * Au premier état « undetermined » après connexion, on déclenche une demande unique
 * (comportement OS) ; si l’utilisateur accepte, on enregistre le token Expo comme dans
 * usePushNotifications.enablePush.
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
          if (before === 'denied' || before === 'granted') return;

          const { status: after } = await Notifications.requestPermissionsAsync();
          if (cancelled) return;
          if (after !== 'granted') return;

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
