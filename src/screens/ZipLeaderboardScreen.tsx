import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatZipTime, useZipGame } from '../hooks/useZipGame';
import { getDailyPuzzle, getLocalDateKey } from '../games/zip/puzzles';
import { useAuth } from '../services/AuthContext';

const ZipLeaderboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const puzzleDate = getLocalDateKey();
  const puzzle = getDailyPuzzle();
  const { leaderboard, myResult, loading, reload, error } = useZipGame(puzzleDate);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Classement Zip</Text>
          <Text style={styles.headerSubtitle}>{puzzle.theme} · aujourd'hui</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {myResult && (
        <View style={styles.myScoreCard}>
          <Ionicons name="medal-outline" size={22} color="#e67e22" />
          <View style={styles.myScoreTextWrap}>
            <Text style={styles.myScoreTitle}>Votre score</Text>
            <Text style={styles.myScoreValue}>
              #{myResult.rank} · {formatZipTime(myResult.time_ms)}
            </Text>
          </View>
        </View>
      )}

      {!user && (
        <View style={styles.hintCard}>
          <Text style={styles.hintText}>Connectez-vous pour enregistrer votre temps au classement.</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e67e22" />
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => `${item.user_id}-${item.completed_at}`}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor="#e67e22" />}
          contentContainerStyle={leaderboard.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="game-controller-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Aucun score aujourd'hui</Text>
              <Text style={styles.emptyText}>Soyez le premier à relever le défi !</Text>
              <TouchableOpacity style={styles.playBtn} onPress={() => navigation.navigate('ZipGame' as never)}>
                <Text style={styles.playBtnText}>Jouer</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMe = user?.id === item.user_id;
            const medalColor = index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#64748b';
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <View style={styles.rankCol}>
                  {index < 3 ? (
                    <Ionicons name="trophy" size={18} color={medalColor} />
                  ) : (
                    <Text style={styles.rankNum}>#{item.rank}</Text>
                  )}
                </View>
                <View style={styles.nameCol}>
                  <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                    {item.display_name}
                    {isMe ? ' (vous)' : ''}
                  </Text>
                </View>
                <Text style={[styles.time, isMe && styles.timeMe]}>{formatZipTime(item.time_ms)}</Text>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  backBtn: { width: 40, padding: 8 },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b' },
  myScoreCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  myScoreTextWrap: { flex: 1 },
  myScoreTitle: { fontSize: 12, color: '#9a3412' },
  myScoreValue: { fontSize: 18, fontWeight: '800', color: '#c2410c' },
  hintCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
  },
  hintText: { color: '#1d4ed8', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowMe: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  rankCol: { width: 36, alignItems: 'center' },
  rankNum: { fontWeight: '700', color: '#64748b' },
  nameCol: { flex: 1, paddingHorizontal: 8 },
  name: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  nameMe: { color: '#c2410c' },
  time: { fontSize: 14, fontWeight: '700', color: '#475569', fontVariant: ['tabular-nums'] },
  timeMe: { color: '#c2410c' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', color: '#334155' },
  emptyText: { marginTop: 6, color: '#64748b', textAlign: 'center' },
  playBtn: {
    marginTop: 16,
    backgroundColor: '#e67e22',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  playBtnText: { color: '#fff', fontWeight: '700' },
  error: { textAlign: 'center', color: '#dc2626', padding: 12 },
});

export default ZipLeaderboardScreen;
