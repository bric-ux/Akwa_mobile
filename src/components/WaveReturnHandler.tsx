/**
 * Handler dédié au retour Wave (réservation initiale logement ou véhicule).
 * Comme Stripe : aucune UI (pas de Modal, pas d'Alert) pour éviter le gel.
 * L'utilisateur consulte « Mes réservations » manuellement.
 * Le BookingModal (si encore ouvert) gère la vérification via son propre polling.
 */
import React, { useEffect, useCallback, useRef } from 'react';
import { Linking, AppState, AppStateStatus } from 'react-native';

function isWaveReturnUrl(url: string): boolean {
  try {
    if (!url) return false;
    const waveMatch = url.match(/[?&]wave=([^&]+)/);
    if (!waveMatch || !['1', 'true', 'yes'].includes(String(waveMatch[1]).toLowerCase())) return false;
    const tokenMatch = url.match(/checkout_token=([^&]+)/);
    return !!tokenMatch;
  } catch {
    return false;
  }
}

export default function WaveReturnHandler() {
  const lastProcessedUrlRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const handleOpenUrl = useCallback((url: string | null) => {
    if (!url || !isWaveReturnUrl(url)) return;
    if (lastProcessedUrlRef.current === url) return;
    lastProcessedUrlRef.current = url;
    // Ne rien faire : pas de Modal, pas d'Alert. Comportement identique à Stripe.
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleOpenUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleOpenUrl(url));
    return () => sub.remove();
  }, [handleOpenUrl]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (wasBackground && nextState === 'active') {
        Linking.getInitialURL().then(handleOpenUrl);
      }
    });
    return () => subscription.remove();
  }, [handleOpenUrl]);

  return null;
}
