import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  PixelRatio,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';

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
  /** Champ seul, posé sur le carrousel. */
  placement?: 'below' | 'overlay';
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onSearchPress,
  topInset = 0,
  destination,
  placement = 'below',
}) => {
  const { height } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();
  const { t } = useLanguage();

  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintTranslate = useRef(new Animated.Value(0)).current;

  const [hintIndex, setHintIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const veryCompact = height < 600;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

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

  const heroHeight = useMemo(() => {
    const fontBoost = fontScale > 1.1 ? Math.round((fontScale - 1) * 28) : 0;
    return 152 + fontBoost;
  }, [fontScale]);

  const destinationLabel = destination?.trim();
  const showHint = !destinationLabel;

  const searchField = (
    <TouchableOpacity
      style={styles.searchField}
      onPress={onSearchPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('home.openSearch')}
    >
      <Ionicons name="search" size={16} color="#0f172a" />
      <View style={styles.searchTextCol}>
        {destinationLabel ? (
          <Text style={styles.searchTitle} numberOfLines={1}>
            {destinationLabel}
          </Text>
        ) : (
          <View style={styles.searchHintRow}>
            <Text style={styles.searchTitle} numberOfLines={1}>
              {t('search.whereToGo')}
            </Text>
            {showHint ? (
              <Animated.Text
                style={[styles.searchHint, { opacity: hintOpacity, transform: [{ translateY: hintTranslate }] }]}
                numberOfLines={1}
              >
                {DESTINATION_HINTS[hintIndex]}
              </Animated.Text>
            ) : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (placement === 'overlay') {
    return <View style={styles.searchWrapOverlay}>{searchField}</View>;
  }

  return (
    <View>
      <View style={[styles.container, { height: heroHeight }]} collapsable={false}>
        <View style={[styles.imageClip, { height: heroHeight }]} collapsable={false}>
          <Image
            source={HERO_SOURCE}
            style={{ width: '100%', height: heroHeight }}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
          />
        </View>
        <View pointerEvents="none" style={styles.shadeBase} />
        <View pointerEvents="none" style={styles.shadeBottom} />
        <View style={[styles.titleWrap, topInset > 0 && { paddingTop: topInset }]}>
          <Text style={[styles.title, { fontSize: veryCompact ? 22 : 24 }]}>{t('home.findYour')}</Text>
          <Text style={[styles.title, { fontSize: veryCompact ? 22 : 24 }]}>{t('home.perfectStay')}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>{searchField}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 0,
    paddingBottom: 0,
    marginHorizontal: 0,
    position: 'relative',
    backgroundColor: '#1e293b',
    borderRadius: 0,
    overflow: 'hidden',
  },
  imageClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  shadeBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  shadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  titleWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
  title: {
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  searchWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchWrapOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchTextCol: {
    flex: 1,
    minWidth: 0,
  },
  searchHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  searchHint: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
  },
});
