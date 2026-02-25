import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, FlatList,
  Modal, Animated, Platform, KeyboardAvoidingView, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, insertWithdrawal, updateUser, getWithdrawals, deductCoins } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

const TIERS = [
  { coins: 1200, rs: 15 },
  { coins: 2400, rs: 30 },
  { coins: 4800, rs: 60 },
  { coins: 9600, rs: 120 },
];

// UPI validation
const isValidUPI = (id) => {
  if (!id || /\s/.test(id)) return false;
  const parts = id.trim().split('@');
  if (parts.length !== 2) return false;
  if (parts[0].length < 3 || parts[1].length < 2) return false;
  return true;
};

const STATUS_CONFIG = {
  pending:    { label: 'Pending ⏳',     bg: 'rgba(255,201,71,0.15)',  text: '#FFC947' },
  processing: { label: 'Processing 🔄', bg: 'rgba(77,166,255,0.15)',  text: '#4DA6FF' },
  paid:       { label: 'Paid ✅',        bg: 'rgba(0,200,83,0.15)',   text: '#00C853' },
  failed:     { label: 'Failed ❌',      bg: 'rgba(255,71,87,0.15)',  text: '#FF4757' },
};

export default function WithdrawalScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, updateProfile } = useUserStore();

  const [selectedTier, setSelectedTier] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('UPI');
  const [paymentAddress, setPaymentAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Success animation
  const scaleAnim = useRef(new Animated.Value(0.3)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!authUser?.id) return;
    setHistLoading(true);
    try {
      const [userData, wData] = await Promise.all([
        getUser(authUser.id),
        getWithdrawals(authUser.id),
      ]);
      updateProfile({ coins: userData.coins });
      setHistory(wData || []);
    } catch (e) {}
    finally { setHistLoading(false); }
  };

  const currentCoins = profile?.coins ?? 0;

  // Validation
  const isAddressValid = () => {
    if (!paymentAddress.trim()) return false;
    if (selectedMethod === 'UPI') return isValidUPI(paymentAddress);
    return paymentAddress.trim().length >= 5;
  };

  const canSubmit = selectedTier && isAddressValid() && !submitting;

  const handleRedeem = async () => {
    if (!canSubmit) return;

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ₹${selectedTier.rs} to your ${selectedMethod === 'UPI' ? 'UPI ID' : 'Amazon Pay'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await insertWithdrawal({
                user_id: authUser.id,
                coins_redeemed: selectedTier.coins,
                rs_value: selectedTier.rs,
                method: selectedMethod === 'UPI' ? 'upi' : 'amazon_pay',
                payment_address: paymentAddress.trim(),
                status: 'pending',
              });
              await updateUser(authUser.id, { coins: currentCoins - selectedTier.coins });
              updateProfile({ coins: currentCoins - selectedTier.coins });
              await loadData();

              // Show success modal with spring animation
              setSuccessModal(true);
              scaleAnim.setValue(0.3);
              Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
            } catch (e) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const getAddressPlaceholder = () =>
    selectedMethod === 'UPI'
      ? 'Enter UPI ID (e.g. name@paytm)'
      : 'Enter Amazon Pay phone or email';

  const getAddressNote = () =>
    selectedMethod === 'UPI'
      ? 'Format: name@bankname (e.g. 9628213156@ybl)'
      : 'We\'ll send to your Amazon Pay account manually.';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw</Text>
        <Text style={styles.headerCoins}>{currentCoins} 🪙</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balLabel}>Your Balance</Text>
            <Text style={styles.balCoins}>{currentCoins}</Text>
            <Text style={styles.balRs}>= ₹{(currentCoins / 80).toFixed(2)}</Text>
          </View>

          {/* Select Amount */}
          <Text style={styles.sectionTitle}>Select Amount</Text>
          {TIERS.map((tier) => {
            const canAfford = currentCoins >= tier.coins;
            const isSelected = selectedTier?.coins === tier.coins;
            return (
              <TouchableOpacity
                key={tier.coins}
                style={[styles.tierRow, isSelected && styles.tierRowSelected, !canAfford && styles.tierRowLocked]}
                onPress={() => canAfford && setSelectedTier(isSelected ? null : tier)}
                disabled={!canAfford}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.tierCoins}>🪙 {tier.coins}</Text>
                  <Text style={styles.tierArrow}> → </Text>
                  <Text style={styles.tierRs}>₹{tier.rs}</Text>
                </View>
                <View style={[styles.selectBtn, !canAfford && styles.selectBtnLocked]}>
                  <Text style={styles.selectBtnText}>{canAfford ? 'Select' : 'Need more'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Payment Method (shown after tier selected) */}
          {selectedTier && (
            <View style={styles.paymentSection}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <View style={styles.methodToggle}>
                {['UPI', 'Amazon Pay'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.methodPill, selectedMethod === m && styles.methodPillActive]}
                    onPress={() => { setSelectedMethod(m); setPaymentAddress(''); }}
                  >
                    <Text style={[styles.methodPillText, selectedMethod === m && styles.methodPillTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Address input */}
              <View style={styles.addrWrap}>
                <TextInput
                  style={[
                    styles.addrInput,
                    paymentAddress.length > 0 && (isAddressValid() ? styles.inputValid : styles.inputInvalid),
                  ]}
                  placeholder={getAddressPlaceholder()}
                  placeholderTextColor={C.muted}
                  value={paymentAddress}
                  onChangeText={setPaymentAddress}
                  autoCapitalize="none"
                  keyboardType={selectedMethod === 'UPI' ? 'email-address' : 'default'}
                />
                {paymentAddress.length > 0 && selectedMethod === 'UPI' && (
                  <Text style={[styles.upiStatus, { color: isAddressValid() ? C.gem : C.error }]}>
                    {isAddressValid() ? '✅ Valid UPI format' : '❌ Invalid UPI ID format'}
                  </Text>
                )}
                <Text style={styles.addrNote}>{getAddressNote()}</Text>
              </View>

              {/* Redeem Button */}
              <TouchableOpacity
                style={[styles.redeemBtn, !canSubmit && styles.redeemBtnDisabled]}
                onPress={handleRedeem}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={styles.redeemBtnText}>Redeem ₹{selectedTier?.rs}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Past Withdrawals */}
          <Text style={styles.histTitle}>Past Withdrawals</Text>
          {histLoading ? (
            [1, 2].map(i => <SkeletonBox key={i} height={70} style={{ marginBottom: 8, borderRadius: 10 }} />)
          ) : history.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 40 }}>💸</Text>
              <Text style={styles.emptyTitle}>No withdrawals yet</Text>
              <Text style={styles.emptySub}>Earn 1,200 coins to make your first withdrawal!</Text>
            </View>
          ) : (
            history.map((item) => {
              const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              return (
                <View key={item.id} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histRs}>₹{parseFloat(item.rs_value).toFixed(2)}</Text>
                    <Text style={styles.histCoins}>{item.coins_redeemed} 🪙</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                    </View>
                    <Text style={styles.histDate}>
                      {new Date(item.requested_at).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalDim}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={{ fontSize: 56, textAlign: 'center' }}>✅</Text>
            <Text style={styles.successTitle}>Withdrawal Requested!</Text>
            <Text style={styles.successBody}>
              ₹{selectedTier?.rs} will be sent to your {selectedMethod === 'UPI' ? 'UPI ID' : 'Amazon Pay'} within 24-48 hours.
            </Text>
            <Text style={styles.successNote}>We'll process it as soon as possible.</Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => { setSuccessModal(false); setSelectedTier(null); setPaymentAddress(''); navigation.navigate('Home'); }}
            >
              <Text style={styles.successBtnText}>Great!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  headerCoins: { color: C.gold, fontWeight: 'bold', fontSize: 15 },

  scroll: { padding: 16 },

  // Balance
  balanceCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border },
  balLabel: { color: C.muted, fontSize: 13 },
  balCoins: { color: C.gold, fontSize: 40, fontWeight: 'bold', marginTop: 4 },
  balRs: { color: C.muted, fontSize: 14, marginTop: 2 },

  // Section titles
  sectionTitle: { color: C.white, fontWeight: 'bold', fontSize: 16, marginBottom: 10 },

  // Tiers
  tierRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  tierRowSelected: { borderWidth: 2, borderColor: C.primary },
  tierRowLocked: { opacity: 0.5 },
  tierCoins: { color: C.gold, fontWeight: 'bold', fontSize: 15 },
  tierArrow: { color: C.muted },
  tierRs: { color: C.white, fontWeight: 'bold', fontSize: 15 },
  selectBtn: { backgroundColor: C.primary, borderRadius: 17, width: 80, height: 34, alignItems: 'center', justifyContent: 'center' },
  selectBtnLocked: { backgroundColor: C.disabled },
  selectBtnText: { color: C.white, fontWeight: 'bold', fontSize: 13 },

  // Payment section
  paymentSection: { marginTop: 8 },
  methodToggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, padding: 4, marginBottom: 12 },
  methodPill: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  methodPillActive: { backgroundColor: C.primary },
  methodPillText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  methodPillTextActive: { color: C.white, fontWeight: 'bold' },

  // Address input
  addrWrap: { marginBottom: 16 },
  addrInput: { backgroundColor: C.card, color: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1, borderColor: C.border },
  inputValid: { borderColor: C.gem },
  inputInvalid: { borderColor: C.error },
  upiStatus: { fontSize: 12, marginTop: 4, marginLeft: 2 },
  addrNote: { color: C.muted, fontSize: 12, marginTop: 6 },

  // Redeem button
  redeemBtn: { backgroundColor: C.primary, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  redeemBtnDisabled: { backgroundColor: C.disabled },
  redeemBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },

  // History
  histTitle: { color: C.white, fontWeight: 'bold', fontSize: 16, marginBottom: 12, marginTop: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, padding: 12, paddingHorizontal: 16, marginBottom: 6 },
  histRs: { color: C.white, fontWeight: 'bold', fontSize: 15 },
  histCoins: { color: C.muted, fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  histDate: { color: C.muted, fontSize: 11, marginTop: 4 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: C.muted, fontSize: 14, marginTop: 8, fontWeight: '600' },
  emptySub: { color: C.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },

  // Modal
  modalDim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  successCard: { backgroundColor: C.white, borderRadius: 20, padding: 32, width: '100%', alignItems: 'center' },
  successTitle: { color: '#111', fontWeight: 'bold', fontSize: 20, marginTop: 12, textAlign: 'center' },
  successBody: { color: '#555', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  successNote: { color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' },
  successBtn: { backgroundColor: C.primary, borderRadius: 14, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  successBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
