import { useState, useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

// Comportement des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('push_notifications_enabled, expo_push_token')
        .eq('user_id', user.id)
        .maybeSingle();
      if (fetchError) {
        console.warn('[usePushNotifications] Load prefs:', fetchError.message);
        return;
      }
      setPushEnabled(data?.push_notifications_enabled ?? true);
      setExpoPushToken(data?.expo_push_token ?? null);
    } catch (e) {
      console.warn('[usePushNotifications] Load prefs error:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const registerForPushNotificationsAsync = useCallback(async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.warn('[usePushNotifications] Push notifications require a physical device');
      return null;
    }
    if (!projectId) {
      console.warn('[usePushNotifications] Missing projectId in app config (extra.eas.projectId)');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      if (finalStatus !== 'granted') {
        return null;
      }
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenData.data;
  }, [projectId]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) {
        setError('Impossible d\'activer les notifications. Vérifiez les autorisations.');
        setPushEnabled(false);
        return false;
      }
      if (!user?.id) {
        setExpoPushToken(token);
        setPushEnabled(true);
        setLoading(false);
        return true;
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          expo_push_token: token,
          push_notifications_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      setExpoPushToken(token);
      setPushEnabled(true);
      return true;
    } catch (e: any) {
      console.error('[usePushNotifications] enablePush:', e);
      setError(e?.message || 'Erreur lors de l\'activation');
      setPushEnabled(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, registerForPushNotificationsAsync]);

  const disablePush = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            expo_push_token: null,
            push_notifications_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }
      setExpoPushToken(null);
      setPushEnabled(false);
    } catch (e: any) {
      console.error('[usePushNotifications] disablePush:', e);
      setError(e?.message || 'Erreur lors de la désactivation');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const setPushPreference = useCallback(async (enabled: boolean) => {
    if (enabled) {
      return await enablePush();
    } else {
      await disablePush();
      return true;
    }
  }, [enablePush, disablePush]);

  return {
    expoPushToken,
    pushEnabled,
    loading,
    error,
    setPushPreference,
    loadPreferences,
    registerForPushNotificationsAsync,
  };
}
