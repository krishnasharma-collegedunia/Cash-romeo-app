import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView,
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

// Slot amounts: slots 1-7
const SLOT_REWARDS = [5, 12, 20, 27, 35, 40, 50];
const MAX_SLOTS = 7;

// Format ms to HH:MM:SS
const formatCountdown = (ms) => {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
};

// Format ms to next midnight
const msToMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
};

export default function StreakScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, updateProfile } = useUserStore();

  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const [currentSlot, setCurrentSlot] = useState(null); // which slot being claimed
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const [coinAmount, setCoinAmount] = useState(0);

  // Cooldown countdown for slot 2
  const [slot2Countdown, setSlot2Countdown] = useState('');
  const slot2TimerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (slot2TimerRef.current) clearInterval(slot2TimerRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStreak();
      return () => {
        if (slot2TimerRef.current) clearInterval(slot2TimerRef.current);
      };
    }, [])
  );

  const loadStreak = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      let s = await getStreak(authUser.id);
      if (!s) {
        const today = new Date().toISOString().slice(0, 10);
        await upsertStreak(authUser.id, { streak_count: 0, ads_watched_today: 0, ads_watched_date: today });
        s = await getStreak(authUser.id);
      }
      // Daily reset
      const today = new Date().toISOString().slice(0, 10);
      if (s && s.ads_watched_date !== today) {
        await upsertStreak(authUser.id, { ads_watched_today: 0, ads_watched_date: today });
        s = { ...s, ads_watched_today: 0, ads_watched_date: today };
      }
      setStreak(s);
      startSlot2Countdown(s);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const startSlot2Countdown = (s) => {
    if (slot2TimerRef.current) clearInterval(slot2TimerRef.current);
    if (!s?.last_claimed_time) return;

    const updateCountdown = () => {
      const claimedTime = new Date(s.last_claimed_time).getTime();
      const cooldownEnd = claimedTime + 24 * 60 * 60 * 1000;
      const remaining = cooldownEnd - Date.now();
      if (remaining > 0) {
        setSlot2Countdown(formatCountdown(remaining));
      } else {
        setSlot2Countdown('');
        clearInterval(slot2TimerRef.current);
      }
    };

    updateCountdown();
    slot2TimerRef.current = setInterval(updateCountdown, 1000);
  };

  const today = new Date().toISOString().slice(0, 10);
  const adsWatchedToday = streak?.ads_watched_date === today ? (streak?.ads_watched_today || 0) : 0;
  const streakCount = streak?.streak_count || 0;
  const lastClaimedDate = streak?.last_claimed_date || null;
  const lastClaimedTime = streak?.last_claimed_time || null;

  // Slot state logic
  const getSlotState = (slot) => {
    if (adsWatchedToday >= slot) return 'claimed';
    if (slot === 1) return 'available';
    if (slot === 2) {
      if (adsWatchedToday < 1) return 'locked';
      const cooldownEnd = lastClaimedTime ? new Date(lastClaimedTime).getTime() + 24 * 60 * 60 * 1000 : 0;
      if (Date.now() < cooldownEnd) return 'cooldown';
      return 'available';
    }
    // Slots 3-7: require streak_count >= slot
    if (streakCount < slot) return 'locked';
    return 'available';
  };

  const handleClaim = (slot) => {
    const state = getSlotState(slot);
    if (state !== 'available') return;
    setCurrentSlot(slot);
    setAdVisible(true);
  };

  const handleAdComplete = async () => {
    setAdVisible(false);
    if (currentSlot === null) return;
    const amount = SLOT_REWARDS[currentSlot - 1];

    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let newStreak;
      if (!lastClaimedDate) newStreak = 1;
      else if (lastClaimedDate === yesterday) newStreak = streakCount + 1;
      else if (lastClaimedDate === today) newStreak = streakCount;
      else newStreak = 1;

      const newAds = adsWatchedToday + 1;
      const nowISO = new Date().toISOString();

      await upsertStreak(authUser.id, {
        streak_count: newStreak,
        last_claimed_date: today,
        last_claimed_time: nowISO,
        ads_watched_today: newAds,
        ads_watched_date: today,
        total_coins_from_streak: (streak?.total_coins_from_streak || 0) + amount,
        updated_at: nowISO,
      });
      await incrementCoins(authUser.id, amount);
      await getUser(authUser.id).then(u => updateProfile({ coins: u.coins }));

      setCoinAmount(amount);
      setShowCoinAnim(true);
      await loadStreak();
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setCurrentSlot(null);
    }
  };

  const renderSlotButton = (slot) => {
    const state = getSlotState(slot);
    switch (state) {
      case 'available':
        return (
          <TouchableOpacity style={styles.slotBtnAvail} onPress={() => handleClaim(slot)}>
            <Text style={styles.slotBtnAvailText}>Claim</Text>
          </TouchableOpacity>
        );
      case 'claimed':
        return (
          <View style={styles.slotBtnClaimed}>
            <Text style={styles.slotBtnClaimedText}>✓ Claimed</Text>
          </View>
        );
      case 'locked':
        return (
          <View style={styles.slotBtnLocked}>
            <Text style={styles.slotBtnLockedText}>🔒 Locked</Text>
          </View>
        );
      case 'cooldown':
        return (
          <View style={styles.slotBtnCooldown}>
            <Text style={styles.slotBtnCooldownText}>{slot2Countdown || '...'}</Text>
          </View>
        );
      default:
        return null;
    }
  };

  // Next-claim countdown (time until midnight if already claimed today)
  const alreadyClaimedToday = lastClaimedDate === today;
  const msLeft = alreadyClaimedToday ? msToMidnight() : 0;

  return (
    <View style={styles.container}>
      <MockAdOverlay visible={adVisible} onAdComplete={handleAdComplete} />
      <CoinAnimation visible={showCoinAnim} onDone={() => setShowCoinAnim(false)} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Streak</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Streak Banner */}
        <LinearGradient colors={['#1D6AE5', '#3B82F6']} style={styles.streakBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.streakNumber}>{streakCount}</Text>
          <Text style={styles.streakDays}>days streak</Text>
          <Text style={styles.streakMotivation}>Extend your streak to unlock new rewards!</Text>
        </LinearGradient>

        {/* Countdown after claim */}
        {alreadyClaimedToday && (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>🕐 Next streak available in</Text>
            <CountdownTimer />
            <Text style={styles.countdownNote}>(resets at midnight)</Text>
          </View>
        )}

        {/* Watch Ads section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Watch Ads</Text>
          <TouchableOpacity onPress={() => Alert.alert('Watch Ads', 'Watch ads daily to build your streak and earn bonus coins!')}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>You can watch up to 7 ads every day.</Text>

        {/* 7 Ad Slots */}
        {loading && !streak ? (
          [1, 2, 3, 4].map(i => <SkeletonSlot key={i} />)
        ) : (
          SLOT_REWARDS.map((amount, idx) => {
            const slot = idx + 1;
            return (
              <View key={slot} style={styles.slotRow}>
                <View style={styles.slotIcon}>
                  <Text style={{ fontSize: 22 }}>📺</Text>
                  <View style={styles.adBadge}><Text style={styles.adBadgeText}>AD</Text></View>
                </View>
                <Text style={styles.slotReward}>🪙 +{amount}</Text>
                {renderSlotButton(slot)}
              </View>
            );
          })
        )}

        {/* Back to Home */}
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Countdown until midnight (ticks every second)
function CountdownTimer() {
  const [display, setDisplay] = useState(formatCountdown(msToMidnight()));
  const ref = useRef(null);
  useEffect(() => {
    ref.current = setInterval(() => {
      const ms = msToMidnight();
      setDisplay(formatCountdown(ms));
      if (ms <= 0) clearInterval(ref.current);
    }, 1000);
    return () => clearInterval(ref.current);
  }, []);
  return <Text style={styles.countdownTime}>{display}</Text>;
}

