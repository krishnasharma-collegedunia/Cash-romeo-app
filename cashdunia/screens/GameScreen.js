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

const { width: SW } = Dimensions.get('window');
const CORRECT_TO_WIN = 3;   // 3 correct answers → 1 gem
const ANSWER_FLASH_MS = 600;

// ── Question generator ─────────────────────────────────────────────
const OPERATIONS = ['+', '-', '×'];

const generateQuestion = () => {
  const op = OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)];
  let a, b, answer;

  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 10;
    b = Math.floor(Math.random() * (a - 1)) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 8) + 2;
    b = Math.floor(Math.random() * 8) + 2;
    answer = a * b;
  }

  // 2 distinct wrong answers
  const wrongs = new Set();
  while (wrongs.size < 2) {
    const offset = Math.floor(Math.random() * 15) + 1;
    const sign = Math.random() < 0.5 ? 1 : -1;
    const w = answer + sign * offset;
    if (w !== answer && w > 0) wrongs.add(w);
  }

  // Shuffle choices
  const choices = [answer, ...Array.from(wrongs)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { a, b, op, answer, choices };
};

// ── Star component (filled / empty) ───────────────────────────────
function Star({ filled }) {
  return (
    <View style={[styles.star, filled && styles.starFilled]}>
      <Text style={styles.starEmoji}>{filled ? '⭐' : '☆'}</Text>
    </View>
  );
}

