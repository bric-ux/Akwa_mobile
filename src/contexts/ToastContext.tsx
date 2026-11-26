import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../services/AuthContext';

type ToastType = 'success' | 'error' | 'info' | 'teddy';

type ToastState = {
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const teddyAsset = require('../../assets/teddy.png');

const ToastContext = createContext<ToastContextValue | null>(null);

function TeddyAuthMoments() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const primed = useRef(false);
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const nextId = user?.id ?? null;
    if (!primed.current) {
      primed.current = true;
      prevUserId.current = nextId;
      return;
    }

    const prevId = prevUserId.current;
    prevUserId.current = nextId;
    if (prevId === nextId) return;

    if (!prevId && nextId) {
      showToast('Bonne arrivée !', 'teddy');
      return;
    }
    if (prevId && !nextId) {
      showToast('À bientôt !', 'teddy');
    }
  }, [loading, user, showToast]);

  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, type });
      opacity.setValue(0);
      scale.setValue(type === 'teddy' ? 0.86 : 1);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        type === 'teddy'
          ? Animated.spring(scale, {
              toValue: 1,
              friction: 6,
              tension: 120,
              useNativeDriver: true,
            })
          : Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setToast(null);
          },
        );
      }, type === 'teddy' ? 3400 : 2800);
    },
    [opacity, scale],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);
  const isTeddy = toast?.type === 'teddy';
  const bg =
    toast?.type === 'success'
      ? '#0B3A2E'
      : toast?.type === 'error'
        ? '#b91c1c'
        : toast?.type === 'teddy'
          ? '#fff'
          : '#1f2937';

  return (
    <ToastContext.Provider value={value}>
      {children}
      <TeddyAuthMoments />
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            isTeddy && styles.wrapTeddy,
            {
              bottom: insets.bottom + 72,
              opacity,
              transform: [{ scale }],
              backgroundColor: bg,
            },
          ]}
        >
          {isTeddy ? (
            <View style={styles.teddyRow}>
              <Image source={teddyAsset} style={styles.teddyFace} />
              <Text style={styles.teddyText}>{toast.message}</Text>
            </View>
          ) : (
            <Text style={styles.text}>{toast.message}</Text>
          )}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
    maxWidth: 380,
    alignSelf: 'center',
  },
  wrapTeddy: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
  },
  teddyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teddyFace: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
  },
  teddyText: {
    flex: 1,
    color: '#14532d',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
});
