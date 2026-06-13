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
  const meta = loading
    ? null
    : myResult
      ? `${formatZipTime(myResult.time_ms)}${myResult.rank ? ` · #${myResult.rank}` : ''}`
      : topTime
        ? formatZipTime(topTime)
        : 'À vous de jouer';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => navigation.navigate('ZipGame' as never)}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="grid-outline" size={18} color="#fff" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          Zip du jour · {puzzle.theme}
        </Text>
        {!loading && meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#fdba74" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#9a3412',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#fff' },
  meta: { fontSize: 11, color: '#fed7aa', fontWeight: '600' },
});

export default ZipDailyCard;
