import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  PixelRatio,
  Platform,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const HERO_SOURCE = require('../../assets/images/hero-cote-ivoire.jpg');

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

interface HeroSectionProps {
  onSearchPress?: () => void;
  /** Marge haute (safe area / header) pour éviter que le titre soit masqué sous la barre système */
  topInset?: number;
  destination?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onSearchPress,
  topInset = 0,
  destination,
}) => {
  const { height } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();

  const floatAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintTranslate = useRef(new Animated.Value(0)).current;

  const [hintIndex, setHintIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const compact = height < 700;
  const veryCompact = height < 600;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 4200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );

    const iconLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.08,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );

    floatLoop.start();
    shimmerLoop.start();
    iconLoop.start();
    glowLoop.start();

    return () => {
      floatLoop.stop();
      shimmerLoop.stop();
      iconLoop.stop();
      glowLoop.stop();
    };
  }, [floatAnim, shimmerAnim, iconScale, glowAnim, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || destination?.trim()) return;

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
  }, [destination, hintOpacity, hintTranslate, reduceMotion]);

  const heroMinHeight = useMemo(() => {
    const ratio = veryCompact ? 0.52 : compact ? 0.44 : 0.4;
    const raw = Math.round(height * ratio);
    const fontBoost = fontScale > 1.1 ? Math.round((fontScale - 1) * 56) : 0;
    const androidBoost = Platform.OS === 'android' ? 28 : 0;
    const base = veryCompact ? 268 : compact ? 248 : 220;
    return Math.max(raw, base) + fontBoost + androidBoost;
  }, [height, compact, veryCompact, fontScale]);

  const dynamic = useMemo(() => {
    const baseTaglineMb = veryCompact ? 8 : compact ? 12 : 16;
    return {
      titleSize: veryCompact ? 24 : compact ? 28 : 32,
      titleMarginBottom: veryCompact ? 8 : compact ? 12 : 16,
      subtitleSize: veryCompact ? 14 : compact ? 16 : 18,
      subtitleLineHeight: veryCompact ? 20 : compact ? 22 : 24,
      taglineSize: veryCompact ? 13 : compact ? 15 : 16,
      taglineMarginBottom: baseTaglineMb,
    };
  }, [compact, veryCompact]);

  const destinationLabel = destination?.trim();
  const showHint = !destinationLabel;

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 220],
  });

  const glowShadow = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 18],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.42],
  });

  return (
    <View style={[styles.container, { minHeight: heroMinHeight }]}>
      <View style={styles.imageClip}>
        <Image
          source={HERO_SOURCE}
          style={styles.backgroundImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={200}
        />
      </View>
      <View
        style={[
          styles.overlay,
          {
            minHeight: heroMinHeight,
            height: heroMinHeight,
          },
          Platform.OS === 'android' && styles.overlayAndroid,
          topInset > 0 && { paddingTop: Math.max(12, topInset) },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { fontSize: dynamic.titleSize }]}>Trouvez votre</Text>
            <Text
              style={[
                styles.titleGradient,
                { fontSize: dynamic.titleSize, marginBottom: dynamic.titleMarginBottom },
              ]}
            >
              séjour parfait
            </Text>
            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: dynamic.subtitleSize,
                  lineHeight: dynamic.subtitleLineHeight,
                  marginBottom: veryCompact ? 4 : 8,
                },
              ]}
            >
              Découvrez des logements uniques en Côte d'Ivoire
            </Text>
            <Text
              style={[
                styles.tagline,
                { fontSize: dynamic.taglineSize, marginBottom: dynamic.taglineMarginBottom },
              ]}
            >
              Ici c'est chez vous !
            </Text>
          </View>

          <Animated.View
            style={[
              styles.searchPillOuter,
              !reduceMotion && { transform: [{ translateY: floatAnim }] },
            ]}
          >
            <Animated.View
              style={[
                styles.searchPillGlow,
                !reduceMotion && {
                  shadowRadius: glowShadow,
                  shadowOpacity: glowOpacity,
                },
              ]}
            />

            <TouchableOpacity
              style={styles.searchPillTouchable}
              onPress={onSearchPress}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir la recherche"
            >
              <View style={styles.searchPill}>
                {!reduceMotion && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.searchPillShimmer,
                      { transform: [{ translateX: shimmerTranslate }, { skewX: '-16deg' }] },
                    ]}
                  />
                )}

                <View style={styles.searchPillTextCol}>
                  {destinationLabel ? (
                    <Text style={styles.searchPillTitle} numberOfLines={1}>
                      {destinationLabel}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.searchPillTitle} numberOfLines={1}>
                        Où allez-vous ?
                      </Text>
                      {showHint && (
                        <Animated.View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            opacity: hintOpacity,
                            transform: [{ translateY: hintTranslate }],
                          }}
                        >
                          <Text style={styles.searchPillHintDot}>·</Text>
                          <Text style={styles.searchPillHint} numberOfLines={1}>
                            {DESTINATION_HINTS[hintIndex]}
                          </Text>
                        </Animated.View>
                      )}
                    </>
                  )}
                </View>

                <Animated.View
                  style={[
                    styles.searchIconCircle,
                    !reduceMotion && { transform: [{ scale: iconScale }] },
                  ]}
                >
                  <Ionicons name="search" size={20} color="#fff" />
                </Animated.View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 10,
    paddingBottom: 0,
    position: 'relative',
    backgroundColor: '#1e293b',
  },
  imageClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'stretch',
    paddingTop: 16,
    paddingBottom: 16,
  },
  overlayAndroid: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  titleBlock: {
    alignItems: 'center',
    flexShrink: 1,
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleGradient: {
    fontWeight: 'bold',
    color: '#F97316',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    color: '#F97316',
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  searchPillOuter: {
    width: '100%',
    marginTop: 12,
    position: 'relative',
  },
  searchPillGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    margin: -3,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(45, 212, 191, 0.65)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    ...Platform.select({
      ios: {
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  searchPillTouchable: {
    width: '100%',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  searchPillShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  searchPillTextCol: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingRight: 4,
  },
  searchPillTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  searchPillHintDot: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  searchPillHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    flexShrink: 1,
  },
  searchIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
});
