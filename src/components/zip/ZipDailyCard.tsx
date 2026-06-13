import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDailyPuzzle, getLocalDateKey } from '../../games/zip/puzzles';
import { formatZipTime, useZipGame } from '../../hooks/useZipGame';

const ZipDailyCard: React.FC = () => {
  const navigation = useNavigation();
  const puzzle = getDailyPuzzle();
  const puzzleDate = getLocalDateKey();
  const { myResult, leaderboard, loading } = useZipGame(puzzleDate);

  const topTime = leaderboard[0]?.time_ms;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('ZipGame' as never)}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="grid-outline" size={24} color="#fff" />
      </View>
      <View style={styles.content}>
        <Text style={styles.kicker}>Défi du jour · Zip AkwaHome</Text>
        <Text style={styles.title}>{puzzle.theme}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {puzzle.subtitle}
        </Text>
        {!loading && (
          <Text style={styles.meta}>
            {myResult
              ? `Votre temps : ${formatZipTime(myResult.time_ms)}${myResult.rank ? ` · #${myResult.rank}` : ''}`
              : topTime
                ? `Meilleur temps : ${formatZipTime(topTime)}`
                : 'Soyez le premier à jouer !'}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#fdba74" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#7c2d12',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 11, fontWeight: '700', color: '#fed7aa', textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  subtitle: { fontSize: 13, color: '#ffedd5', marginTop: 2 },
  meta: { fontSize: 12, color: '#fdba74', marginTop: 6, fontWeight: '600' },
});

export default ZipDailyCard;
