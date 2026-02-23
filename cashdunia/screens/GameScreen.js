import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal,
  Animated, BackHandler, AppState, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { C, LEVEL_CONFIG, getNextLevel } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, incrementGems, openOfferGate } from '../lib/api';
import GemToast from '../components/GemToast';
import MockAdOverlay from '../components/MockAdOverlay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOLE_VISIBLE_MS = 500;
const MOLE_CYCLE_MS = 1000;
const HITS_TO_WIN = 4;

export default function GameScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();

  // Profile state
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gemsThisLevel, setGemsThisLevel] = useState(0);
  const [offerGateOpen, setOfferGateOpen] = useState(false);

  // Game state
  const [sessionScore, setSessionScore] = useState(0);
  const [moleIdx, setMoleIdx] = useState(null);
  const [moleVisible, setMoleVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [flashHole, setFlashHole] = useState(null);

  // Ad / gem state
  const [adPlaying, setAdPlaying] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [gemToastVis, setGemToast] = useState(false);

  // Refs
  const moleAnim = useRef(new Animated.Value(70)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const lastIdx = useRef(null);
  const isPlayingRef = useRef(false);
  const sessionScoreRef = useRef(0);

  // Sync ref
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearTimeout(timerRef.current); };
  }, []);

  // AppState: if app backgrounds during ad, cancel it
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && adVisible) {
        clearTimeout(timerRef.current);
        setAdVisible(false);
        setAdPlaying(false);
      }
    });
    return () => sub.remove();
  }, [adVisible]);

  // Load profile on focus
  useFocusEffect(
    useCallback(() => {
      loadProfile();

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isPlayingRef.current) {
          Alert.alert('Exit game?', 'Your progress will be lost.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Exit', onPress: () => navigation.goBack() },
          ]);
          return true;
        }
        return false;
      });

      return () => {
        backHandler.remove();
        clearTimeout(timerRef.current);
        isPlayingRef.current = false;
      };
    }, [])
  );

  const loadProfile = async () => {
    if (!authUser?.id) return;
    try {
      const data = await getUser(authUser.id);
      setProfile(data);
      setCurrentLevel(data.current_level ?? 1);
      setGemsThisLevel(data.gems_this_level ?? 0);
      setOfferGateOpen(data.offer_gate_open ?? false);

      // Sync progress bar
      const cfg = LEVEL_CONFIG[data.current_level] || LEVEL_CONFIG[1];
      progressAnim.setValue((data.gems_this_level ?? 0) / cfg.gemTarget);
    } catch (e) {}
  };

  const levelConfig = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[1];
  const gemTarget = levelConfig.gemTarget;
  const gemsBlocked = !offerGateOpen && gemsThisLevel >= gemTarget;

  // ── GAME LOGIC ──────────────────────────────────────────

  const startGame = () => {
    sessionScoreRef.current = 0;
    setSessionScore(0);
    setGameComplete(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    showNextMole();
  };

  const showNextMole = () => {
    if (!isPlayingRef.current) return;
    let next;
    do { next = Math.floor(Math.random() * 9); } while (next === lastIdx.current);
    lastIdx.current = next;
    setMoleIdx(next);

    moleAnim.setValue(70);
    Animated.timing(moleAnim, { toValue: -15, duration: 150, useNativeDriver: true }).start();
    setMoleVisible(true);

    timerRef.current = setTimeout(() => {
      hideMole(() => {
        if (isPlayingRef.current) {
          timerRef.current = setTimeout(showNextMole, MOLE_CYCLE_MS - MOLE_VISIBLE_MS);
        }
      });
    }, MOLE_VISIBLE_MS);
  };

  const hideMole = (callback) => {
    Animated.timing(moleAnim, { toValue: 70, duration: 120, useNativeDriver: true })
      .start(() => { setMoleVisible(false); callback?.(); });
  };

  const onHoleTap = (idx) => {
    if (!isPlaying || gameComplete) return;

    if (idx === moleIdx && moleVisible) {
      // HIT
      clearTimeout(timerRef.current);
      hideMole();
      setFlashHole({ idx, type: 'hit' });
      setTimeout(() => setFlashHole(null), 350);

      const newScore = sessionScoreRef.current + 1;
      sessionScoreRef.current = newScore;
      setSessionScore(newScore);

      if (newScore >= HITS_TO_WIN) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setTimeout(() => setGameComplete(true), 400);
      } else {
        timerRef.current = setTimeout(showNextMole, 500);
      }
    } else {
      // MISS
      setFlashHole({ idx, type: 'miss' });
      setTimeout(() => setFlashHole(null), 250);
    }
  };

  // ── AD SEQUENCE ──────────────────────────────────────────

  const startAdSequence = () => {
    setGameComplete(false);
    if (gemsBlocked) {
      setShowBlock(true);
      return;
    }
    setAdPlaying(true);
    setAdVisible(true);
  };

  const awardGem = async () => {
    setAdVisible(false);
    setAdPlaying(false);

    const newGems = gemsThisLevel + 1;
    try {
      await incrementGems(authUser.id, 1);
      setGemsThisLevel(newGems);

      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: newGems / gemTarget,
        duration: 400,
        useNativeDriver: false,
      }).start();

      // Update profile store
      const updated = await getUser(authUser.id);
      setProfile(updated);

      // Gem toast
      setGemToast(true);
      setTimeout(() => setGemToast(false), 2200);

      // Reset score for next round
      setSessionScore(0);
      sessionScoreRef.current = 0;

      // Check gate
      if (newGems >= gemTarget) {
        // Auto-open offer gate
        if (!offerGateOpen) {
          await openOfferGate(authUser.id);
          setOfferGateOpen(true);
        }
        setTimeout(() => setShowBlock(true), 2500);
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  // ── RENDER ──────────────────────────────────────────────

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <MockAdOverlay visible={adVisible} onAdComplete={awardGem} />
      <GemToast visible={gemToastVis} amount={1} />

      {/* Gem-blocked red banner */}
      {gemsBlocked && (
        <TouchableOpacity
          style={styles.blockedBanner}
          onPress={() => navigation.navigate('SpecialOffer', { level: currentLevel })}
        >
          <Text style={styles.blockedBannerText}>
            ⚠️  Claim your Special Offer to unlock gem rewards!  Tap here →
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => {
            if (isPlaying) {
              Alert.alert('Exit game?', 'Your progress will be lost.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Exit', onPress: () => navigation.goBack() },
              ]);
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.exitBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Play Quiz</Text>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreText}>⭐ {sessionScore}/{HITS_TO_WIN}</Text>
        </View>
      </View>

      {/* Level + Gem Progress */}
      <View style={styles.progressSection}>
        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>Level {currentLevel} / 4</Text>
        </View>
        <View style={styles.progRow}>
          <Text style={styles.progLabel}>Gems collected</Text>
          <Text style={styles.progRight}>{gemsThisLevel} / {gemTarget} 💎</Text>
        </View>
        <View style={styles.progTrack}>
          <Animated.View style={[styles.progFill, { width: progressBarWidth }]} />
        </View>
      </View>

      {/* Game Area */}
      <LinearGradient colors={['#5CB85C', '#3D8B3D']} style={styles.gameArea}>
        {/* Fence */}
        <View style={styles.fence}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[styles.fencePost, i % 2 === 0 ? styles.fencePostDark : styles.fencePostLight]} />
          ))}
        </View>

        {/* Flowers */}
        <Text style={[styles.flower, { left: 20, top: 30 }]}>🌼</Text>
        <Text style={[styles.flower, { right: 25, top: 45 }]}>🌸</Text>
        <Text style={[styles.flower, { left: 60, bottom: 60 }]}>🌼</Text>
        <Text style={[styles.flower, { right: 50, bottom: 80 }]}>🌸</Text>

        {/* 3x3 Hole Grid */}
        <View style={styles.holeGrid}>
          {Array.from({ length: 9 }).map((_, idx) => {
            const isActive = moleIdx === idx;
            const flash = flashHole?.idx === idx ? flashHole.type : null;
            return (
              <TouchableOpacity
                key={idx}
                style={styles.holeWrapper}
                onPress={() => onHoleTap(idx)}
                activeOpacity={0.9}
              >
                {/* Mole */}
                {isActive && (
                  <Animated.View style={[styles.moleContainer, { transform: [{ translateY: moleAnim }] }]}>
                    <View style={styles.moleHead}>
                      <Text style={styles.moleEmoji}>🐭</Text>
                    </View>
                  </Animated.View>
                )}
                {/* Hole */}
                <View style={styles.hole}>
                  <View style={styles.holeInner} />
                </View>
                {/* Flash overlay */}
                {flash && (
                  <View style={[
                    styles.flashOverlay,
                    { backgroundColor: flash === 'hit' ? 'rgba(0,200,83,0.55)' : 'rgba(255,71,87,0.45)' },
                  ]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* PLAY button */}
      <View style={styles.playBtnArea}>
        {adPlaying && <Text style={styles.adLoadingText}>Ad loading...</Text>}
        <TouchableOpacity
          style={[styles.playBtn, (isPlaying || gameComplete || adPlaying) && styles.playBtnDisabled]}
          onPress={startGame}
          disabled={isPlaying || gameComplete || adPlaying}
          activeOpacity={0.85}
        >
          <Text style={styles.playBtnText}>PLAY</Text>
        </TouchableOpacity>
      </View>

      {/* ── COMPLETE MODAL ── */}
      <Modal visible={gameComplete} transparent animationType="fade">
        <View style={styles.modalDim}>
          <View style={styles.completeCard}>
            {/* Top banner */}
            <View style={styles.completeBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 36, marginTop: 4 }}>⭐</Text>
                <Text style={{ fontSize: 44, marginTop: -8 }}>⭐</Text>
                <Text style={{ fontSize: 36, marginTop: 4 }}>⭐</Text>
              </View>
              <Text style={styles.completeTitle}>COMPLETE</Text>
            </View>

            {/* Mole peek */}
            <View style={styles.molePeekWrap}>
              <View style={styles.molePeek}>
                <Text style={{ fontSize: 80 }}>🐭</Text>
              </View>
            </View>

            {/* Claim button */}
            <TouchableOpacity style={styles.claimGemBtn} onPress={startAdSequence} activeOpacity={0.85}>
              <Text style={styles.claimGemBtnText}>🎬  CLAIM  +1 💎</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => { setGameComplete(false); setSessionScore(0); sessionScoreRef.current = 0; setIsPlaying(false); }}
          >
            <Text style={styles.cancelText}>Tap to Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── BLOCKING OVERLAY ── */}
      <Modal visible={showBlock} transparent animationType="fade">
        <View style={styles.modalDim}>
          <View style={styles.blockCard}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>🎁</Text>
            <Text style={styles.blockTitle}>Level {currentLevel} Complete!</Text>
            <Text style={styles.blockBody}>
              You've collected all {gemTarget} gems for Level {currentLevel}.
            </Text>
            <Text style={styles.blockCoins}>
              Visit the Special Offer to claim your {levelConfig.coinsAwarded} coins 🪙
            </Text>
            <TouchableOpacity
              style={styles.blockBtn}
              onPress={() => { setShowBlock(false); navigation.navigate('SpecialOffer', { level: currentLevel }); }}
              activeOpacity={0.85}
            >
              <Text style={styles.blockBtnText}>Go to Special Offer →</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setShowBlock(false)}>
            <Text style={styles.cancelText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Blocked banner
  blockedBanner: { backgroundColor: C.primary, paddingVertical: 12, paddingHorizontal: 16, zIndex: 100 },
  blockedBannerText: { color: C.white, fontWeight: 'bold', fontSize: 13, textAlign: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 20, paddingBottom: 8 },
  exitBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  exitBtnText: { color: C.white, fontSize: 18, fontWeight: 'bold' },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: 'bold' },
  scoreCard: { backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { color: '#000', fontWeight: 'bold', fontSize: 14 },

  // Progress section
  progressSection: { paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  levelPill: { alignSelf: 'center', backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 10 },
  levelPillText: { color: C.white, fontWeight: 'bold', fontSize: 13 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLabel: { color: C.muted, fontSize: 12 },
  progRight: { color: C.white, fontWeight: 'bold', fontSize: 13 },
  progTrack: { height: 10, backgroundColor: C.surface, borderRadius: 5, overflow: 'hidden' },
  progFill: { height: 10, backgroundColor: C.gem, borderRadius: 5 },

  // Game area
  gameArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  fence: { flexDirection: 'row', height: 24, overflow: 'hidden' },
  fencePost: { flex: 1, marginHorizontal: 1, borderRadius: 2 },
  fencePostDark: { backgroundColor: '#6B3A1F' },
  fencePostLight: { backgroundColor: '#8B5E3C' },
  flower: { position: 'absolute', fontSize: 20 },

  // Hole grid — 3x3
  holeGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, paddingVertical: 10, alignContent: 'center', justifyContent: 'center' },
  holeWrapper: { width: '33.3%', alignItems: 'center', justifyContent: 'flex-end', height: 90, position: 'relative', paddingBottom: 8 },
  hole: { width: 90, height: 40, backgroundColor: '#6B3A1F', borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  holeInner: { width: 70, height: 28, backgroundColor: '#3D1F0A', borderRadius: 35 },
  moleContainer: { position: 'absolute', bottom: 28, alignItems: 'center', zIndex: 10 },
  moleHead: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#8B4513', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  moleEmoji: { fontSize: 52 },
  flashOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 45, zIndex: 20 },

  // Play button
  playBtnArea: { alignItems: 'center', paddingVertical: 20 },
  adLoadingText: { color: C.muted, fontSize: 12, marginBottom: 8 },
  playBtn: {
    backgroundColor: '#4CAF50', borderColor: '#388E3C', borderWidth: 2, borderRadius: 30,
    height: 56, width: 200, alignItems: 'center', justifyContent: 'center',
  },
  playBtnDisabled: { opacity: 0.5 },
  playBtnText: { color: C.white, fontWeight: 'bold', fontSize: 20, letterSpacing: 3 },

  // Modals
  modalDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },

  // Complete modal
  completeCard: { backgroundColor: C.white, borderRadius: 20, width: '100%', overflow: 'hidden', paddingBottom: 24 },
  completeBanner: { backgroundColor: '#4CAF50', borderRadius: 12, padding: 16, paddingBottom: 12, alignItems: 'center' },
  completeTitle: { color: C.white, fontWeight: 'bold', fontSize: 22, letterSpacing: 2, marginTop: 6 },
  molePeekWrap: { alignItems: 'center', paddingVertical: 20 },
  molePeek: { width: 100, height: 60, backgroundColor: '#6B3A1F', borderRadius: 50, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  claimGemBtn: { backgroundColor: '#4CAF50', borderRadius: 26, height: 52, marginHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  claimGemBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  cancelText: { color: C.white, fontSize: 14, textAlign: 'center' },

  // Block modal
  blockCard: { backgroundColor: C.surface, borderRadius: 16, padding: 24, width: '100%', alignItems: 'center' },
  blockTitle: { color: C.white, fontWeight: 'bold', fontSize: 20, marginTop: 12, textAlign: 'center' },
  blockBody: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  blockCoins: { color: C.primary, fontWeight: 'bold', fontSize: 13, textAlign: 'center', marginTop: 4 },
  blockBtn: { backgroundColor: C.primary, borderRadius: 14, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  blockBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
