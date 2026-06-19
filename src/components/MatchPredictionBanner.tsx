import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { isMatchPredictionHomeBannerVisible } from '../constants/matchPrediction';

const MatchPredictionBanner: React.FC = () => {
  const navigation = useNavigation();

  if (!isMatchPredictionHomeBannerVisible()) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('MatchPrediction' as never)}
    >
      <View style={styles.glowOrange} />
      <View style={styles.glowGreen} />
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>🏆</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.kicker}>Concours · Coupe du Monde 2026</Text>
          <Text style={styles.title} numberOfLines={2}>
            Pronostique <Text style={styles.highlight}>🇩🇪 vs 🇨🇮</Text> · 1 nuit à gagner 🎁
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
  },
  glowOrange: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF7900',
    opacity: 0.2,
  },
  glowGreen: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#009E60',
    opacity: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
  },
  title: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 18,
  },
  highlight: {
    color: '#FF7900',
  },
});

export default MatchPredictionBanner;
