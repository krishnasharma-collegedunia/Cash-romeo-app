import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, LEVEL_CONFIG, getNextLevel } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, incrementGems, openOfferGate } from '../lib/api';
import GemToast from '../components/GemToast';
import CoinAnimation from '../components/CoinAnimation';

export default function GameScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [showGemToast, setShowGemToast] = useState(false);
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const [toastMessage, setToastMessage] = useState('+1 Gem Earned!');
  const [rounds, setRounds] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    if (!authUser?.id) return;
    try {
      const data = await getUser(authUser.id);
      setProfile(data);
    } catch (e) {}
  };

  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1] : LEVEL_CONFIG[1];
  const gemsThisLevel = profile?.gems_this_level ?? 0;
  const gemTarget = levelConfig.gemTarget;
  const progressPct = Math.min((gemsThisLevel / gemTarget) * 100, 100);
  const isGateMet = gemsThisLevel >= gemTarget;

  const handlePlayRound = async () => {
    if (!authUser?.id) return;
    if (loading) return;

    if (isGateMet) {
      Alert.alert(
        'Offer Ready!',
        'You have enough gems to claim your offer. Go to the offer screen!',
        [
          { text: 'Go to Offer', onPress: () => navigation.navigate('SpecialOffer') },
          { text: 'Stay Here', style: 'cancel' },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      await incrementGems(authUser.id, 1);
      const updated = await getUser(authUser.id);
      setProfile(updated);
      setRounds(r => r + 1);

      const newGems = updated.gems_this_level;
      const newTarget = (LEVEL_CONFIG[updated.current_level] || LEVEL_CONFIG[1]).gemTarget;

      if (newGems >= newTarget && !updated.offer_gate_open) {
        // Auto-open offer gate
        await openOfferGate(authUser.id);
        const final = await getUser(authUser.id);
        setProfile(final);
        setToastMessage('Offer Unlocked! 🎉');
        setShowGemToast(true);
        setShowCoinAnim(true);
      } else {
        setToastMessage('+1 Gem Earned!');
        setShowGemToast(true);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <GemToast
        visible={showGemToast}
        message={toastMessage}
        onDone={() => setShowGemToast(false)}
      />
      <CoinAnimation
        visible={showCoinAnim}
        onDone={() => setShowCoinAnim(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Play Game</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Level Badge */}
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>{levelConfig.label}</Text>
          <Text style={styles.levelBadgeSub}>{levelConfig.offerType} offer</Text>
        </View>

        {/* Gem Progress */}
        <View style={styles.progressCard}>
          <View style={styles.gemRow}>
            {Array.from({ length: gemTarget }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.gemDot,
                  i < gemsThisLevel ? styles.gemDotFilled : styles.gemDotEmpty,
                ]}
              >
                <Text style={styles.gemEmoji}>{i < gemsThisLevel ? '💎' : '○'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.progBarBg}>
            <View style={[styles.progBarFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progText}>{gemsThisLevel}/{gemTarget} gems collected</Text>
          <Text style={styles.rewardHint}>Complete to earn {levelConfig.coinsAwarded} coins!</Text>
        </View>

        {/* Play Button */}
        {isGateMet ? (
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => navigation.navigate('SpecialOffer')}
            activeOpacity={0.85}
          >
            <Text style={styles.claimBtnText}>🎉 Claim Your Offer!</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.playBtn, loading && styles.btnDisabled]}
            onPress={handlePlayRound}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.white} size="large" />
            ) : (
              <>
                <Text style={styles.playBtnEmoji}>🎮</Text>
                <Text style={styles.playBtnText}>Play Round</Text>
                <Text style={styles.playBtnSub}>Earn 1 Gem</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{rounds}</Text>
            <Text style={styles.statLabel}>Rounds Today</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: C.gem }]}>{profile?.gems ?? 0}</Text>
            <Text style={styles.statLabel}>Total Gems</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: C.gold }]}>{profile?.coins ?? 0}</Text>
            <Text style={styles.statLabel}>Total Coins</Text>
          </View>
        </View>
      </View>
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
  content: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  levelBadge: {
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 10,
    marginBottom: 32, borderWidth: 1,
    borderColor: C.primary, alignItems: 'center',
  },
  levelBadgeText: { color: C.primary, fontSize: 18, fontWeight: 'bold' },
  levelBadgeSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  progressCard: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, width: '100%',
    marginBottom: 32, borderWidth: 1,
    borderColor: C.border, alignItems: 'center',
  },
  gemRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  gemDot: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  gemDotFilled: { backgroundColor: '#00C85322' },
  gemDotEmpty: { backgroundColor: C.card },
  gemEmoji: { fontSize: 22 },
  progBarBg: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progBarFill: { height: 8, backgroundColor: C.gem, borderRadius: 4 },
  progText: { color: C.muted, fontSize: 14 },
  rewardHint: { color: C.gold, fontSize: 13, marginTop: 4, fontWeight: '600' },
  playBtn: {
    backgroundColor: C.primary, borderRadius: 80,
    width: 160, height: 160,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
    marginBottom: 32,
  },
  btnDisabled: { opacity: 0.6 },
  playBtnEmoji: { fontSize: 40 },
  playBtnText: { color: C.white, fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  playBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  claimBtn: {
    backgroundColor: '#1A2E1A', borderRadius: 20,
    paddingHorizontal: 32, paddingVertical: 20,
    borderWidth: 2, borderColor: C.gem,
    marginBottom: 32, width: '100%',
    alignItems: 'center',
  },
  claimBtnText: { color: C.gem, fontSize: 18, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', gap: 16, width: '100%' },
  statItem: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { color: C.white, fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 4 },
});
