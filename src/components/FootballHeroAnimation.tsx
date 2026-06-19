import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AccessibilityInfo,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import FOOTBALL_HERO_HTML from '../lib/footballHeroAnimationHtml';

const SCENE_HEIGHT = 168;

function StaticFootballHero({ width }: { width: number }) {
  return (
    <View style={[styles.staticScene, { width, height: SCENE_HEIGHT }]}>
      <View style={styles.staticGlowOrange} />
      <View style={styles.staticGlowGreen} />
      <View style={styles.staticFlagsRow}>
        <Text style={styles.staticFlag}>🇩🇪</Text>
        <View style={styles.staticVsPill}>
          <Text style={styles.staticVs}>VS</Text>
        </View>
        <Text style={styles.staticFlag}>🇨🇮</Text>
      </View>
      <Text style={styles.staticBall}>⚽</Text>
      <Text style={styles.staticCaption}>Allemagne · Côte d&apos;Ivoire · 20 juin</Text>
    </View>
  );
}

const FootballHeroAnimation: React.FC = () => {
  const { width: windowWidth } = useWindowDimensions();
  const sceneWidth = Math.min(windowWidth - 32, 420);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [webReady, setWebReady] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  if (reduceMotion) {
    return <StaticFootballHero width={sceneWidth} />;
  }

  return (
    <View style={[styles.wrap, { width: sceneWidth, height: SCENE_HEIGHT }]}>
      {!webReady ? (
        <View style={styles.placeholder}>
          <StaticFootballHero width={sceneWidth} />
        </View>
      ) : null}
      <WebView
        source={{ html: FOOTBALL_HERO_HTML, baseUrl: '' }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        pointerEvents="none"
        originWhitelist={['*']}
        androidLayerType="hardware"
        setBuiltInZoomControls={false}
        displayZoomControls={false}
        onLoadEnd={() => setWebReady(true)}
        {...(Platform.OS === 'ios'
          ? { allowsLinkPreview: false, dataDetectorTypes: 'none' as const }
          : {})}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020814',
  },
  webview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  staticScene: {
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticGlowOrange: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF7900',
    opacity: 0.22,
  },
  staticGlowGreen: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#009E60',
    opacity: 0.22,
  },
  staticFlagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  staticFlag: {
    fontSize: 42,
  },
  staticVsPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  staticVs: {
    color: '#FF7900',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
  },
  staticBall: {
    position: 'absolute',
    right: 24,
    bottom: 20,
    fontSize: 28,
    opacity: 0.9,
  },
  staticCaption: {
    position: 'absolute',
    bottom: 10,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default FootballHeroAnimation;
