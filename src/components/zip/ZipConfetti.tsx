import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#f97316', '#ea580c', '#fbbf24', '#22c55e', '#ffffff', '#fdba74', '#fde047'];
const PARTICLE_COUNT = 56;

type Particle = {
  startX: number;
  endX: number;
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  shape: 'rect' | 'circle';
};

type Props = {
  active: boolean;
};

const ZipConfetti: React.FC<Props> = ({ active }) => {
  const { width, height } = Dimensions.get('window');
  const runningRef = useRef(false);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const startX = Math.random() * width;
      const drift = (Math.random() - 0.5) * width * 0.55;
      return {
        startX,
        endX: startX + drift,
        x: new Animated.Value(startX),
        y: new Animated.Value(-20 - Math.random() * 80),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        shape: Math.random() > 0.45 ? 'rect' : 'circle',
      };
    });
  }, [width]);

  useEffect(() => {
    if (!active) {
      runningRef.current = false;
      return;
    }
    if (runningRef.current) return;

    runningRef.current = true;

    particles.forEach((p, i) => {
      const delay = (i % 12) * 35;
      const fall = height + 80 + Math.random() * 120;

      p.x.setValue(p.startX);
      p.y.setValue(-20 - Math.random() * 80);
      p.rotate.setValue(0);
      p.opacity.setValue(1);

      Animated.parallel([
        Animated.timing(p.y, {
          toValue: fall,
          duration: 2200 + Math.random() * 1800,
          delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: p.endX,
          duration: 2600 + Math.random() * 1400,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: 3 + Math.random() * 5,
          duration: 2400,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(delay + 1600),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });

    const t = setTimeout(() => {
      runningRef.current = false;
    }, 4500);

    return () => clearTimeout(t);
  }, [active, height, particles]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            p.shape === 'circle' ? styles.circle : styles.rect,
            {
              backgroundColor: p.color,
              width: p.size,
              height: p.shape === 'circle' ? p.size : p.size * 0.45,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                {
                  rotate: p.rotate.interpolate({
                    inputRange: [0, 8],
                    outputRange: ['0deg', '720deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  rect: { position: 'absolute', borderRadius: 2 },
  circle: { position: 'absolute', borderRadius: 999 },
});

export default ZipConfetti;
