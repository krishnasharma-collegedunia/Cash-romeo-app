import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, WITHDRAWAL_MIN_COINS, COINS_PER_RUPEE } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, insertWithdrawal, deductCoins, getWithdrawals } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

export default function WithdrawalScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, updateProfile } = useUserStore();
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    if (!authUser?.id) return;
    setHistLoading(true);
    try {
      const data = await getWithdrawals(authUser.id);
      setHistory(data || []);
    } catch (e) {}
    finally { setHistLoading(false); }
  };

  const currentCoins = profile?.coins ?? 0;
  const coinsToWithdraw = parseInt(amount) || 0;
  const rupeeValue = (coinsToWithdraw / COINS_PER_RUPEE).toFixed(2);
  const canWithdraw = currentCoins >= WITHDRAWAL_MIN_COINS;
  const validAmount =
    coinsToWithdraw >= WITHDRAWAL_MIN_COINS &&
    coinsToWithdraw <= currentCoins &&
    coinsToWithdraw % COINS_PER_RUPEE === 0;

  const handleWithdraw = async () => {
    if (!upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }
    if (!validAmount) {
      Alert.alert(
        'Invalid Amount',
        `Minimum withdrawal: ${WITHDRAWAL_MIN_COINS} coins (\u20b9${(WITHDRAWAL_MIN_COINS / COINS_PER_RUPEE).toFixed(2)}). Amount must be a multiple of ${COINS_PER_RUPEE}.`
      );
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${coinsToWithdraw} coins (\u20b9${rupeeValue}) to ${upiId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await insertWithdrawal({
                user_id: authUser.id,
                coins_redeemed: coinsToWithdraw,
                rs_value: parseFloat(rupeeValue),
                method: 'UPI',
                payment_address: upiId.trim(),
                status: 'pending',
              });
              await deductCoins(authUser.id, coinsToWithdraw);
              const updated = await getUser(authUser.id);
              updateProfile({ coins: updated.coins });
              await loadHistory();
              setAmount('');
              setUpiId('');
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return C.success;
      case 'rejected': return C.error;
      default: return C.gold;
    }
  };

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Balance */}
          <View style={styles.balanceCard}>
            <Text style={styles.balLabel}>Available Balance</Text>
            <Text style={styles.balCoins}>{currentCoins} Coins</Text>
            <Text style={styles.balRs}>₹{(currentCoins / COINS_PER_RUPEE).toFixed(2)}</Text>
          </View>

          {!canWithdraw ? (
            <View style={styles.lockCard}>
              <Text style={styles.lockEmoji}>🔒</Text>
              <Text style={styles.lockTitle}>Not enough coins</Text>
              <Text style={styles.lockSub}>
                You need {WITHDRAWAL_MIN_COINS} coins (₹{WITHDRAWAL_MIN_COINS / COINS_PER_RUPEE}) to withdraw.
                You have {currentCoins} coins.
              </Text>
              <View style={styles.lockBar}>
                <View
                  style={[
                    styles.lockBarFill,
                    { width: `${Math.min((currentCoins / WITHDRAWAL_MIN_COINS) * 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.lockProg}>
                {currentCoins}/{WITHDRAWAL_MIN_COINS} coins
              </Text>
            </View>
          ) : (
            <View style={styles.formCard}>
              {success && (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>✅ Withdrawal request submitted!</Text>
                </View>
              )}

              <Text style={styles.formTitle}>Request Withdrawal</Text>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>UPI ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="yourname@upi"
                  placeholderTextColor={C.muted}
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>Coins to Withdraw (min {WITHDRAWAL_MIN_COINS})</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`${WITHDRAWAL_MIN_COINS}`}
                  placeholderTextColor={C.muted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                {coinsToWithdraw > 0 && (
                  <Text style={styles.conversionText}>
                    = ₹{rupeeValue} ({COINS_PER_RUPEE} coins = ₹1)
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.withdrawBtn, (!validAmount || submitting) && styles.withdrawBtnDisabled]}
                onPress={handleWithdraw}
                disabled={!validAmount || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.withdrawBtnText}>
                    {validAmount ? `💸 Withdraw ₹${rupeeValue}` : 'Enter valid amount'}
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.note}>
                Payouts processed manually within 24-48 hours via UPI.
                Minimum withdrawal: ₹{WITHDRAWAL_MIN_COINS / COINS_PER_RUPEE}
              </Text>
            </View>
          )}

          {/* History */}
          <View style={styles.histSection}>
            <Text style={styles.histTitle}>Withdrawal History</Text>
            {histLoading ? (
              [1, 2].map(i => <SkeletonBox key={i} height={70} style={{ marginBottom: 8, borderRadius: 12 }} />)
            ) : history.length === 0 ? (
              <Text style={styles.emptyText}>No withdrawals yet</Text>
            ) : (
              history.map(item => (
                <View key={item.id} style={styles.histCard}>
                  <View>
                    <Text style={styles.histUpi}>{item.payment_address}</Text>
                    <Text style={styles.histDate}>
                      {new Date(item.requested_at).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.histAmount}>₹{parseFloat(item.rs_value).toFixed(2)}</Text>
                    <Text style={[styles.histStatus, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  balanceCard: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, alignItems: 'center',
    marginBottom: 20, borderWidth: 2, borderColor: C.gold,
  },
  balLabel: { color: C.muted, fontSize: 14 },
  balCoins: { color: C.gold, fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  balRs: { color: C.gem, fontSize: 18, marginTop: 2 },
  lockCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 20, alignItems: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: C.border,
  },
  lockEmoji: { fontSize: 40, marginBottom: 8 },
  lockTitle: { color: C.white, fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  lockSub: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  lockBar: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  lockBarFill: { height: 8, backgroundColor: C.primary, borderRadius: 4 },
  lockProg: { color: C.muted, fontSize: 13 },
  formCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  successBanner: {
    backgroundColor: '#1A2E1A', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: C.success,
  },
  successBannerText: { color: C.success, textAlign: 'center', fontWeight: '600' },
  formTitle: { color: C.white, fontSize: 17, fontWeight: 'bold', marginBottom: 16 },
  inputWrap: { marginBottom: 16 },
  label: { color: C.muted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: C.card, color: C.white, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: C.border,
  },
  conversionText: { color: C.gem, fontSize: 13, marginTop: 6 },
  withdrawBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  withdrawBtnDisabled: { backgroundColor: C.disabled },
  withdrawBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  note: { color: C.disabled, fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  histSection: { marginTop: 4 },
  histTitle: { color: C.white, fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { color: C.muted, textAlign: 'center', paddingVertical: 16 },
  histCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  histUpi: { color: C.white, fontSize: 14, fontWeight: '600' },
  histDate: { color: C.muted, fontSize: 12, marginTop: 2 },
  histAmount: { color: C.gold, fontWeight: 'bold', fontSize: 15 },
  histStatus: { fontSize: 12, marginTop: 2, fontWeight: '600', textTransform: 'capitalize' },
});
