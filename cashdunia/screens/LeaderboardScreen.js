import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { getLeaderboard } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

export default function LeaderboardScreen() {
  const { user: authUser } = useAuthStore();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [])
  );

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(20);
      setLeaders(data || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const myRank = leaders.findIndex(l => l.id === authUser?.id) + 1;

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top earners in Cash Dunia</Text>

        {/* My Rank */}
        {myRank > 0 && (
          <View style={styles.myRankCard}>
            <Text style={styles.myRankText}>Your Rank: #{myRank}</Text>
            <Text style={styles.myRankCoins}>
              {leaders[myRank - 1]?.coins ?? 0} coins
            </Text>
          </View>
        )}

        {/* Top 3 Podium */}
        {loading ? (
          [1, 2, 3].map(i => (
            <SkeletonBox key={i} height={72} style={{ marginBottom: 10, borderRadius: 16 }} />
          ))
        ) : (
          <View style={styles.list}>
            {leaders.map((user, idx) => {
              const rank = idx + 1;
              const medal = getMedalEmoji(rank);
              const isMe = user.id === authUser?.id;
              return (
                <View
                  key={user.id}
                  style={[
                    styles.card,
                    isMe && styles.cardMe,
                    rank <= 3 && styles.cardTop,
                  ]}
                >
                  <View style={styles.rankArea}>
                    {medal ? (
                      <Text style={styles.medal}>{medal}</Text>
                    ) : (
                      <Text style={styles.rankNum}>#{rank}</Text>
                    )}
                  </View>
                  <View style={[
                    styles.avatar,
                    isMe ? { backgroundColor: C.primary } : { backgroundColor: C.surface },
                  ]}>
                    <Text style={styles.avatarText}>
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>
                      {user.name || user.email?.split('@')[0] || 'User'}
                      {isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.userLevel}>Level {user.current_level}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.coinAmount}>{user.coins}</Text>
                    <Text style={styles.coinLabel}>🪙 coins</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && leaders.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyText}>Be the first to earn coins!</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56 },
  title: { color: C.white, fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: C.muted, fontSize: 14, marginBottom: 16 },
  myRankCard: {
    backgroundColor: '#1A0B14', borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: C.primary,
  },
  myRankText: { color: C.primary, fontWeight: 'bold', fontSize: 15 },
  myRankCoins: { color: C.gold, fontWeight: 'bold', fontSize: 15 },
  list: {},
  card: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 14, flexDirection: 'row',
    alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: C.border, gap: 12,
  },
  cardMe: { borderColor: C.primary, backgroundColor: '#1A0B14' },
  cardTop: { borderColor: C.gold },
  rankArea: { width: 32, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: C.muted, fontWeight: 'bold', fontSize: 16 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  userName: { color: C.white, fontSize: 14, fontWeight: '600' },
  userLevel: { color: C.muted, fontSize: 12, marginTop: 2 },
  coinAmount: { color: C.gold, fontWeight: 'bold', fontSize: 17 },
  coinLabel: { color: C.muted, fontSize: 11 },
  emptyCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: C.muted, fontSize: 15 },
});
