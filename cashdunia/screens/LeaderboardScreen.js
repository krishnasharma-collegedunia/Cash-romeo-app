import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { C, avatarColor } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, updateUser, getLeaderboard } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

// Time remaining until midnight
const msToMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
};

const formatCountdown = (ms) => {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
};

// Rank decoration
const rankDecor = (rank) => {
  if (rank === 1) return { emoji: '🥇', borderColor: '#FFD700', text: '#FFD700' };
  if (rank === 2) return { emoji: '🥈', borderColor: '#C0C0C0', text: '#C0C0C0' };
  if (rank === 3) return { emoji: '🥉', borderColor: '#CD7F32', text: '#CD7F32' };
  return { emoji: null, borderColor: 'transparent', text: C.muted };
};

export default function LeaderboardScreen() {
  const { user: authUser } = useAuthStore();
  const { profile } = useUserStore();

  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(formatCountdown(msToMidnight()));
  const countdownRef = useRef(null);

  // Midnight countdown tick
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(formatCountdown(msToMidnight()));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [authUser?.id])
  );

  const loadLeaderboard = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      // Daily reset check
      const today = new Date().toISOString().slice(0, 10);
      const user = await getUser(authUser.id);
      if (user.last_reset_date < today) {
        await updateUser(authUser.id, { daily_coins: 0, last_reset_date: today });
      }

      const data = await getLeaderboard(50);
      setLeaders(data || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const myIdx = leaders.findIndex(u => u.id === authUser?.id);
  const myRank = myIdx >= 0 ? myIdx + 1 : null;
  const myData = myIdx >= 0 ? leaders[myIdx] : null;

  const allZero = leaders.every(u => !u.daily_coins || u.daily_coins === 0);

  const renderItem = ({ item, index }) => {
    const rank = index + 1;
    const decor = rankDecor(rank);
    const isMe = item.id === authUser?.id;
    const avatarBg = avatarColor(item.name || item.email || '?');
    const displayName = item.name || item.email?.split('@')[0] || 'User';

    return (
      <View style={[
        styles.card,
        { borderColor: decor.borderColor || C.border },
        isMe && styles.cardMe,
      ]}>
        {/* Rank */}
        <View style={styles.rankArea}>
          {decor.emoji ? (
            <Text style={styles.medal}>{decor.emoji}</Text>
          ) : (
            <Text style={[styles.rankNum, { color: decor.text }]}>#{rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>
            {displayName[0].toUpperCase()}
          </Text>
        </View>

        {/* Name */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            {isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
          </View>
        </View>

        {/* Coins */}
        <Text style={styles.coinCount}>
          {item.daily_coins > 0 ? `🪙 ${item.daily_coins}` : '—'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.subHeader}>
          <Text style={styles.todayText}>📅 Today's Rankings</Text>
          <Text style={styles.countdownText}>Resets in {countdown}</Text>
        </View>
        <Text style={styles.headerSub}>Earn coins today to climb the ranks!</Text>
      </View>

      {/* My Rank Card */}
      {myRank && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankNum}>#{myRank}</Text>
          <View style={[styles.avatar, { backgroundColor: avatarColor(myData?.name || ''), marginHorizontal: 10 }]}>
            <Text style={styles.avatarText}>
              {(myData?.name || myData?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.myRankName} numberOfLines={1}>
            {myData?.name || myData?.email?.split('@')[0] || 'You'}
          </Text>
          <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>
          <Text style={styles.myRankCoins}>🪙 {myData?.daily_coins ?? 0}</Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonBox key={i} height={56} borderRadius={10} style={{ marginBottom: 6 }} />
          ))}
        </View>
      ) : allZero && leaders.length > 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 48 }}>🏆</Text>
          <Text style={styles.emptyTitle}>Be the first to earn coins today!</Text>
          <Text style={styles.emptySub}>Play the game to claim #1!</Text>
        </View>
      ) : (
        <FlatList
          data={leaders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 48 }}>🏆</Text>
              <Text style={styles.emptyTitle}>Be the first to earn coins today!</Text>
              <Text style={styles.emptySub}>Play the game to claim #1!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { color: C.white, fontWeight: 'bold', fontSize: 22, textAlign: 'center' },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  todayText: { color: C.muted, fontSize: 13 },
  countdownText: { color: C.primary, fontSize: 12, fontWeight: 'bold' },
  headerSub: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 4 },

  myRankCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    padding: 14, paddingHorizontal: 16,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 2, borderColor: C.primary,
  },
  myRankNum: { color: C.white, fontWeight: 'bold', fontSize: 18, minWidth: 36 },
  myRankName: { flex: 1, color: C.white, fontWeight: '600', fontSize: 14 },
  myRankCoins: { color: C.gold, fontWeight: 'bold', fontSize: 14, marginLeft: 8 },

  list: { paddingHorizontal: 16, paddingBottom: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 10,
    padding: 12, paddingHorizontal: 14, marginBottom: 6,
    borderWidth: 1,
  },
  cardMe: { borderColor: C.primary, backgroundColor: 'rgba(232,23,93,0.05)' },

  rankArea: { width: 34, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { fontWeight: 'bold', fontSize: 15 },

  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: C.white, fontWeight: 'bold', fontSize: 18 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  youBadge: { backgroundColor: C.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { color: C.white, fontSize: 10, fontWeight: 'bold' },
  coinCount: { color: C.gold, fontWeight: 'bold', fontSize: 14, marginLeft: 4 },

  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { color: C.white, fontWeight: 'bold', fontSize: 16, marginTop: 12, textAlign: 'center' },
  emptySub: { color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
});
