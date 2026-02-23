import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, LEVEL_CONFIG, getNextLevel } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, insertOffer, advanceLevel, incrementCoins } from '../lib/api';
import CoinAnimation from '../components/CoinAnimation';
import MockAdOverlay from '../components/MockAdOverlay';

export default function VerifyScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const [checklist, setChecklist] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const [adVisible, setAdVisible] = useState(false);
  const [adStepIndex, setAdStepIndex] = useState(-1);

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        const levelConfig = LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1];
        const steps = generateSteps(levelConfig);
        setChecklist(steps.map(s => ({ ...s, checked: false })));
        setSuccess(false);
      }
    }, [profile?.current_level])
  );

  const generateSteps = (levelConfig) => {
    if (levelConfig.offerType === 'simple') {
      return [
        { id: 1, text: 'I watched the full advertisement' },
        { id: 2, text: 'I completed the survey' },
        { id: 3, text: 'My submission was genuine' },
      ];
    }
    return [
      { id: 1, text: 'I watched the advertisement' },
      { id: 2, text: 'I downloaded the promoted app' },
      { id: 3, text: 'I opened the app at least once' },
      { id: 4, text: 'I completed the in-app tutorial' },
      { id: 5, text: 'My completion was genuine' },
    ];
  };

  const toggleItem = (id) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const allChecked = checklist.length > 0 && checklist.every(i => i.checked);

  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1] : LEVEL_CONFIG[1];

  const handleSubmit = async () => {
    if (!allChecked) {
      Alert.alert('Incomplete', 'Please check all steps to confirm completion');
      return;
    }
    setSubmitting(true);
    try {
      const currentLevel = profile.current_level;
      const config = LEVEL_CONFIG[currentLevel];
      const next = getNextLevel(currentLevel);

      // Award coins
      await incrementCoins(authUser.id, config.coinsAwarded);

      // Record offer history
      await insertOffer({
        user_id: authUser.id,
        level: currentLevel,
        offer_type: config.offerType,
        coins_awarded: config.coinsAwarded,
      });

      // Advance level
      await advanceLevel(authUser.id, next);

      // Reload profile
      const updated = await getUser(authUser.id);
      setProfile(updated);

      setShowCoinAnim(true);
      setSuccess(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <LinearGradient colors={[C.bg, '#001A0A']} style={styles.container}>
        <CoinAnimation visible={showCoinAnim} onDone={() => setShowCoinAnim(false)} />
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Offer Complete!</Text>
          <Text style={styles.successCoins}>+{levelConfig.coinsAwarded} Coins Earned</Text>
          <Text style={styles.successSub}>₹{(levelConfig.coinsAwarded / 80).toFixed(2)} added to your balance</Text>
          <View style={styles.newLevelBadge}>
            <Text style={styles.newLevelText}>
              Now on Level {profile?.current_level ?? 1}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Completion</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.rewardCard}>
          <Text style={styles.rewardTitle}>Your Reward</Text>
          <Text style={styles.rewardAmount}>{levelConfig.coinsAwarded} Coins</Text>
          <Text style={styles.rewardRs}>₹{(levelConfig.coinsAwarded / 80).toFixed(2)}</Text>
        </View>

        <Text style={styles.checkTitle}>Confirm you completed all steps:</Text>

        <View style={styles.checkCard}>
          {checklist.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.checkRow, item.checked && styles.checkRowDone]}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, item.checked && styles.checkboxDone]}>
                {item.checked && <Ionicons name="checkmark" size={16} color={C.white} />}
              </View>
              <Text style={[styles.checkText, item.checked && styles.checkTextDone]}>
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (!allChecked || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!allChecked || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.submitBtnText}>
              {allChecked ? '💰 Submit & Claim Coins' : 'Check all steps to continue'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By submitting, you confirm that your offer completion was genuine.
          False claims will result in account suspension.
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
  rewardCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 20, alignItems: 'center',
    marginBottom: 24, borderWidth: 2,
    borderColor: C.gold,
  },
  rewardTitle: { color: C.muted, fontSize: 14 },
  rewardAmount: { color: C.gold, fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  rewardRs: { color: C.gem, fontSize: 18, marginTop: 2 },
  checkTitle: { color: C.white, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  checkCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: C.border,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  checkRowDone: { opacity: 0.8 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: C.muted,
    marginRight: 14, justifyContent: 'center', alignItems: 'center',
  },
  checkboxDone: { backgroundColor: C.success, borderColor: C.success },
  checkText: { color: C.white, fontSize: 14, flex: 1, lineHeight: 20 },
  checkTextDone: { color: C.muted, textDecorationLine: 'line-through' },
  submitBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: C.disabled },
  submitBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  disclaimer: { color: C.disabled, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successEmoji: { fontSize: 72, marginBottom: 16 },
  successTitle: { color: C.white, fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  successCoins: { color: C.gold, fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  successSub: { color: C.gem, fontSize: 16, marginBottom: 24 },
  newLevelBadge: {
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 10,
    borderWidth: 1, borderColor: C.primary, marginBottom: 32,
  },
  newLevelText: { color: C.primary, fontWeight: 'bold', fontSize: 16 },
  doneBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  doneBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
