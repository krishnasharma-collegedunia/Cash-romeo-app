import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, F, LEVEL_CONFIG, WITHDRAWAL_MIN_COINS } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, getTasks, getStreak } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

export default function HomeScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile, loading, setLoading } = useUserStore();
  const [tasks, setTasks] = React.useState([]);
  const [streak, setStreak] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      setLoading(true);
      const [userData, tasksData, streakData] = await Promise.all([
        getUser(authUser.id),
        getTasks(),
        getStreak(authUser.id),
      ]);
      setProfile(userData);
      setTasks(tasksData || []);
      setStreak(streakData);
    } catch (e) {
      console.error('HomeScreen load:', e.message);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1] : LEVEL_CONFIG[1];
  const gemProgress = profile ? Math.min((profile.gems_this_level / levelConfig.gemTarget) * 100, 100) : 0;
  const canWithdraw = profile && profile.coins >= WITHDRAWAL_MIN_COINS;

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.name}>{profile?.name || 'Player'}</Text>
          </View>
          <TouchableOpacity style={styles.streakBadge} onPress={() => navigation.navigate('Streak')}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakCount}>{streak?.streak_count || 0}</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Cards */}
        {loading && !profile ? (
          <View style={styles.cardsRow}>
            <SkeletonBox height={100} style={styles.cardSkeleton} />
            <SkeletonBox height={100} style={styles.cardSkeleton} />
          </View>
        ) : (
          <View style={styles.cardsRow}>
            <View style={[styles.balanceCard, { borderColor: C.gold }]}>
              <Text style={styles.balanceEmoji}>🪙</Text>
              <Text style={[styles.balanceAmount, { color: C.gold }]}>{profile?.coins ?? 0}</Text>
              <Text style={styles.balanceLabel}>Coins</Text>
              <Text style={styles.rupeeConvert}>₹{((profile?.coins ?? 0) / 80).toFixed(2)}</Text>
            </View>
            <View style={[styles.balanceCard, { borderColor: C.gem }]}>
              <Text style={styles.balanceEmoji}>💎</Text>
              <Text style={[styles.balanceAmount, { color: C.gem }]}>{profile?.gems ?? 0}</Text>
              <Text style={styles.balanceLabel}>Total Gems</Text>
              <Text style={styles.rupeeConvert}>Level {profile?.current_level ?? 1}</Text>
            </View>
          </View>
        )}

        {/* Level Progress */}
        <View style={styles.levelCard}>
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>🏆 {levelConfig.label}</Text>
            <Text style={styles.levelSub}>
              {profile?.gems_this_level ?? 0}/{levelConfig.gemTarget} gems
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${gemProgress}%` }]} />
          </View>
          <Text style={styles.levelReward}>
            Complete to earn {levelConfig.coinsAwarded} coins ({levelConfig.offerType} offer)
          </Text>

          {profile?.offer_gate_open ? (
            <TouchableOpacity
              style={styles.offerBtn}
              onPress={() => navigation.navigate('SpecialOffer')}
              activeOpacity={0.85}
            >
              <Text style={styles.offerBtnText}>🎉 Claim Offer Now!</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={() => navigation.navigate('Game')}
              activeOpacity={0.85}
            >
              <Ionicons name="game-controller" size={18} color={C.white} />
              <Text style={styles.playBtnText}>  Play to Earn Gems</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Withdraw CTA */}
        {canWithdraw && (
          <TouchableOpacity
            style={styles.withdrawCTA}
            onPress={() => navigation.navigate('Withdrawal')}
            activeOpacity={0.85}
          >
            <Text style={styles.withdrawCTAText}>💸 You can withdraw ₹{((profile.coins) / 80).toFixed(2)}!</Text>
          </TouchableOpacity>
        )}

        {/* Daily Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Daily Tasks</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Streak')}>
              <Text style={styles.seeAll}>See Streak ›</Text>
            </TouchableOpacity>
          </View>
          {loading && tasks.length === 0 ? (
            [1, 2, 3].map(i => <SkeletonBox key={i} height={60} style={{ marginBottom: 8, borderRadius: 12 }} />)
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={[styles.taskDot, { backgroundColor: task.icon_color || C.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDesc}>{task.description}</Text>
                </View>
                <View style={styles.taskReward}>
                  <Text style={styles.taskRewardText}>+{task.coin_reward}</Text>
                  <Text style={styles.taskRewardLabel}>🪙</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Offers')}>
              <Ionicons name="list" size={22} color={C.blue} />
              <Text style={styles.quickLabel}>Offers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Withdrawal')}>
              <Ionicons name="cash" size={22} color={C.gold} />
              <Text style={styles.quickLabel}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Streak')}>
              <Ionicons name="flame" size={22} color={C.primary} />
              <Text style={styles.quickLabel}>Streak</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { color: C.muted, fontSize: 14 },
  name: { color: C.white, fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FF6B35',
  },
  streakEmoji: { fontSize: 16, marginRight: 4 },
  streakCount: { color: '#FF6B35', fontWeight: 'bold', fontSize: 16 },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  cardSkeleton: { flex: 1, borderRadius: 16 },
  balanceCard: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1,
  },
  balanceEmoji: { fontSize: 28, marginBottom: 6 },
  balanceAmount: { fontSize: 26, fontWeight: 'bold' },
  balanceLabel: { color: C.muted, fontSize: 12, marginTop: 2 },
  rupeeConvert: { color: C.disabled, fontSize: 11, marginTop: 2 },
  levelCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  levelLabel: { color: C.white, fontSize: 16, fontWeight: 'bold' },
  levelSub: { color: C.muted, fontSize: 14 },
  progressBg: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 8, backgroundColor: C.gem, borderRadius: 4 },
  levelReward: { color: C.muted, fontSize: 12, marginBottom: 14 },
  offerBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  offerBtnText: { color: C.white, fontWeight: 'bold', fontSize: 15 },
  playBtn: {
    backgroundColor: '#1A3050', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
    borderWidth: 1, borderColor: C.blue,
  },
  playBtnText: { color: C.blue, fontWeight: 'bold', fontSize: 15 },
  withdrawCTA: {
    backgroundColor: '#1A2E1A', borderRadius: 14,
    padding: 14, alignItems: 'center',
    marginBottom: 12, borderWidth: 1,
    borderColor: C.gem,
  },
  withdrawCTAText: { color: C.gem, fontWeight: 'bold', fontSize: 15 },
  section: { marginTop: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: C.white, fontSize: 17, fontWeight: 'bold' },
  seeAll: { color: C.primary, fontSize: 13 },
  taskCard: {
    backgroundColor: C.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  taskDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  taskTitle: { color: C.white, fontSize: 14, fontWeight: '600' },
  taskDesc: { color: C.muted, fontSize: 12, marginTop: 2 },
  taskReward: { alignItems: 'center' },
  taskRewardText: { color: C.gold, fontWeight: 'bold', fontSize: 15 },
  taskRewardLabel: { fontSize: 12 },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  quickBtn: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1,
    borderColor: C.border,
  },
  quickLabel: { color: C.muted, fontSize: 12, marginTop: 6 },
});
