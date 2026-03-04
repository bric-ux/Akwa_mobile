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

function parseCheckoutTokenFromUrl(url: string): string | null {
  try {
    if (!url || !url.includes(PAYMENT_SUCCESS_PATH)) return null;
    const match = url.match(/checkout_token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

type Props = { navigationRef?: React.RefObject<NavigationContainerRef<unknown> | null> };

export default function StripeReturnHandler({ navigationRef }: Props) {
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState<string>('Vérification du paiement en cours...');

  const checkPayment = useCallback(async (checkoutToken: string): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { checkout_token: checkoutToken, booking_type: 'property' },
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
    if (!pendingToken) return;
    let cancelled = false;
    const poll = async () => {
      const paid = await checkPayment(pendingToken);
      if (cancelled) return;
      if (paid) {
        setStatus('success');
        setMessage('Paiement confirmé ! Vous recevrez un email de confirmation.');
        return;
      }
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pendingToken, checkPayment]);

  const handleOpenUrl = useCallback((url: string | null) => {
    if (!url) return;
    const token = parseCheckoutTokenFromUrl(url);
    if (token) setPendingToken(token);
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
    setPendingToken(null);
    setStatus('checking');
    setMessage('Vérification du paiement en cours...');
    if (navigationRef?.current) {
      navigationRef.current.navigate('Home' as never, { screen: 'BookingsTab' } as never);
    }
  }, [navigationRef]);

  if (!pendingToken) return null;

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
