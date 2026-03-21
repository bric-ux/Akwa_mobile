/**
 * Handler dédié au retour Wave (réservation initiale logement ou véhicule).
 * Délais importants pour éviter le gel au retour depuis le navigateur.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  AppState,
  AppStateStatus,
  InteractionManager,
  Platform,
} from 'react-native';
import { checkPaymentStatus } from '../services/cardPaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';

const POLL_INTERVAL_MS = 2500;
const PAYMENT_SUCCESS_PATH = 'payment-success';
const MAX_POLL_ATTEMPTS = 10;
const SHOW_CLOSE_AFTER_MS = 15000;
/** Délai avant d'afficher le modal : laisser l'app stabiliser après le deep link */
const DEFER_MS = Platform.OS === 'ios' ? 900 : 1000;
/** Délai supplémentaire quand l'app revient de background (AppState active) */
const DEFER_APP_STATE_MS = 400;

type PendingPayment = { type: 'checkout_token'; value: string; bookingType: string; wave?: boolean };

function parseWavePaymentSuccessFromUrl(url: string): PendingPayment | null {
  try {
    if (!url || !url.includes(PAYMENT_SUCCESS_PATH)) return null;
    const waveMatch = url.match(/[?&]wave=([^&]+)/);
    if (!waveMatch || !['1', 'true', 'yes'].includes(String(waveMatch[1]).toLowerCase())) return null;
    const bookingTypeMatch = url.match(/booking_type=([^&]+)/);
    const bookingType = bookingTypeMatch ? decodeURIComponent(bookingTypeMatch[1]) : 'property';
    const tokenMatch = url.match(/checkout_token=([^&]+)/);
    if (!tokenMatch) return null;
    return { type: 'checkout_token', value: decodeURIComponent(tokenMatch[1]), bookingType, wave: true };
  } catch {
    return null;
  }
}

export default function WaveReturnHandler() {
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState<string>('Vérification du paiement en cours...');
  const [showCloseAnyway, setShowCloseAnyway] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const pollDoneRef = useRef(false);
  const lastProcessedUrlRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkPayment = useCallback(async (payload: PendingPayment): Promise<{ paid: boolean; error?: string }> => {
    try {
      const result = await checkPaymentStatus({
        booking_type: (payload.bookingType as 'property' | 'vehicle') || 'property',
        payment_type: 'booking',
        checkout_token: payload.value,
        wave: true,
      });
      if (result.error) return { paid: false, error: result.error };
      return { paid: result.is_confirmed };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Erreur de connexion. Réessayez.';
      return { paid: false, error: errMsg };
    }
  }, []);

  useEffect(() => {
    if (!pendingPayment) return;
    let cancelled = false;
    pollDoneRef.current = false;
    let attempts = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      if (pollDoneRef.current || cancelled) return;
      const result = await checkPayment(pendingPayment);
      if (cancelled) return;
      if (result.paid) {
        pollDoneRef.current = true;
        setStatus('success');
        setMessage(pendingPayment.bookingType === 'vehicle'
          ? 'Paiement confirmé ! Votre réservation véhicule a bien été enregistrée. Vous recevrez une confirmation par email.'
          : 'Paiement confirmé ! Vous recevrez un email de confirmation.');
        return;
      }
      attempts += 1;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        pollDoneRef.current = true;
        setStatus('error');
        setMessage('Votre paiement a peut-être déjà été enregistré. Consultez « Mes réservations » pour vérifier.');
      }
    };
    // Délai initial avant le premier poll : laisser le modal s'afficher complètement
    const startTimeout = setTimeout(() => {
      if (cancelled) return;
      poll();
      intervalId = setInterval(() => {
        if (cancelled || pollDoneRef.current) return;
        poll();
      }, POLL_INTERVAL_MS);
    }, 400);
    const closeTimer = setTimeout(() => {
      if (!cancelled) setShowCloseAnyway(true);
    }, SHOW_CLOSE_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
      if (intervalId) clearInterval(intervalId);
      clearTimeout(closeTimer);
    };
  }, [pendingPayment, checkPayment, retryKey]);

  const handleOpenUrl = useCallback((url: string | null, fromAppState = false) => {
    if (!url) return;
    if (lastProcessedUrlRef.current === url) return;
    const parsed = parseWavePaymentSuccessFromUrl(url);
    if (!parsed) return;

    const apply = () => {
      if (lastProcessedUrlRef.current === url) return;
      lastProcessedUrlRef.current = url;
      setPendingPayment(parsed);
    };

    // Délai plus long quand l'app revient de background (clic bouton wave-return)
    const delay = fromAppState ? DEFER_MS + DEFER_APP_STATE_MS : DEFER_MS;

    // 1. InteractionManager : attendre la fin des animations en cours
    // 2. requestAnimationFrame : laisser un frame se peindre
    // 3. setTimeout : délai pour que l'app soit pleinement opérationnelle
    InteractionManager.runAfterInteractions(() => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          setTimeout(apply, delay);
        });
      } else {
        setTimeout(apply, delay);
      }
    });
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => handleOpenUrl(url, false));
    const sub = Linking.addEventListener('url', ({ url }) => handleOpenUrl(url, false));
    return () => sub.remove();
  }, [handleOpenUrl]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (wasBackground && nextState === 'active') {
        Linking.getInitialURL().then((url) => handleOpenUrl(url, true));
      }
    });
    return () => subscription.remove();
  }, [handleOpenUrl]);

  const closeModal = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        setPendingPayment(null);
        setStatus('checking');
        setMessage('Vérification du paiement en cours...');
        setShowCloseAnyway(false);
      }, 200);
    });
  }, []);

  const retryVerification = useCallback(() => {
    setStatus('checking');
    setMessage('Vérification du paiement en cours...');
    setShowCloseAnyway(false);
    setRetryKey((k) => k + 1);
  }, []);

  if (!pendingPayment) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={styles.overlay}>
        <View style={styles.box}>
          {status === 'checking' && (
            <>
              <ActivityIndicator size="large" color="#e67e22" />
              <Text style={styles.title}>Vérification du paiement</Text>
              <Text style={styles.message}>{message}</Text>
              {showCloseAnyway && (
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={closeModal}>
                  <Text style={styles.buttonSecondaryText}>Fermer et vérifier plus tard dans Mes réservations</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {status === 'success' && (
            <>
              <CardPaymentSuccessView subtitle={message} style={styles.successViewBox} />
              <TouchableOpacity style={styles.button} onPress={closeModal}>
                <Text style={styles.buttonText}>Voir mes réservations</Text>
              </TouchableOpacity>
            </>
          )}
          {status === 'error' && (
            <>
              <Text style={styles.errorTitle}>Consultez « Mes réservations »</Text>
              <Text style={styles.message}>{message}</Text>
              <TouchableOpacity style={styles.button} onPress={retryVerification}>
                <Text style={styles.buttonText}>Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={closeModal}>
                <Text style={styles.buttonSecondaryText}>Fermer et vérifier dans Mes réservations</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    minWidth: 280,
  },
  successViewBox: {
    margin: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#c0392b',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#e67e22',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e67e22',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#e67e22',
    fontSize: 16,
    fontWeight: '600',
  },
});