function SkeletonSlot() {
  return <View style={{ height: 56, backgroundColor: C.card, borderRadius: 12, marginBottom: 8 }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: 'bold' },

  scroll: { padding: 16 },

  // Streak banner
  streakBanner: { borderRadius: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, height: 200, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginHorizontal: -16, marginTop: -16, marginBottom: 16 },
  streakNumber: { color: C.white, fontSize: 80, fontWeight: 'bold', lineHeight: 88 },
  streakDays: { color: C.white, fontSize: 18, marginTop: -4 },
  streakMotivation: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', marginTop: 6, maxWidth: 260 },

  // Countdown
  countdownCard: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  countdownLabel: { color: C.muted, fontSize: 13, textAlign: 'center' },
  countdownTime: { color: C.primary, fontWeight: 'bold', fontSize: 32, marginTop: 6 },
  countdownNote: { color: C.disabled, fontSize: 11, marginTop: 4 },

  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  infoIcon: { color: C.muted, fontSize: 18, marginLeft: 8 },
  sectionSub: { color: C.muted, fontSize: 12, marginBottom: 12 },

  // Slot rows
  slotRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, paddingHorizontal: 16, marginBottom: 8 },
  slotIcon: { position: 'relative', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  adBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: C.primary, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  adBadgeText: { color: C.white, fontSize: 8, fontWeight: 'bold' },
  slotReward: { color: C.gold, fontWeight: 'bold', fontSize: 16, flex: 1 },

  // Slot buttons
  slotBtnAvail: { backgroundColor: '#2563EB', borderRadius: 18, width: 100, height: 36, alignItems: 'center', justifyContent: 'center' },
  slotBtnAvailText: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  slotBtnClaimed: { backgroundColor: C.disabled, borderRadius: 18, width: 100, height: 36, alignItems: 'center', justifyContent: 'center' },
  slotBtnClaimedText: { color: C.muted, fontSize: 13 },
  slotBtnLocked: { backgroundColor: C.disabled, borderRadius: 18, width: 100, height: 36, alignItems: 'center', justifyContent: 'center' },
  slotBtnLockedText: { color: C.muted, fontSize: 13 },
  slotBtnCooldown: { backgroundColor: C.surface, borderRadius: 18, width: 100, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  slotBtnCooldownText: { color: C.primary, fontWeight: 'bold', fontSize: 12 },

  // Back button
  homeBtn: { backgroundColor: C.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  homeBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
