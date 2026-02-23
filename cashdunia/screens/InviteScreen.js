import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, getReferrals, applyReferralCode } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

export default function InviteScreen() {
  const { user: authUser } = useAuthStore();
  const { profile, updateProfile } = useUserStore();
  const [referralInput, setReferralInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const [userData, refData] = await Promise.all([
        getUser(authUser.id),
        getReferrals(authUser.id),
      ]);
      updateProfile(userData);
      setReferrals(refData || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const myCode = profile?.referral_code || '...';

  const handleCopy = async () => {
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Cash Dunia and earn real money! Use my referral code: ${myCode}\nDownload now and start earning 💰`,
        title: 'Join Cash Dunia',
      });
    } catch (e) {}
  };

  const handleApply = async () => {
    if (!referralInput.trim()) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }
    setApplying(true);
    try {
      await applyReferralCode(authUser.id, referralInput.trim());
      setReferralInput('');
      Alert.alert('🎉 Success!', 'Referral code applied! Your referrer earned 50 bonus coins.');
      await loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setApplying(false);
    }
  };

  const alreadyReferred = profile?.referred_by != null;

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Invite Friends</Text>
        <Text style={styles.pageSubtitle}>Earn 50 coins for every friend who joins with your code!</Text>

        {/* Your Code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{myCode}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Ionicons name={copied ? 'checkmark' : 'copy'} size={20} color={copied ? C.success : C.white} />
              <Text style={[styles.copyText, { color: copied ? C.success : C.white }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-social" size={18} color={C.white} />
            <Text style={styles.shareBtnText}>  Share with Friends</Text>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How It Works</Text>
          {[
            { icon: '📱', text: 'Share your referral code' },
            { icon: '👥', text: 'Friend signs up with your code' },
            { icon: '🪙', text: 'You earn 50 coins instantly!' },
          ].map((step, i) => (
            <View key={i} style={styles.howRow}>
              <Text style={styles.howIcon}>{step.icon}</Text>
              <Text style={styles.howText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Apply Code */}
        {!alreadyReferred && (
          <View style={styles.applyCard}>
            <Text style={styles.applyTitle}>Have a Referral Code?</Text>
            <View style={styles.applyRow}>
              <TextInput
                style={styles.applyInput}
                placeholder="Enter code (e.g. CDABC123)"
                placeholderTextColor={C.muted}
                value={referralInput}
                onChangeText={setReferralInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.applyBtn, applying && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={applying}
              >
                {applying ? (
                  <ActivityIndicator color={C.white} size="small" />
                ) : (
                  <Text style={styles.applyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {alreadyReferred && (
          <View style={styles.alreadyCard}>
            <Text style={styles.alreadyText}>✅ You've already used a referral code</Text>
          </View>
        )}

        {/* Referral List */}
        <View style={styles.refSection}>
          <Text style={styles.refTitle}>
            Your Referrals ({referrals.length})
          </Text>
          {loading ? (
            [1, 2].map(i => <SkeletonBox key={i} height={60} style={{ marginBottom: 8, borderRadius: 12 }} />)
          ) : referrals.length === 0 ? (
            <Text style={styles.emptyText}>No referrals yet. Start sharing!</Text>
          ) : (
            referrals.map(ref => (
              <View key={ref.id} style={styles.refCard}>
                <View style={styles.refAvatar}>
                  <Text style={styles.refAvatarText}>
                    {(ref.referred?.name || ref.referred?.email || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.refName}>
                    {ref.referred?.name || ref.referred?.email?.split('@')[0] || 'User'}
                  </Text>
                  <Text style={styles.refDate}>
                    Joined {new Date(ref.created_at).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <Text style={styles.refCoins}>+{ref.coins_awarded} 🪙</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56 },
  pageTitle: { color: C.white, fontSize: 26, fontWeight: 'bold', marginBottom: 6 },
  pageSubtitle: { color: C.muted, fontSize: 14, marginBottom: 24, lineHeight: 20 },
  codeCard: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 20, marginBottom: 16,
    borderWidth: 2, borderColor: C.primary,
  },
  codeLabel: { color: C.muted, fontSize: 13, marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  code: { color: C.white, fontSize: 26, fontWeight: 'bold', letterSpacing: 3 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  copyText: { marginLeft: 4, fontSize: 13, fontWeight: '600' },
  shareBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  shareBtnText: { color: C.white, fontWeight: 'bold', fontSize: 15 },
  howCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  howTitle: { color: C.white, fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  howRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  howIcon: { fontSize: 22, marginRight: 12 },
  howText: { color: C.muted, fontSize: 14 },
  applyCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  applyTitle: { color: C.white, fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  applyRow: { flexDirection: 'row', gap: 10 },
  applyInput: {
    flex: 1, backgroundColor: C.card, color: C.white,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, borderWidth: 1, borderColor: C.border, letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingHorizontal: 20, justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.6 },
  applyBtnText: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  alreadyCard: {
    backgroundColor: '#1A2E1A', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: C.success,
  },
  alreadyText: { color: C.success, textAlign: 'center', fontWeight: '600' },
  refSection: { marginTop: 4 },
  refTitle: { color: C.white, fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { color: C.muted, textAlign: 'center', paddingVertical: 16 },
  refCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 8, borderWidth: 1, borderColor: C.border, gap: 12,
  },
  refAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
  },
  refAvatarText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  refName: { color: C.white, fontSize: 14, fontWeight: '600' },
  refDate: { color: C.muted, fontSize: 12, marginTop: 2 },
  refCoins: { color: C.gold, fontWeight: 'bold', fontSize: 14 },
});
