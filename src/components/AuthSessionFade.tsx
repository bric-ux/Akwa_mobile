import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useAuth } from '../services/AuthContext';

/**
 * Fondu léger quand la session passe invité ↔ connecté (évite le basculement brutal).
 */
export const AuthSessionFade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const opacity = useRef(new Animated.Value(1)).current;
  const sessionKey = user?.id ?? 'guest';
  const prevKey = useRef(sessionKey);
  const isFirstPaint = useRef(true);

  useEffect(() => {
    if (loading) return;
    if (isFirstPaint.current) {
      isFirstPaint.current = false;
      prevKey.current = sessionKey;
      return;
    }
    if (prevKey.current === sessionKey) return;
    prevKey.current = sessionKey;

    opacity.setValue(0.88);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [sessionKey, loading, opacity]);

  return <Animated.View style={[styles.fill, { opacity }]}>{children}</Animated.View>;
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

export default AuthSessionFade;
