import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ZipConfetti from '../components/zip/ZipConfetti';
import ZipGrid from '../components/zip/ZipGrid';
import { getDailyPuzzle, getLocalDateKey } from '../games/zip/puzzles';
import type { ZipCell } from '../games/zip/types';
import { validateZipPath } from '../games/zip/validateZipPath';
import { formatZipTime, useZipGame } from '../hooks/useZipGame';
import { useAuth } from '../services/AuthContext';

const ZipGameScreen: React.FC = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const puzzleDate = getLocalDateKey();
  const puzzle = useMemo(() => getDailyPuzzle(), []);
  const { myResult, submitResult, submitting } = useZipGame(puzzleDate);

  const [path, setPath] = useState<ZipCell[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [savedTimeMs, setSavedTimeMs] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const submittingRef = useRef(false);

  completedRef.current = completed;
  submittingRef.current = submitting;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    return () => {
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation]);

  const cellSize = useMemo(() => {
    const maxGrid = Math.max(puzzle.rows, puzzle.cols);
    const available = Math.min(width - 48, height * 0.45);
    return Math.max(36, Math.min(54, Math.floor(available / maxGrid)));
  }, [height, puzzle.cols, puzzle.rows, width]);

  useEffect(() => {
    if (startedAt && !completed) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAt);
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt, completed]);

  const handlePathChange = useCallback(
    (nextPath: ZipCell[]) => {
      if (completedRef.current || submittingRef.current) return;

      let startMs = startedAtRef.current;
      if (nextPath.length === 1 && !startMs) {
        startMs = Date.now();
        startedAtRef.current = startMs;
        setStartedAt(startMs);
      }
      if (nextPath.length === 0) {
        startedAtRef.current = null;
        setStartedAt(null);
        setElapsedMs(0);
      }

      setPath(nextPath);

      const validation = validateZipPath(puzzle, nextPath);
      if (!validation.ok) return;

      const finishMs = startMs ? Date.now() - startMs : 0;
      setCompleted(true);
      setElapsedMs(finishMs);
      if (timerRef.current) clearInterval(timerRef.current);

      const showResultAlert = (title: string, message: string, buttons?: { text: string; style?: 'cancel' | 'default'; onPress?: () => void }[]) => {
        setTimeout(() => Alert.alert(title, message, buttons), 1400);
      };

      void (async () => {
        if (!user) {
          showResultAlert(
            'Bravo !',
            `Terminé en ${formatZipTime(finishMs)}. Connectez-vous pour apparaître au classement.`,
            [
              { text: 'Plus tard', style: 'cancel' },
              { text: 'Se connecter', onPress: () => navigation.navigate('Auth' as never) },
            ],
          );
          return;
        }

        const result = await submitResult({
          puzzleId: puzzle.id,
          timeMs: finishMs,
          moves: nextPath.length,
        });
        if (result === 'saved') {
          setSavedTimeMs(finishMs);
          showResultAlert('Bravo !', `Nouveau record : ${formatZipTime(finishMs)}`);
        } else if (result === 'kept') {
          showResultAlert(
            'Bravo !',
            `Terminé en ${formatZipTime(finishMs)}. Meilleur temps : ${formatZipTime(myResult?.time_ms ?? finishMs)}.`,
          );
        }
      })();
    },
    [myResult?.time_ms, navigation, puzzle, submitResult, user],
  );

  const reset = () => {
    setPath([]);
    startedAtRef.current = null;
    setStartedAt(null);
    setElapsedMs(0);
    setCompleted(false);
    setSavedTimeMs(null);
    setResetToken((t) => t + 1);
  };

  const difficultyLabel =
    puzzle.difficulty === 'easy' ? 'Facile' : puzzle.difficulty === 'medium' ? 'Moyen' : 'Difficile';

  const gridDisabled = completed || submitting;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ZipConfetti active={completed} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Zip AkwaHome</Text>
          <Text style={styles.headerSubtitle}>{puzzle.theme}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ZipLeaderboard' as never)}
          style={styles.rankBtn}
        >
          <Ionicons name="podium-outline" size={22} color="#e67e22" />
        </TouchableOpacity>
      </View>

      <View style={styles.metaBar}>
        <Text style={styles.badge}>{difficultyLabel}</Text>
        <Text style={styles.badge}>{puzzle.rows}×{puzzle.cols}</Text>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={14} color="#e67e22" />
          <Text style={styles.timerText}>
            {completed && savedTimeMs != null ? formatZipTime(savedTimeMs) : formatZipTime(elapsedMs)}
          </Text>
        </View>
      </View>

      <View style={styles.gridZone}>
        <Text style={styles.instruction}>
          Maintenez le doigt sur le <Text style={styles.bold}>1</Text> et glissez sans le lever
        </Text>
        <ZipGrid
          puzzle={puzzle}
          path={path}
          onPathChange={handlePathChange}
          cellSize={cellSize}
          disabled={gridDisabled}
          resetToken={resetToken}
          celebrate={completed}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={reset} disabled={submitting}>
          <Ionicons name="refresh-outline" size={18} color="#64748b" />
          <Text style={styles.secondaryBtnText}>Recommencer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('ZipLeaderboard' as never)}
        >
          <Ionicons name="trophy-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Classement</Text>
        </TouchableOpacity>
      </View>

      {submitting && (
        <View style={styles.savingRow}>
          <ActivityIndicator color="#e67e22" />
          <Text style={styles.savingText}>Enregistrement…</Text>
        </View>
      )}

      {myResult && (
        <Text style={styles.bestTime}>
          Meilleur temps aujourd'hui : {formatZipTime(myResult.time_ms)}
          {myResult.rank ? ` · #${myResult.rank}` : ''}
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 8 },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  rankBtn: { padding: 8 },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9a3412',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timerText: { fontSize: 12, fontWeight: '700', color: '#c2410c' },
  gridZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  instruction: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
  },
  bold: { fontWeight: '800', color: '#15803d' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: { color: '#64748b', fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e67e22',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8 },
  savingText: { color: '#64748b' },
  bestTime: { textAlign: 'center', fontSize: 12, color: '#15803d', paddingBottom: 12, fontWeight: '600' },
});

export default ZipGameScreen;
