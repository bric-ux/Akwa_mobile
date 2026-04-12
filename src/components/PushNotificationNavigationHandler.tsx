import React, { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRef } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import type { RootStackParamList } from '../types';
import {
  navigateFromPushData,
  getNotificationAgeMs,
} from '../services/pushNavigation';

type Props = {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};

/** Ignorer une « dernière notif » trop ancienne (ouverture app depuis l’icône alors qu’une vieille notif est encore « last »). */
const MAX_AGE_LAST_RESPONSE_MS = 600_000;

/**
 * Au tap sur une push : ouvre l’écran adapté (messages, détail résa logement ou véhicule).
 * Nécessite que les envois incluent `data` (type + ids) via sendPushToUser.
 */
export function PushNotificationNavigationHandler({ navigationRef }: Props) {
  const { user } = useAuth();
  const handledIds = useRef(new Set<string>());
  const coldStartDone = useRef(false);

  const tryHandle = useCallback(
    (response: Notifications.NotificationResponse, options?: { allowStale?: boolean }) => {
      if (!user?.id) return;

      const id = response.notification.request.identifier;
      if (handledIds.current.has(id)) return;

      if (!options?.allowStale) {
        const d = response.notification.date;
        if (d != null && Number.isFinite(d)) {
          const age = getNotificationAgeMs(response.notification);
          if (age > MAX_AGE_LAST_RESPONSE_MS) return;
        }
      }

      const raw = response.notification.request.content.data;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;

      const nav = navigationRef.current;
      if (!nav?.isReady()) return;

      const done = navigateFromPushData(nav, raw as Record<string, unknown>);
      if (done) handledIds.current.add(id);
    },
    [navigationRef, user?.id]
  );

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      tryHandle(response, { allowStale: true });
    });
    return () => sub.remove();
  }, [tryHandle]);

  // Ouverture depuis une notif puis connexion, ou cold start : tenter la dernière réponse une fois l’utilisateur connu
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      const last = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || !last) return;
      tryHandle(last, { allowStale: false });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, tryHandle]);

  return null;
}
