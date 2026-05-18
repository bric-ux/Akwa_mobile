import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const HERO_SOURCE = require('../../assets/images/hero-cote-ivoire.jpg');

interface HeroSectionProps {
  onSearchPress?: () => void;
  /** Marge haute (safe area / header) pour éviter que le titre soit masqué sous la barre système */
  topInset?: number;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearchPress, topInset = 0 }) => {
  const { height } = useWindowDimensions();
  const fontScale = PixelRatio.getFontScale();

  /** Petits écrans : plus de hauteur hero + typo réduite pour éviter le bouton coupé par overflow. */
  const compact = height < 700;
  const veryCompact = height < 600;

  const heroMinHeight = useMemo(() => {
    const ratio = veryCompact ? 0.52 : compact ? 0.44 : 0.4;
    const raw = Math.round(height * ratio);
    const fontBoost = fontScale > 1.1 ? Math.round((fontScale - 1) * 56) : 0;
    const androidBoost = Platform.OS === 'android' ? 28 : 0;
    const base = veryCompact ? 268 : compact ? 248 : 220;
    return Math.max(raw, base) + fontBoost + androidBoost;
  }, [height, compact, veryCompact, fontScale]);

  const dynamic = useMemo(() => {
    const baseTaglineMb = veryCompact ? 12 : compact ? 18 : 32;
    const taglineMarginBottom =
      fontScale > 1.12 ? Math.max(8, Math.round(baseTaglineMb / Math.min(fontScale, 1.45))) : baseTaglineMb;
    const scaledSearchText =
      fontScale > 1.15
        ? Math.max(12, Math.round((veryCompact ? 14 : compact ? 15 : 16) / Math.min(fontScale, 1.35)))
        : veryCompact
          ? 14
          : compact
            ? 15
            : 16;
    return {
      titleSize: veryCompact ? 24 : compact ? 28 : 32,
      titleMarginBottom: veryCompact ? 8 : compact ? 12 : 16,
      subtitleSize: veryCompact ? 14 : compact ? 16 : 18,
      subtitleLineHeight: veryCompact ? 20 : compact ? 22 : 24,
      taglineSize: veryCompact ? 13 : compact ? 15 : 16,
      taglineMarginBottom,
      searchPadV: veryCompact ? 12 : compact ? 14 : 16,
      searchPadH: veryCompact ? 14 : compact ? 18 : 24,
      searchTextSize: scaledSearchText,
      iconSize: veryCompact ? 18 : 20,
    };
  }, [compact, veryCompact, fontScale]);

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
          { minHeight: heroMinHeight },
          Platform.OS === 'android' && styles.overlayAndroid,
          topInset > 0 && { paddingTop: Math.max(12, topInset) },
        ]}
      >
        <View style={styles.content}>
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

            <TouchableOpacity
              style={[
                styles.searchButton,
                {
                  paddingVertical: dynamic.searchPadV,
                  paddingHorizontal: dynamic.searchPadH,
                },
              ]}
              onPress={onSearchPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Rechercher un hébergement"
            >
              <Ionicons name="search" size={dynamic.iconSize} color="#fff" />
              <Text
                style={[styles.searchButtonText, { fontSize: dynamic.searchTextSize }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                Rechercher un hébergement
              </Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  /** Android : marges verticales un peu plus larges (police système / encoches variables). */
  overlayAndroid: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 420,
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
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#22C55E',
    borderRadius: 25,
    width: '100%',
    gap: 6,
    /** iOS : ombre ; Android : pas d’elevation (sinon le bouton se superpose au header suivant, ex. widget météo). */
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
      },
      android: {
        elevation: 0,
      },
      default: {},
    }),
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
    textAlign: 'center',
  },
});