export default function GameScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();

  // Profile / level state
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gemsThisLevel, setGemsThisLevel] = useState(0);
  const [offerGateOpen, setOfferGateOpen] = useState(false);

  // Game state
  const [question, setQuestion] = useState(generateQuestion);
  const [correctCount, setCorrectCount] = useState(0);      // 0-3
  const [totalScore, setTotalScore] = useState(0);          // all-time for display
  const [gameComplete, setGameComplete] = useState(false);
  const [flash, setFlash] = useState(null);                 // { idx, correct }
  const [answerLocked, setAnswerLocked] = useState(false);

  // Ad / gem state
  const [adVisible, setAdVisible] = useState(false);
  const [adPlaying, setAdPlaying] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [gemToastVis, setGemToastVis] = useState(false);

  // Progress bar anim
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flashTimerRef = useRef(null);
  const adTimerRef = useRef(null);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(flashTimerRef.current);
      clearTimeout(adTimerRef.current);
    };
  }, []);

  // AppState: cancel ad if backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && adVisible) {
        clearTimeout(adTimerRef.current);
        setAdVisible(false);
        setAdPlaying(false);
      }
    });
    return () => sub.remove();
  }, [adVisible]);

  // Load profile
  useFocusEffect(
    useCallback(() => {
      loadProfile();

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });
      return () => backHandler.remove();
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

      const cfg = LEVEL_CONFIG[data.current_level] || LEVEL_CONFIG[1];
      progressAnim.setValue((data.gems_this_level ?? 0) / cfg.gemTarget);
    } catch (e) {}
  };

  const levelConfig = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[1];
  const gemTarget = levelConfig.gemTarget;
  const gemsBlocked = !offerGateOpen && gemsThisLevel >= gemTarget;

  // ── ANSWER LOGIC ──────────────────────────────────────────────────
  const handleAnswer = (choiceIdx) => {
    if (answerLocked || gameComplete) return;
    setAnswerLocked(true);

    const chosen = question.choices[choiceIdx];
    const correct = chosen === question.answer;

    setFlash({ idx: choiceIdx, correct });

    if (correct) {
      const newCount = correctCount + 1;
      const newTotal = totalScore + 1;
      setCorrectCount(newCount);
      setTotalScore(newTotal);

      flashTimerRef.current = setTimeout(() => {
        setFlash(null);
        if (newCount >= CORRECT_TO_WIN) {
          // Round complete!
          setGameComplete(true);
          setAnswerLocked(false);
        } else {
          setQuestion(generateQuestion());
          setAnswerLocked(false);
        }
      }, ANSWER_FLASH_MS);
    } else {
      // Wrong: shake board, show next question
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();

      flashTimerRef.current = setTimeout(() => {
        setFlash(null);
        setQuestion(generateQuestion());
        setAnswerLocked(false);
      }, ANSWER_FLASH_MS);
    }
  };

  // ── AD / GEM SEQUENCE ─────────────────────────────────────────────
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

      Animated.timing(progressAnim, {
        toValue: newGems / gemTarget,
        duration: 500,
        useNativeDriver: false,
      }).start();

      const updated = await getUser(authUser.id);
      setProfile(updated);

      // Reset for next round
      setCorrectCount(0);
      setQuestion(generateQuestion());

      setGemToastVis(true);
      flashTimerRef.current = setTimeout(() => setGemToastVis(false), 2200);

      if (newGems >= gemTarget) {
        if (!offerGateOpen) {
          await openOfferGate(authUser.id);
          setOfferGateOpen(true);
        }
        adTimerRef.current = setTimeout(() => setShowBlock(true), 2500);
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  // Progress bar width
  const progWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // Answer button color
  const getAnswerStyle = (idx) => {
    if (flash?.idx === idx) {
      return flash.correct ? styles.answerCorrect : styles.answerWrong;
    }
    return styles.answerBtn;
  };

  const getAnswerTextStyle = (idx) => {
    if (flash?.idx === idx) {
      return { color: C.white };
    }
    return styles.answerBtnText;
  };

  return (
    <View style={styles.container}>
      <MockAdOverlay visible={adVisible} onAdComplete={awardGem} />
      <GemToast visible={gemToastVis} amount={1} />

      {/* ── Gem-blocked red banner ── */}
      {gemsBlocked && (
        <TouchableOpacity
          style={styles.blockedBanner}
          onPress={() => navigation.navigate('SpecialOffer', { level: currentLevel })}
        >
          <Text style={styles.blockedText}>
            ⚠️  Claim your Special Offer to unlock gem rewards! Tap here →
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Beach sky background ── */}
      <LinearGradient
        colors={['#4ECDC4', '#45B7D1', '#96CEB4']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* ── Clouds ── */}
      <View style={[styles.cloud, { top: 60, left: 20 }]}><Text style={styles.cloudText}>☁️</Text></View>
      <View style={[styles.cloud, { top: 80, right: 40 }]}><Text style={styles.cloudText}>⛅</Text></View>

      {/* ── Header bar ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>

        {/* Level progress */}
        <View style={styles.progressPill}>
          <View style={styles.progTrack}>
            <Animated.View style={[styles.progFill, { width: progWidth }]} />
          </View>
          <Text style={styles.progLabel}>{gemsThisLevel}/{gemTarget} 💎</Text>
        </View>

        {/* Gem counter */}
        <View style={styles.gemCounter}>
          <Text style={styles.gemCounterEmoji}>💎</Text>
          <View style={styles.gemCounterPill}>
            <Text style={styles.gemCounterText}>{gemsThisLevel}</Text>
          </View>
        </View>
      </View>

      {/* ── Sandy ground ── */}
      <View style={styles.ground} />

      {/* ── Wooden board (main game card) ── */}
      <View style={styles.boardWrap}>
        <Animated.View style={[styles.board, { transform: [{ translateX: shakeAnim }] }]}>
          {/* Wood top plank */}
          <View style={styles.woodTop} />
          <View style={styles.woodMid} />

          {/* Parchment content */}
          <View style={styles.parchment}>
            {/* 3 Stars progress */}
            <View style={styles.starsRow}>
              {[0, 1, 2].map(i => (
                <Star key={i} filled={i < correctCount} />
              ))}
            </View>

            {/* TOP SCORE banner */}
            <View style={styles.topScoreBanner}>
              <Text style={styles.topScoreText}>TOP SCORE</Text>
            </View>
            <Text style={styles.topScoreNum}>{totalScore}</Text>

            {/* Equation */}
            <View style={styles.equationRow}>
              <Text style={styles.equationText}>
                {question.a} {question.op} {question.b} =
              </Text>
              <View style={styles.questionBox}>
                <Text style={styles.questionMark}>?</Text>
              </View>
            </View>

            {/* SELECT NUMBER label */}
            <Text style={styles.selectLabel}>SELECT NUMBER</Text>

            {/* Answer buttons */}
            <View style={styles.answersRow}>
              {question.choices.map((choice, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={getAnswerStyle(idx)}
                  onPress={() => handleAnswer(idx)}
                  disabled={answerLocked}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.answerBtnText, getAnswerTextStyle(idx) !== styles.answerBtnText && getAnswerTextStyle(idx)]}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Wood bottom plank */}
          <View style={styles.woodBottom} />
        </Animated.View>
      </View>

      {/* ── COMPLETE MODAL ── */}
      <Modal visible={gameComplete} transparent animationType="fade">
        <View style={styles.modalDim}>
          <View style={styles.completeCard}>
            <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.completeBanner}>
              <View style={styles.starsRowBig}>
                <Text style={{ fontSize: 30, marginTop: 4 }}>⭐</Text>
                <Text style={{ fontSize: 40, marginTop: -6 }}>⭐</Text>
                <Text style={{ fontSize: 30, marginTop: 4 }}>⭐</Text>
              </View>
              <Text style={styles.completeTitle}>COMPLETE!</Text>
            </LinearGradient>

            <View style={styles.completeBody}>
              <Text style={styles.completeEmoji}>🧠</Text>
              <Text style={styles.completeSubtitle}>3 Correct Answers!</Text>
              <Text style={styles.completeHint}>Watch a short ad to claim your 💎 gem</Text>

              <TouchableOpacity style={styles.claimBtn} onPress={startAdSequence} activeOpacity={0.85}>
                <Text style={styles.claimBtnText}>🎬  CLAIM  +1 💎</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => {
              setGameComplete(false);
              setCorrectCount(0);
              setQuestion(generateQuestion());
            }}
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

const BOARD_W = Math.min(SW - 32, 360);
const WOOD_COLOR = '#8B5E3C';
const WOOD_DARK = '#6B3F20';
const PARCHMENT = '#F5E6C8';
const PARCHMENT_DARK = '#E8D5A8';

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Blocked banner
  blockedBanner: {
    backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 16,
    zIndex: 200, position: 'absolute', top: 0, left: 0, right: 0,
  },
  blockedText: { color: C.white, fontWeight: 'bold', fontSize: 13, textAlign: 'center' },

  // Clouds
  cloud: { position: 'absolute', zIndex: 5 },
  cloudText: { fontSize: 32 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8,
    zIndex: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: C.white, fontSize: 22, fontWeight: 'bold' },

  progressPill: { flex: 1, marginHorizontal: 12, alignItems: 'center' },
  progTrack: {
    width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4, overflow: 'hidden', marginBottom: 3,
  },
  progFill: { height: 8, backgroundColor: C.gem, borderRadius: 4 },
  progLabel: { color: C.white, fontSize: 12, fontWeight: 'bold' },

  gemCounter: { flexDirection: 'row', alignItems: 'center' },
  gemCounterEmoji: { fontSize: 20 },
  gemCounterPill: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4,
    minWidth: 36, alignItems: 'center',
  },
  gemCounterText: { color: '#5B2D8E', fontWeight: 'bold', fontSize: 15 },

  // Ground
  ground: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    backgroundColor: '#C4A46B',
  },

  // Board wrapper — centered
  boardWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingBottom: 40, zIndex: 10,
  },

  // Wooden board
  board: {
    width: BOARD_W,
    borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  woodTop: {
    height: 28, backgroundColor: WOOD_COLOR,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomWidth: 3, borderBottomColor: WOOD_DARK,
    // Nail illusions
  },
  woodMid: {
    height: 12, backgroundColor: WOOD_DARK,
  },
  woodBottom: {
    height: 28, backgroundColor: WOOD_COLOR,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderTopWidth: 3, borderTopColor: WOOD_DARK,
  },

  // Parchment (inner content area)
  parchment: {
    backgroundColor: PARCHMENT,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderLeftWidth: 8, borderRightWidth: 8,
    borderLeftColor: WOOD_COLOR, borderRightColor: WOOD_COLOR,
    alignItems: 'center',
  },

  // Stars
  starsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  star: {
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
  },
  starFilled: {},
  starEmoji: { fontSize: 28 },

  // TOP SCORE
  topScoreBanner: {
    backgroundColor: '#9B59B6', borderRadius: 20,
    paddingHorizontal: 28, paddingVertical: 6, marginBottom: 4,
  },
  topScoreText: { color: C.white, fontWeight: 'bold', fontSize: 15, letterSpacing: 1.5 },
  topScoreNum: { color: WOOD_DARK, fontSize: 14, fontWeight: 'bold', marginBottom: 12 },

  // Equation
  equationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  equationText: { color: WOOD_DARK, fontSize: 32, fontWeight: 'bold', marginRight: 8 },
  questionBox: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: '#F5C842',
    borderWidth: 3, borderColor: '#D4A017',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D4A017', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  questionMark: { color: WOOD_DARK, fontWeight: 'bold', fontSize: 26 },

  // SELECT NUMBER
  selectLabel: {
    color: WOOD_DARK, fontWeight: 'bold', fontSize: 14,
    letterSpacing: 1.5, marginBottom: 16,
  },

  // Answers
  answersRow: { flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'center' },
  answerBtn: {
    flex: 1, height: 60, borderRadius: 14,
    backgroundColor: '#F5C842',
    borderWidth: 3, borderColor: '#D4A017',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D4A017', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
  },
  answerCorrect: {
    flex: 1, height: 60, borderRadius: 14,
    backgroundColor: '#2ECC71', borderWidth: 3, borderColor: '#27AE60',
    alignItems: 'center', justifyContent: 'center',
  },
  answerWrong: {
    flex: 1, height: 60, borderRadius: 14,
    backgroundColor: '#E74C3C', borderWidth: 3, borderColor: '#C0392B',
    alignItems: 'center', justifyContent: 'center',
  },
  answerBtnText: { color: WOOD_DARK, fontWeight: 'bold', fontSize: 22 },

  // Stars (big, for complete modal)
  starsRowBig: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  // Modals
  modalDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },

  completeCard: { backgroundColor: C.white, borderRadius: 20, width: '100%', overflow: 'hidden' },
  completeBanner: { padding: 16, alignItems: 'center', borderRadius: 12 },
  completeTitle: { color: C.white, fontWeight: 'bold', fontSize: 24, letterSpacing: 2 },
  completeBody: { padding: 24, alignItems: 'center' },
  completeEmoji: { fontSize: 56, marginBottom: 8 },
  completeSubtitle: { color: '#333', fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  completeHint: { color: '#666', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  claimBtn: {
    backgroundColor: '#4CAF50', borderRadius: 26,
    height: 52, width: '100%', alignItems: 'center', justifyContent: 'center',
  },
  claimBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  cancelText: { color: C.white, fontSize: 14, textAlign: 'center' },

  blockCard: { backgroundColor: C.surface, borderRadius: 16, padding: 24, width: '100%', alignItems: 'center' },
  blockTitle: { color: C.white, fontWeight: 'bold', fontSize: 20, marginTop: 12, textAlign: 'center' },
  blockBody: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  blockCoins: { color: C.primary, fontWeight: 'bold', fontSize: 13, textAlign: 'center', marginTop: 4 },
  blockBtn: {
    backgroundColor: C.primary, borderRadius: 14, height: 52,
    width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  blockBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
