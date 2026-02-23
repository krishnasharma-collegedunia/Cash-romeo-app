import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getStreak, upsertStreak, incrementCoins, getUser } from '../lib/api';
import MockAdOverlay from '../components/MockAdOverlay';
import CoinAnimation from '../components/CoinAnimation';

const STREAK_REWARDS = [5, 10, 15, 20, 25, 30, 50];
const MAX_ADS_PER_DAY = 5;
const COINS_PER_AD = 10;

export default function StreakScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, updateProfile } = useUserStore();
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadStreak();
    }, [])
  );

  const loadStreak = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const s = await getStreak(authUser.id);
      setStreak(s);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const today = new Date().toISOString().split('T')[0];
  const alreadyClaimed = streak?.last_claimed_date === today;
  const adsWatchedToday = streak?.ads_watched_date === today ? (streak?.ads_watched_today || 0) : 0;
  const canWatchAd = adsWatchedToday < MAX_ADS_PER_DAY;

  const getCurrentStreak = () => streak?.streak_count || 0;
  const getStreakReward = (count) => {
    const idx = Math.min(count - 1, STREAK_REWARDS.length - 1);
    return STREAK_REWARDS[Math.max(idx, 0)] || 5;
  };

  const handleClaimStreak = async () => {
    if (alreadyClaimed) {
      Alert.alert('Already Claimed', 'Come back tomorrow for your next streak bonus!');
      return;
    }
    setClaiming(true);
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const currentCount = streak?.streak_count || 0;
      const lastDate = streak?.last_claimed_date;
      const isConsecutive = lastDate === yesterday;
      const newStreak = isConsecutive ? currentCount + 1 : 1;
      const reward = getStreakReward(newStreak);

      await incrementCoins(authUser.id, reward);
      await upsertStreak(authUser.id, {
        streak_count: newStreak,
        last_claimed_date: today,
        last_claimed_time: new Date().toISOString(),
        total_coins_from_streak: (streak?.total_coins_from_streak || 0) + reward,
      });

      const updated = await getUser(authUser.id);
      updateProfile({ coins: updated.coins });
      await loadStreak();
      setShowCoinAnim(true);
      Alert.alert('🔥 Streak Claimed!', `+${reward} coins added! Streak: ${newStreak} days`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleWatchAd = () => {
    if (!canWatchAd) {
      Alert.alert('Daily Limit', `You've watched ${MAX_ADS_PER_DAY} ads today. Come back tomorrow!`);
      return;
    }
    setWatchingAd(true);
    setAdVisible(true);
  };

  const handleAdComplete = async () => {
    setAdVisible(false);
    try {
      await incrementCoins(authUser.id, COINS_PER_AD);
      const newAdsCount = adsWatchedToday + 1;
      await upsertStreak(authUser.id, {
        ads_watched_date: today,
        ads_watched_today: newAdsCount,
      });
      const updated = await getUser(authUser.id);
      updateProfile({ coins: updated.coins });
      await loadStreak();
      setShowCoinAnim(true);
      Alert.alert('🎉 Ad Watched!', `+${COINS_PER_AD} coins! (${newAdsCount}/${MAX_ADS_PER_DAY} today)`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setWatchingAd(false);
    }
  };

  const currentStreak = getCurrentStreak();
  const nextReward = getStreakReward(currentStreak + (alreadyClaimed ? 1 : 0));

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <MockAdOverlay visible={adVisible} onAdComplete={handleAdComplete} />
      <CoinAnimation visible={showCoinAnim} onDone={() => setShowCoinAnim(false)} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Streak</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Streak Counter */}
        <View style={styles.streakCard}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={styles.streakCount}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
          {alreadyClaimed && (
            <View style={styles.claimedBadge}>
              <Text style={styles.claimedText}>✓ Claimed Today</Text>
            </View>
          )}
        </View>

        {/* Streak Calendar */}
        <View style={styles.calCard}>
          <Text style={styles.calTitle}>Weekly Progress</Text>
          <View style={styles.calRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <View key={day} style={styles.calDay}>
                <View style={[
                  styles.calDot,
                  i < (currentStreak % 7) ? styles.calDotFilled : {},
                ]}>
                  <Text style={styles.calDotText}>
                    {i < (currentStreak % 7) ? '🔥' : '○'}
                  </Text>
                </View>
                <Text style={styles.calDayText}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Claim Button */}
        <TouchableOpacity
          style={[styles.claimBtn, alreadyClaimed && styles.claimBtnDisabled]}
          onPress={handleClaimStreak}
          disabled={alreadyClaimed || claiming}
          activeOpacity={0.85}
        >
          {claiming ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.claimBtnText}>
              {alreadyClaimed ? '✓ Claimed for Today' : `🎁 Claim +${nextReward} Coins`}
            </Text>
          )}
        </TouchableOpacity>

        {/* Watch Ads Section */}
        <View style={styles.adSection}>
          <Text style={styles.adTitle}>Earn More Coins</Text>
          <Text style={styles.adSub}>
            Watch ads to earn +{COINS_PER_AD} coins each ({adsWatchedToday}/{MAX_ADS_PER_DAY} today)
          </Text>
          <TouchableOpacity
            style={[styles.adBtn, !canWatchAd && styles.adBtnDisabled]}
            onPress={handleWatchAd}
            disabled={!canWatchAd}
            activeOpacity={0.85}
          >
            <Text style={styles.adBtnText}>
              {canWatchAd ? `📺 Watch Ad (+${COINS_PER_AD} coins)` : `⏰ Daily Limit Reached`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Streak Rewards Info */}
        <View style={styles.rewardsCard}>
          <Text style={styles.rewardsTitle}>Streak Rewards</Text>
          {STREAK_REWARDS.map((reward, i) => (
            <View key={i} style={styles.rewardRow}>
              <Text style={styles.rewardDay}>Day {i + 1}{i === STREAK_REWARDS.length - 1 ? '+' : ''}</Text>
              <Text style={styles.rewardCoins}>+{reward} coins</Text>
              {i < currentStreak && <Ionicons name="checkmark-circle" size={18} color={C.success} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 54,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: 'bold' },
  scroll: { padding: 20 },
  streakCard: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 32, alignItems: 'center',
    marginBottom: 16, borderWidth: 2,
    borderColor: '#FF6B35',
  },
  fireEmoji: { fontSize: 56, marginBottom: 8 },
  streakCount: { color: C.white, fontSize: 52, fontWeight: 'bold' },
  streakLabel: { color: C.muted, fontSize: 16, marginTop: 4 },
  claimedBadge: {
    marginTop: 12, backgroundColor: '#1A2E1A',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: C.success,
  },
  claimedText: { color: C.success, fontWeight: '600', fontSize: 13 },
  calCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  calTitle: { color: C.muted, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  calRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calDay: { alignItems: 'center' },
  calDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.card, justifyContent: 'center',
    alignItems: 'center', marginBottom: 4,
  },
  calDotFilled: { backgroundColor: '#FF6B3522' },
  calDotText: { fontSize: 16 },
  calDayText: { color: C.disabled, fontSize: 10 },
  claimBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 20,
  },
  claimBtnDisabled: { backgroundColor: C.disabled },
  claimBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  adSection: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  adTitle: { color: C.white, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  adSub: { color: C.muted, fontSize: 13, marginBottom: 12 },
  adBtn: {
    backgroundColor: C.blue + '22', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.blue,
  },
  adBtnDisabled: { opacity: 0.5 },
  adBtnText: { color: C.blue, fontWeight: 'bold', fontSize: 15 },
  rewardsCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.border,
  },
  rewardsTitle: { color: C.white, fontWeight: 'bold', fontSize: 16, marginBottom: 12 },
  rewardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rewardDay: { color: C.muted, fontSize: 14 },
  rewardCoins: { color: C.gold, fontWeight: '600', fontSize: 14 },
});
