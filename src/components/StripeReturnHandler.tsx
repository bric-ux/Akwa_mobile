import React, { useEffect, useState, useCallback } from 'react';
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
import { supabase } from '../services/supabase';

const POLL_INTERVAL_MS = 2500;
const PAYMENT_SUCCESS_PATH = 'payment-success';

type PendingPayment = { type: 'checkout_token'; value: string } | { type: 'booking_id'; value: string; bookingType: string };

function parsePaymentSuccessFromUrl(url: string): PendingPayment | null {
  try {
    if (!url || !url.includes(PAYMENT_SUCCESS_PATH)) return null;
    const tokenMatch = url.match(/checkout_token=([^&]+)/);
    if (tokenMatch) return { type: 'checkout_token', value: decodeURIComponent(tokenMatch[1]) };
    const bookingMatch = url.match(/booking_id=([^&]+)/);
    if (bookingMatch) {
      const bookingTypeMatch = url.match(/booking_type=([^&]+)/);
      const bookingType = bookingTypeMatch ? decodeURIComponent(bookingTypeMatch[1]) : 'property';
      return { type: 'booking_id', value: decodeURIComponent(bookingMatch[1]), bookingType };
    }
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

  const checkPayment = useCallback(async (payload: PendingPayment): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const body: Record<string, unknown> = {
        booking_type: payload.type === 'checkout_token' ? 'property' : payload.bookingType,
      };
      if (payload.type === 'checkout_token') body.checkout_token = payload.value;
      else body.booking_id = payload.value;
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      if (error) return false;
      const ps = data?.payment_status != null ? String(data.payment_status).toLowerCase() : '';
      const bs = data?.booking_status != null ? String(data.booking_status).toLowerCase() : '';
      if (data?.is_confirmed === true) return true;
      if (['completed', 'succeeded', 'paid'].includes(ps) || ['confirmed', 'completed'].includes(bs)) return true;
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!pendingPayment) return;
    let cancelled = false;
    const poll = async () => {
      const paid = await checkPayment(pendingPayment);
      if (cancelled) return;
      if (paid) {
        setStatus('success');
        setMessage(pendingPayment.type === 'booking_id'
          ? (pendingPayment.bookingType === 'vehicle'
            ? 'Paiement confirmé ! Votre modification de réservation véhicule a bien été enregistrée.'
            : 'Paiement confirmé ! Votre modification a bien été enregistrée.')
          : 'Paiement confirmé ! Vous recevrez un email de confirmation.');
        return;
      }
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingPayment, checkPayment]);

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
    setPendingPayment(null);
    setStatus('checking');
    setMessage('Vérification du paiement en cours...');
    if (navigationRef?.current) {
      navigationRef.current.navigate('Home' as never, { screen: 'BookingsTab' } as never);
    }
  }, [navigationRef]);

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
            </>
          )}
          {status === 'success' && (
            <>
              <Text style={styles.successTitle}>Paiement confirmé</Text>
              <Text style={styles.message}>{message}</Text>
              <TouchableOpacity style={styles.button} onPress={closeModal}>
                <Text style={styles.buttonText}>Voir mes réservations</Text>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#27ae60',
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
