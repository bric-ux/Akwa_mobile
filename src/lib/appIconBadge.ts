import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Pastille / badge sur l’icône de l’app (écran d’accueil du téléphone).
 * iOS : fiabilité élevée. Android : dépend du lanceur (Samsung, Pixel, etc.).
 */
export async function setAppIconBadgeCount(count: number): Promise<void> {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  try {
    await Notifications.setBadgeCountAsync(n);
  } catch (e) {
    if (__DEV__) console.warn('[appIconBadge] setBadgeCountAsync:', e);
  }
}

/** Canal Android avec pastille d’icône activée. */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications AkwaHome',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e67e22',
      showBadge: true,
    });
  } catch (e) {
    if (__DEV__) console.warn('[appIconBadge] channel:', e);
  }
}
