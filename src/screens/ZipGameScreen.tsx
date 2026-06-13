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
import { getLocalZipCompletion, setLocalZipCompletion } from '../utils/zipLocalCompletion';

const ZipGameScreen: React.FC = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const puzzleDate = getLocalDateKey();
  const puzzle = useMemo(() => getDailyPuzzle(), []);
  const { myResult, submitResult, submitting, loading, alreadyPlayedToday } = useZipGame(puzzleDate);

  const [path, setPath] = useState<ZipCell[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [savedTimeMs, setSavedTimeMs] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [localFinishedMs, setLocalFinishedMs] = useState<number | null>(null);
  const [checkingLocal, setCheckingLocal] = useState(!user);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const submittingRef = useRef(false);
  const lockedRef = useRef(false);

  const finishedToday = alreadyPlayedToday || localFinishedMs != null;
  const displayTimeMs = savedTimeMs ?? myResult?.time_ms ?? localFinishedMs ?? elapsedMs;

  completedRef.current = completed;
  submittingRef.current = submitting;
  lockedRef.current = finishedToday || completed;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    return () => {
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation]);

  useEffect(() => {
    if (myResult) {
      setCompleted(true);
      setSavedTimeMs(myResult.time_ms);
      setElapsedMs(myResult.time_ms);
      setCheckingLocal(false);
    }
  }, [myResult]);

  useEffect(() => {
    if (user || myResult) {
      setCheckingLocal(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const local = await getLocalZipCompletion(puzzleDate);
      if (cancelled) return;
      if (local) {
        setLocalFinishedMs(local.timeMs);
        setCompleted(true);
        setElapsedMs(local.timeMs);
      }
      setCheckingLocal(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, myResult, puzzleDate]);

  const cellSize = useMemo(() => {
    const maxGrid = Math.max(puzzle.rows, puzzle.cols);
    const available = Math.min(width - 48, height * 0.45);
    return Math.max(36, Math.min(54, Math.floor(available / maxGrid)));
  }, [height, puzzle.cols, puzzle.rows, width]);

  useEffect(() => {
    if (startedAt && !completed && !finishedToday) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAt);
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt, completed, finishedToday]);

  const handlePathChange = useCallback(
    (nextPath: ZipCell[]) => {
      if (lockedRef.current || submittingRef.current) return;

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
          await setLocalZipCompletion(puzzleDate, finishMs);
          setLocalFinishedMs(finishMs);
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
          showResultAlert('Bravo !', `Terminé en ${formatZipTime(finishMs)}`);
        } else if (result === 'already_played') {
          showResultAlert(
            'Défi déjà terminé',
            `Vous avez déjà joué aujourd'hui (${formatZipTime(myResult?.time_ms ?? finishMs)}).`,
          );
        } else if (result === 'error') {
          showResultAlert('Erreur', 'Impossible d\'enregistrer votre score.');
        }
      })();
    },
    [myResult?.time_ms, navigation, puzzle, puzzleDate, submitResult, user],
  );

  const difficultyLabel =
    puzzle.difficulty === 'easy' ? 'Facile' : puzzle.difficulty === 'medium' ? 'Moyen' : 'Difficile';

  const gridDisabled = finishedToday || completed || submitting;
  const showConfetti = completed && !finishedToday;

  if (loading || checkingLocal) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#e67e22" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ZipConfetti active={showConfetti} />
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
          <Text style={styles.timerText}>{formatZipTime(displayTimeMs)}</Text>
        </View>
        {finishedToday && (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#15803d" />
            <Text style={styles.doneBadgeText}>Terminé</Text>
          </View>
        )}
      </View>

      <View style={styles.gridZone}>
        <Text style={styles.instruction}>
          {finishedToday
            ? 'Défi du jour terminé. Revenez demain pour une nouvelle grille !'
            : (
              <>
                Maintenez le doigt sur le <Text style={styles.bold}>1</Text> et glissez sans le lever
              </>
            )}
        </Text>
        <View style={styles.gridWrap}>
          <ZipGrid
            puzzle={puzzle}
            path={path}
            onPathChange={handlePathChange}
            cellSize={cellSize}
            disabled={gridDisabled}
            resetToken={resetToken}
            celebrate={showConfetti}
          />
          {finishedToday && (
            <View style={styles.lockedOverlay} pointerEvents="none">
              <View style={styles.lockedCard}>
                <Ionicons name="trophy" size={28} color="#ea580c" />
                <Text style={styles.lockedTitle}>Déjà joué aujourd'hui</Text>
                <Text style={styles.lockedTime}>{formatZipTime(displayTimeMs)}</Text>
                {myResult?.rank ? (
                  <Text style={styles.lockedRank}>Classement · #{myResult.rank}</Text>
                ) : null}
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        {!finishedToday && !completed && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setResetToken((t) => t + 1)} disabled={submitting}>
            <Ionicons name="refresh-outline" size={18} color="#64748b" />
            <Text style={styles.secondaryBtnText}>Recommencer</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, (finishedToday || completed) && styles.primaryBtnFull]}
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    flexWrap: 'wrap',
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
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  doneBadgeText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  gridZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  gridWrap: { position: 'relative' },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.72)',
    borderRadius: 16,
  },
  lockedCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    gap: 4,
  },
  lockedTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  lockedTime: { fontSize: 22, fontWeight: '800', color: '#ea580c' },
  lockedRank: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  instruction: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
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
  primaryBtnFull: { flex: 1 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8 },
  savingText: { color: '#64748b' },
  bestTime: { textAlign: 'center', fontSize: 12, color: '#15803d', paddingBottom: 12, fontWeight: '600' },
});

export default ZipGameScreen;
