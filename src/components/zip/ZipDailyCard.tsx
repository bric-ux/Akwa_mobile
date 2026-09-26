import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getDailyPuzzle, getLocalDateKey } from '../../games/zip/puzzles';
import { useZipGame } from '../../hooks/useZipGame';
import { useAuth } from '../../services/AuthContext';
import { getLocalZipCompletion } from '../../utils/zipLocalCompletion';
import { HOME_EXPLORE_HORIZONTAL_GUTTER } from '../../constants/homeExploreLayout';

/** Chip Zip aligné sur le site (ZipHomeChip variant carousel). */
const ZipDailyCard: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const puzzle = getDailyPuzzle();
  const puzzleDate = getLocalDateKey();
  const { myResult, alreadyPlayedToday } = useZipGame(puzzleDate);
  const [localFinished, setLocalFinished] = useState(false);

  useEffect(() => {
    if (user && myResult) return;
    void getLocalZipCompletion(puzzleDate).then((local) => {
      setLocalFinished(!!local);
    });
  }, [user, myResult, puzzleDate]);

  const finishedToday = alreadyPlayedToday || localFinished;
  const label = finishedToday ? 'Zip · terminé' : 'Zip du jour';
  const description = finishedToday ? puzzle.theme : `${puzzle.theme} · jouer`;

  const handlePress = () => {
    if (finishedToday) {
      navigation.navigate('ZipLeaderboard' as never);
      return;
    }
    navigation.navigate('ZipGame' as never);
  };

  return (
    <TouchableOpacity
      style={styles.chip}
      activeOpacity={0.88}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={finishedToday ? 'checkmark-circle-outline' : 'grid-outline'}
          size={16}
          color="#475569"
        />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {description}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    marginHorizontal: HOME_EXPLORE_HORIZONTAL_GUTTER,
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  meta: {
    fontSize: 12,
    color: '#64748b',
  },
});

export default ZipDailyCard;
