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
} from 'react-native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { checkPaymentStatus } from '../services/cardPaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';

const POLL_INTERVAL_MS = 2500;
const PAYMENT_SUCCESS_PATH = 'payment-success';
const MAX_POLL_ATTEMPTS = 6;
const SHOW_CLOSE_AFTER_MS = 15000;

type PendingPayment = { type: 'checkout_token'; value: string; bookingType: string } | { type: 'booking_id'; value: string; bookingType: string };

function parsePaymentSuccessFromUrl(url: string): PendingPayment | null {
  try {
    if (!url || !url.includes(PAYMENT_SUCCESS_PATH)) return null;
    const bookingTypeMatch = url.match(/booking_type=([^&]+)/);
    const bookingType = bookingTypeMatch ? decodeURIComponent(bookingTypeMatch[1]) : 'property';
    const tokenMatch = url.match(/checkout_token=([^&]+)/);
    if (tokenMatch) return { type: 'checkout_token', value: decodeURIComponent(tokenMatch[1]), bookingType };
    const bookingMatch = url.match(/booking_id=([^&]+)/);
    if (bookingMatch) return { type: 'booking_id', value: decodeURIComponent(bookingMatch[1]), bookingType };
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
        ...(payload.type === 'checkout_token' ? { checkout_token: payload.value } : { booking_id: payload.value }),
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

  useEffect(() => {
    if (!pendingPayment) return;
    let cancelled = false;
    pollDoneRef.current = false;
    let attempts = 0;
    let lastErrorMsg = '';
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      if (pollDoneRef.current || cancelled) return;
      const result = await checkPayment(pendingPayment);
      if (cancelled) return;
      if (result.paid) {
        pollDoneRef.current = true;
        setStatus('success');
        setMessage(pendingPayment.bookingType === 'vehicle'
          ? (pendingPayment.type === 'booking_id'
            ? 'Paiement confirmé ! Votre modification de réservation véhicule a bien été enregistrée.'
            : 'Paiement confirmé ! Votre réservation véhicule a bien été enregistrée. Vous recevrez une confirmation par email.')
          : pendingPayment.type === 'booking_id'
            ? 'Paiement confirmé ! Votre modification a bien été enregistrée.'
            : 'Paiement confirmé ! Vous recevrez un email de confirmation.');
        return;
      }
      if (result.error) lastErrorMsg = result.error;
      attempts += 1;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        pollDoneRef.current = true;
        setStatus('error');
        setMessage(lastErrorMsg || 'La vérification a échoué. Consultez « Mes réservations » pour confirmer votre paiement.');
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
    const parsed = parsePaymentSuccessFromUrl(url);
    if (parsed) setPendingPayment(parsed);
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
    const wasVehicleInitial = pendingPayment?.bookingType === 'vehicle' && pendingPayment?.type === 'checkout_token';
    setPendingPayment(null);
    setStatus('checking');
    setMessage('Vérification du paiement en cours...');
    setShowCloseAnyway(false);
    if (!wasVehicleInitial && navigationRef?.current) {
      navigationRef.current.navigate('Home' as never, { screen: 'BookingsTab' } as never);
    }
  }, [navigationRef, pendingPayment]);

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
                <Text style={styles.buttonText}>Voir mes réservations</Text>
              </TouchableOpacity>
            </>
          )}
          {status === 'error' && (
            <>
              <Text style={styles.errorTitle}>Vérification impossible</Text>
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
