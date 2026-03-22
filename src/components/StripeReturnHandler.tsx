/**
 * Handler global pour le retour Stripe : UNIQUEMENT réservation initiale (logement ou véhicule).
 * Les URLs payment-success avec checkout_token = flux draft (résa créée par le webhook après paiement).
 *
 * La modification de réservation (surplus par CB) n'est PAS gérée ici : elle est gérée
 * entièrement dans ModificationSurplusPaymentModal / VehicleModificationSurplusPaymentModal
 * (flux dédié, pas de partage avec ce handler pour éviter les faux succès).
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
} from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { checkPaymentStatus } from '../services/cardPaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';

const POLL_INTERVAL_MS = 2500;
const PAYMENT_SUCCESS_PATH = 'payment-success';
/** Délai avant de traiter le deep link Stripe pour éviter le gel au retour (Stripe redirige directement vers l'app). */
const STRIPE_RETURN_DELAY_MS = 800;
const MAX_POLL_ATTEMPTS = 10; // Wave : le webhook peut prendre quelques secondes
const SHOW_CLOSE_AFTER_MS = 15000;

type PendingPayment = { type: 'checkout_token'; value: string; bookingType: string; wave?: boolean };

/** Ne traite que les URLs avec checkout_token (résa initiale). Toute URL avec booking_id est ignorée (modification = gérée par les modals). */
function parsePaymentSuccessFromUrl(url: string): PendingPayment | null {
  try {
    if (!url || !url.includes(PAYMENT_SUCCESS_PATH)) return null;
    const bookingTypeMatch = url.match(/booking_type=([^&]+)/);
    const bookingType = bookingTypeMatch ? decodeURIComponent(bookingTypeMatch[1]) : 'property';
    const tokenMatch = url.match(/checkout_token=([^&]+)/);
    const waveMatch = url.match(/[?&]wave=([^&]+)/);
    const wave = waveMatch ? ['1', 'true', 'yes'].includes(String(waveMatch[1]).toLowerCase()) : false;
    if (tokenMatch) return { type: 'checkout_token', value: decodeURIComponent(tokenMatch[1]), bookingType, wave };
    return null;
  } catch {
    return null;
  }
}

type Props = { navigationRef?: React.RefObject<NavigationContainerRef<unknown> | null> };

export default function StripeReturnHandler({ navigationRef }: Props) {
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState<string>('Vérification du paiement en cours...');

  const checkPayment = useCallback(async (payload: PendingPayment): Promise<{ paid: boolean; error?: string }> => {
    try {
      const result = await checkPaymentStatus({
        booking_type: (payload.bookingType as 'property' | 'vehicle') || 'property',
        payment_type: 'booking',
        checkout_token: payload.value,
        ...(payload.wave ? { wave: true } : {}),
      });
      if (result.error) return { paid: false, error: result.error };
      return { paid: result.is_confirmed };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Erreur de connexion. Réessayez.';
      return { paid: false, error: errMsg };
    }
  }, []);

  const [showCloseAnyway, setShowCloseAnyway] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const pollDoneRef = useRef(false);
  const lastProcessedUrlRef = useRef<string | null>(null);

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
      console.log('[DEBUG][StripeReturnHandler] Poll checkPayment result:', { paid: result.paid, error: result.error });
      if (result.paid) {
        console.log('[DEBUG][StripeReturnHandler] → Affichage succès (résa initiale)');
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
    poll();
    intervalId = setInterval(() => {
      if (cancelled || pollDoneRef.current) return;
      poll();
    }, POLL_INTERVAL_MS);
    const closeTimer = setTimeout(() => {
      if (!cancelled) setShowCloseAnyway(true);
    }, SHOW_CLOSE_AFTER_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      clearTimeout(closeTimer);
    };
  }, [pendingPayment, checkPayment, retryKey]);

  const handleOpenUrl = useCallback((url: string | null) => {
    if (!url) return;
    if (lastProcessedUrlRef.current === url) return;
    lastProcessedUrlRef.current = url;
    const parsed = parsePaymentSuccessFromUrl(url);
    if (parsed) {
      // Wave : géré par WaveReturnHandler (pas ici)
      if (parsed.wave) return;
      // Stripe : délai + InteractionManager pour éviter gel au retour (navigation directe depuis Stripe)
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => setPendingPayment(parsed), STRIPE_RETURN_DELAY_MS);
      });
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleOpenUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleOpenUrl(url));
    return () => sub.remove();
  }, [handleOpenUrl]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        Linking.getInitialURL().then(handleOpenUrl);
      }
    });
    return () => subscription.remove();
  }, [handleOpenUrl]);

  const closeModal = useCallback(() => {
    // Comme pour le véhicule : on ferme uniquement le modal, sans appeler navigate().
    // La navigation vers BookingsTab (résidence) provoquait un gel au retour par deep link.
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
    <Modal visible transparent animationType="fade">
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
                <Text style={styles.buttonText}>Fermer</Text>
              </TouchableOpacity>
              <Text style={[styles.message, { marginTop: 12, fontSize: 13 }]}>
                Consultez « Mes réservations » lorsque vous le souhaitez.
              </Text>
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
