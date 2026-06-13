import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDailyPuzzle, getLocalDateKey } from '../../games/zip/puzzles';
import { formatZipTime, useZipGame } from '../../hooks/useZipGame';
import { useAuth } from '../../services/AuthContext';
import { getLocalZipCompletion } from '../../utils/zipLocalCompletion';

const ZipDailyCard: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const puzzle = getDailyPuzzle();
  const puzzleDate = getLocalDateKey();
  const { myResult, leaderboard, loading, alreadyPlayedToday } = useZipGame(puzzleDate);
  const [localFinished, setLocalFinished] = useState(false);
  const [localTimeMs, setLocalTimeMs] = useState<number | null>(null);

  useEffect(() => {
    if (user && myResult) return;
    void getLocalZipCompletion(puzzleDate).then((local) => {
      setLocalFinished(!!local);
      setLocalTimeMs(local?.timeMs ?? null);
    });
  }, [user, myResult, puzzleDate]);

  const finishedToday = alreadyPlayedToday || localFinished;
  const topTime = leaderboard[0]?.time_ms;
  const myTimeMs = myResult?.time_ms ?? localTimeMs;

  const meta = loading
    ? null
    : finishedToday
      ? myTimeMs != null
        ? `Terminé · ${formatZipTime(myTimeMs)}${myResult?.rank ? ` · #${myResult.rank}` : ''}`
        : 'Terminé · revenez demain'
      : topTime
        ? `Record : ${formatZipTime(topTime)}`
        : 'À vous de jouer';

  const handlePress = () => {
    if (finishedToday) {
      navigation.navigate('ZipLeaderboard' as never);
      return;
    }
    navigation.navigate('ZipGame' as never);
  };

  return (
    <TouchableOpacity
      style={[styles.card, finishedToday && styles.cardDone]}
      activeOpacity={0.88}
      onPress={handlePress}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={finishedToday ? 'checkmark-circle' : 'grid-outline'} size={18} color="#fff" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          Zip du jour · {puzzle.theme}
        </Text>
        {!loading && meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Ionicons name={finishedToday ? 'trophy-outline' : 'chevron-forward'} size={16} color="#fdba74" />
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
  cardDone: {
    backgroundColor: '#166534',
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
