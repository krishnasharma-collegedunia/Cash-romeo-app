import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, LEVEL_CONFIG } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser } from '../lib/api';
import MockAdOverlay from '../components/MockAdOverlay';

const OFFER_DETAILS = {
  simple: {
    title: 'Watch & Earn',
    description: 'Complete a simple 3-step offer to earn your coins reward.',
    icon: '📺',
    color: C.blue,
    steps: [
      { id: 1, text: 'Watch the advertisement', icon: '📺' },
      { id: 2, text: 'Complete the short survey', icon: '📝' },
      { id: 3, text: 'Verify your completion', icon: '✅' },
    ],
  },
  install: {
    title: 'App Install Offer',
    description: 'Install the app and complete the 5-step verification to earn coins.',
    icon: '📱',
    color: C.primary,
    steps: [
      { id: 1, text: 'Watch the advertisement', icon: '📺' },
      { id: 2, text: 'Download the promoted app', icon: '⬇️' },
      { id: 3, text: 'Open the app once', icon: '📱' },
      { id: 4, text: 'Complete in-app tutorial', icon: '🎯' },
      { id: 5, text: 'Verify your completion', icon: '✅' },
    ],
  },
};

export default function SpecialOfferScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile } = useUserStore();
  const [adVisible, setAdVisible] = useState(false);
  const [adDone, setAdDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (authUser?.id) {
        getUser(authUser.id).catch(() => {});
      }
    }, [])
  );

  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1] : LEVEL_CONFIG[1];
  const offer = OFFER_DETAILS[levelConfig.offerType] || OFFER_DETAILS.simple;

  const handleStartOffer = () => {
    setAdVisible(true);
  };

  const handleAdComplete = () => {
    setAdVisible(false);
    setAdDone(true);
  };

  const handleProceed = () => {
    navigation.navigate('Verify');
  };

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <MockAdOverlay visible={adVisible} onAdComplete={handleAdComplete} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Special Offer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Offer Card */}
        <View style={[styles.offerCard, { borderColor: offer.color }]}>
          <Text style={styles.offerIcon}>{offer.icon}</Text>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          <Text style={styles.offerDesc}>{offer.description}</Text>

          <View style={styles.rewardBadge}>
            <Text style={styles.rewardText}>🪙 {levelConfig.coinsAwarded} Coins Reward</Text>
            <Text style={styles.rewardSub}>₹{(levelConfig.coinsAwarded / 80).toFixed(2)} value</Text>
          </View>
        </View>

        {/* Steps */}
        <Text style={styles.stepsTitle}>Offer Steps</Text>
        <View style={styles.stepsCard}>
          {offer.steps.map((step, idx) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.stepNum, adDone && idx === 0 ? styles.stepDone : {}]}>
                <Text style={styles.stepNumText}>
                  {adDone && idx === 0 ? '✓' : step.id}
                </Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
              {adDone && idx === 0 && <Ionicons name="checkmark-circle" size={20} color={C.success} />}
            </View>
          ))}
        </View>

        {/* Action Button */}
        {!adDone ? (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={handleStartOffer}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>📺 Watch Ad to Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.proceedBtn}
            onPress={handleProceed}
            activeOpacity={0.85}
          >
            <Text style={styles.proceedBtnText}>➡️ Continue to Offer Steps</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.note}>
          ⚠️ Complete all steps honestly to receive your coin reward.
          Fraudulent completions will be disqualified.
        </Text>
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
  offerCard: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, alignItems: 'center',
    marginBottom: 24, borderWidth: 2,
  },
  offerIcon: { fontSize: 48, marginBottom: 12 },
  offerTitle: { color: C.white, fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  offerDesc: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  rewardBadge: {
    marginTop: 16, backgroundColor: '#1A2E1A',
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: C.gem, alignItems: 'center',
  },
  rewardText: { color: C.gem, fontWeight: 'bold', fontSize: 16 },
  rewardSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  stepsTitle: { color: C.white, fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  stepsCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: C.border,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  stepNum: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.border, justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
  },
  stepDone: { backgroundColor: C.success },
  stepNumText: { color: C.white, fontWeight: 'bold', fontSize: 13 },
  stepInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepIcon: { fontSize: 18, marginRight: 8 },
  stepText: { color: C.white, fontSize: 14, flex: 1 },
  startBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  startBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  proceedBtn: {
    backgroundColor: '#1A2A1A', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: C.gem,
  },
  proceedBtnText: { color: C.gem, fontWeight: 'bold', fontSize: 16 },
  note: { color: C.disabled, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
