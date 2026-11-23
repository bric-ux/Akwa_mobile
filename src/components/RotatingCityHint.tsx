import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo, type StyleProp, type TextStyle } from 'react-native';

const DESTINATION_HINTS = [
  'Abidjan',
  'Assinie',
  'Grand-Bassam',
  'Bouaké',
  'Yamoussoukro',
  'San-Pédro',
  'Man',
  'Korhogo',
] as const;

/** Ville qui s’efface puis laisse place à la suivante, comme la barre d’accueil. */
export function RotatingCityHint({
  style,
  active = true,
}: {
  style?: StyleProp<TextStyle>;
  active?: boolean;
}) {
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintTranslate = useRef(new Animated.Value(0)).current;
  const [hintIndex, setHintIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) return;

    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(hintOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(hintTranslate, {
          toValue: -8,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setHintIndex((current) => (current + 1) % DESTINATION_HINTS.length);
        hintTranslate.setValue(10);
        Animated.parallel([
          Animated.timing(hintOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(hintTranslate, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [active, hintOpacity, hintTranslate, reduceMotion]);

  return (
    <Animated.Text
      style={[style, { opacity: hintOpacity, transform: [{ translateY: hintTranslate }] }]}
      numberOfLines={1}
    >
      {DESTINATION_HINTS[hintIndex]}
    </Animated.Text>
  );
}
