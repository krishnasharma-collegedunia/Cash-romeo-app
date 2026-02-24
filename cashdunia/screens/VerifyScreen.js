import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Modal, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, LEVEL_CONFIG, getNextLevel } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, insertOffer, advanceLevel, incrementCoins, openOfferGate } from '../lib/api';
import CoinAnimation from '../components/CoinAnimation';

const STEPS = {
  simple: [
    { emoji: '🎮', text: 'Play the game' },
    { emoji: '📺', text: 'Watch the ad shown after gameplay' },
    { emoji: '🔘', text: 'Tap Verify below to collect your coins' },
  ],
  install: [
    { emoji: '🎮', text: 'Play the game' },
    { emoji: '📺', text: 'Watch the ad shown after gameplay' },
    { emoji: '📲', text: 'Install the app shown in the ad' },
    { emoji: '⏱', text: 'Use the installed app for at least 2 minutes' },
    { emoji: '🔘', text: 'Tap Verify below to collect your coins' },
  ],
};

export default function VerifyScreen({ route, navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();

  const level = route?.params?.level ?? profile?.current_level ?? 1;
  const coinsToAward = route?.params?.coins_to_award ?? (LEVEL_CONFIG[level]?.coinsAwarded ?? 350);
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

  const steps = config.offerType === 'simple'
    ? STEPS.simple
    : STEPS.install(coinsToAward);

  const [loading, setLoading] = useState(false);
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const [successModal, setSuccessModal] = useState(null); // { coins, nextLevel }

  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  const handleVerify = async () => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1500)); // simulate verification

      const nextLevel = getNextLevel(level);

      await incrementCoins(authUser.id, coinsToAward);
      await insertOffer({
        user_id: authUser.id,
        level,
        offer_type: config.offerType,
        coins_awarded: coinsToAward,
      });
      await openOfferGate(authUser.id);     // re-opens gate for next level's gems
      await advanceLevel(authUser.id, nextLevel); // advance + reset gems + close gate

      const updated = await getUser(authUser.id);
      setProfile(updated);

      // Show coin animation + success modal
      setShowCoinAnim(true);
      scaleAnim.setValue(0.3);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      setSuccessModal({ coins: coinsToAward, nextLevel });
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CoinAnimation visible={showCoinAnim} onDone={() => setShowCoinAnim(false)} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collect Points</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.howTitle}>How it works.</Text>

        {steps.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            {/* Circle with emoji */}
            <View style={styles.stepCircle}>
              <Text style={styles.stepEmoji}>{step.emoji}</Text>
            </View>

            {/* Step info */}
            <View style={styles.stepInfo}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>Step {idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom Verify button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.verifyBtnText}>Verify (3)</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal visible={!!successModal} transparent animationType="fade">
        <View style={styles.modalDim}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.successCheck}>✅</Text>
            <Text style={styles.successTitle}>Congratulations!</Text>
            <Text style={styles.successCoins}>You earned {successModal?.coins} coins! 🪙</Text>
            {successModal?.nextLevel === 1 ? (
              <Text style={styles.successSub}>
                🎉 You've completed all 4 levels! Starting again from Level 1.
              </Text>
            ) : (
              <Text style={[styles.successSub, { color: C.gem }]}>
                Level {successModal?.nextLevel} unlocked! Keep going 🚀
              </Text>
            )}
            <TouchableOpacity
              style={styles.awesomeBtn}
              onPress={() => { setSuccessModal(null); navigation.navigate('Home'); }}
            >
              <Text style={styles.awesomeBtnText}>Awesome!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 54,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: 'bold' },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  howTitle: { color: C.white, fontWeight: 'bold', fontSize: 24, marginBottom: 24 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#2563EB', alignItems: 'center',
    justifyContent: 'center', marginRight: 14, flexShrink: 0,
  },
  stepEmoji: { fontSize: 24 },
  stepInfo: { flex: 1, paddingTop: 4 },
  stepPill: {
    alignSelf: 'flex-start', backgroundColor: '#2563EB',
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  stepPillText: { color: C.white, fontWeight: 'bold', fontSize: 9 },
  stepText: { color: C.white, fontSize: 14, lineHeight: 21 },

  bottomBar: { padding: 16, paddingBottom: 32 },
  verifyBtn: {
    backgroundColor: '#2563EB', borderRadius: 14,
    height: 56, alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },

  // Modal
  modalDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  successCard: {
    backgroundColor: C.white, borderRadius: 20,
    padding: 32, width: '100%', alignItems: 'center',
  },
  successCheck: { fontSize: 48 },
  successTitle: { color: '#111', fontWeight: 'bold', fontSize: 22, marginTop: 12 },
  successCoins: { color: '#C8860A', fontSize: 16, marginTop: 8 },
  successSub: { color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  awesomeBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    height: 52, width: '100%', alignItems: 'center',
    justifyContent: 'center', marginTop: 24,
  },
  awesomeBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
