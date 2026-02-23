import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Linking, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, LEVEL_CONFIG, WITHDRAWAL_MIN_COINS } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, getTasks, getStreak, insertWithdrawal, updateUser } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';
import CoinAnimation from '../components/CoinAnimation';

const TIERS = [
  { coins: 1200, rs: 15 },
  { coins: 2400, rs: 30 },
  { coins: 4800, rs: 60 },
  { coins: 9600, rs: 120 },
];

const PAYMENT_METHODS = ['UPI ID', 'Google Play', 'Amazon Pay', 'PayPal'];

// UPI format validation
const isValidUPI = (id) => {
  if (!id) return false;
  const parts = id.trim().split('@');
  if (parts.length !== 2) return false;
  if (parts[0].length < 3) return false;
  if (parts[1].length < 2) return false;
  if (/\s/.test(id)) return false;
  return true;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function HomeScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile, loading, setLoading } = useUserStore();

  // Data state
  const [tasks, setTasks] = useState([]);
  const [streak, setStreak] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Task modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskRunning, setTaskRunning] = useState(false);
  const [taskProgress, setTaskProgress] = useState(0);
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const taskTimerRef = useRef(null);
  const taskProgRef = useRef(null);

  // Redeem modal
  const [redeemVisible, setRedeemVisible] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('UPI ID');
  const [paymentAddress, setPaymentAddress] = useState('');
  const [selectedTier, setSelectedTier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  // ----- Data load -----
  const loadData = useCallback(async () => {
    if (!authUser?.id) return;
    try {
      setLoading(true);
      const [userData, tasksData, streakData] = await Promise.all([
        getUser(authUser.id),
        getTasks(),
        getStreak(authUser.id),
      ]);
      setProfile(userData);
      setTasks(tasksData || []);
      setStreak(streakData);
    } catch (e) {
      console.error('HomeScreen load:', e.message);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (taskTimerRef.current) clearTimeout(taskTimerRef.current);
      if (taskProgRef.current) clearInterval(taskProgRef.current);
    };
  }, []);

  // ----- Derived -----
  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1] : LEVEL_CONFIG[1];
  const gemsThisLevel = profile?.gems_this_level ?? 0;
  const gemTarget = levelConfig.gemTarget;
  const gemProgress = Math.min((gemsThisLevel / gemTarget) * 100, 100);
  const coins = profile?.coins ?? 0;
  const canWithdraw = coins >= WITHDRAWAL_MIN_COINS;
  const firstName = (profile?.name || 'Player').split(' ')[0];

  // ----- Task handling -----
  const handleStartTask = () => {
    if (!selectedTask) return;
    setTaskRunning(true);
    setTaskProgress(0);

    const tick = 100 / 30; // 3s = 30 ticks of 100ms
    let prog = 0;
    taskProgRef.current = setInterval(() => {
      prog += tick;
      setTaskProgress(Math.min(prog, 100));
      if (prog >= 100) {
        clearInterval(taskProgRef.current);
        completeTask();
      }
    }, 100);
  };

  const completeTask = async () => {
    try {
      await updateUser(authUser.id, { coins: coins + selectedTask.coin_reward });
      const updated = await getUser(authUser.id);
      setProfile(updated);
      setShowCoinAnim(true);
      taskTimerRef.current = setTimeout(() => {
        setSelectedTask(null);
        setTaskRunning(false);
        setTaskProgress(0);
      }, 1500);
    } catch (e) {
      setTaskRunning(false);
    }
  };

  // ----- Redeem modal -----
  const openRedeemModal = () => {
    setSelectedMethod('UPI ID');
    setPaymentAddress('');
    setSelectedTier(null);
    setRedeemSuccess(false);
    setRedeemVisible(true);
  };

  const isAddressValid = () => {
    if (!paymentAddress.trim()) return false;
    if (selectedMethod === 'UPI ID') return isValidUPI(paymentAddress);
    if (selectedMethod === 'PayPal') return isValidEmail(paymentAddress);
    return paymentAddress.trim().length >= 5;
  };

  const canSubmitRedeem = selectedTier && isAddressValid() && !submitting;

  const handleRedeem = async () => {
    if (!canSubmitRedeem) return;
    setSubmitting(true);
    try {
      await insertWithdrawal({
        user_id: authUser.id,
        coins_redeemed: selectedTier.coins,
        rs_value: selectedTier.rs,
        method: selectedMethod,
        payment_address: paymentAddress.trim(),
        status: 'pending',
      });
      await updateUser(authUser.id, { coins: coins - selectedTier.coins });
      const updated = await getUser(authUser.id);
      setProfile(updated);
      setRedeemSuccess(true);
      setTimeout(() => {
        setRedeemVisible(false);
        setRedeemSuccess(false);
      }, 2500);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getAddressPlaceholder = () => {
    if (selectedMethod === 'UPI ID') return 'Enter UPI ID (e.g. name@paytm)';
    if (selectedMethod === 'PayPal') return 'Enter PayPal email';
    return 'Enter registered email or phone';
  };

  return (
    <View style={styles.container}>
      <CoinAnimation visible={showCoinAnim} onDone={() => setShowCoinAnim(false)} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* ── SECTION 1: TOP BAR ── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.helloText}>Hello, {firstName}</Text>
            <Text style={styles.welcomeText}>Welcome Back</Text>
          </View>
          <TouchableOpacity style={styles.streakPill} onPress={() => navigation.navigate('Streak')}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakLabel}>Streak</Text>
            {(streak?.streak_count || 0) > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>{streak?.streak_count || 0}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── SECTION 2: BALANCE CARD ── */}
        <TouchableOpacity onPress={openRedeemModal} activeOpacity={0.9}>
          <LinearGradient colors={['#1D6AE5', '#3B82F6']} style={styles.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.balanceLeft}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceCoins}>{coins}</Text>
              <Text style={styles.balanceRs}>₹{(coins / 80).toFixed(2)}</Text>
            </View>
            <View style={styles.balanceRight}>
              <Text style={styles.balanceDeco}>💰</Text>
              <TouchableOpacity style={styles.withdrawPill} onPress={openRedeemModal}>
                <Text style={styles.withdrawPillText}>Withdraw →</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── SECTION 3: WITHDRAW BANNER (if eligible) ── */}
        {canWithdraw && (
          <TouchableOpacity style={styles.withdrawBanner} onPress={openRedeemModal} activeOpacity={0.85}>
            <Text style={styles.withdrawBannerText}>💸 You can withdraw ₹{(coins / 80).toFixed(2)}!</Text>
          </TouchableOpacity>
        )}

        {/* ── SECTION 4: LEVEL PROGRESS WIDGET ── */}
        <TouchableOpacity style={styles.levelWidget} onPress={() => navigation.navigate('Game')} activeOpacity={0.85}>
          <View style={styles.levelWidgetRow}>
            <Text style={styles.levelWidgetTitle}>Level {profile?.current_level ?? 1}/4</Text>
            <Text style={styles.levelWidgetGems}>{gemsThisLevel}/{gemTarget} 💎</Text>
          </View>
          <View style={styles.levelProgBg}>
            <View style={[styles.levelProgFill, { width: `${gemProgress}%` }]} />
          </View>
        </TouchableOpacity>

        {/* ── SECTION 5: ACTIONS ROW ── */}
        <View style={styles.actionsRow}>
          {/* Card A – Super Offers */}
          <TouchableOpacity style={styles.actionCardA} onPress={() => navigation.navigate('Offers')} activeOpacity={0.88}>
            <LinearGradient colors={['#6B21A8', '#7C3AED']} style={styles.actionCardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.actionCardTop}>
                <Text style={styles.actionCardIcon}>🎯</Text>
                <Text style={{ fontSize: 20 }}>🔥</Text>
              </View>
              <View style={styles.actionCardBottom}>
                <Text style={styles.actionCardTitle}>Super Offers</Text>
                <Text style={styles.actionCardSub}>Best activities to try</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Card B – Play Quiz */}
          <TouchableOpacity style={styles.actionCardB} onPress={() => navigation.navigate('Game')} activeOpacity={0.88}>
            <View style={styles.actionCardTop}>
              <Text style={styles.actionCardIcon}>🎮</Text>
              <View style={styles.gemPill}>
                <Text style={styles.gemPillText}>💎 {gemsThisLevel}</Text>
              </View>
            </View>
            <View style={styles.actionCardBottom}>
              <Text style={styles.actionCardTitle}>Play Quiz</Text>
              <Text style={styles.actionCardSubMuted}>Tap the moles!</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── SECTION 6: PARTNER OFFERS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partnerRow}>
          {/* HangAds */}
          <TouchableOpacity
            style={[styles.partnerCard, { backgroundColor: '#1A1A2E', width: 110, height: 130 }]}
            onPress={() => Linking.openURL('https://hangmyads.com')}
          >
            <Text style={styles.partnerHangAds1}>HANG</Text>
            <Text style={styles.partnerHangAds2}>ADS</Text>
            <Text style={styles.partnerCardLabel}>hangads</Text>
          </TouchableOpacity>

          {/* Playtime – RECOMMENDED */}
          <TouchableOpacity
            style={[styles.partnerCard, { backgroundColor: '#F97316', width: 110, height: 145 }]}
            onPress={() => navigation.navigate('Offers')}
          >
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
            <Text style={{ fontSize: 36, marginTop: 8 }}>🎮</Text>
            <Text style={styles.partnerPlaytime}>Playtime</Text>
          </TouchableOpacity>

          {/* WannAds */}
          <TouchableOpacity
            style={[styles.partnerCard, { backgroundColor: '#1A1A2E', width: 110, height: 130 }]}
            onPress={() => Linking.openURL('https://wannads.com')}
          >
            <Text style={styles.partnerWannNN}>NN</Text>
            <Text style={styles.partnerWannWann}>WANNADS</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── SECTION 7: TOP TASKS ── */}
        <View style={styles.taskSection}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskHeaderTitle}>Top Tasks</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Streak')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskRow}>
            {loading && tasks.length === 0
              ? [1, 2, 3].map(i => <SkeletonBox key={i} width={110} height={100} borderRadius={14} style={{ marginRight: 12 }} />)
              : tasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskCard, { backgroundColor: task.icon_color || C.primary }]}
                    onPress={() => { setSelectedTask(task); setTaskRunning(false); setTaskProgress(0); }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.taskRewardBadge}>
                      <Text style={styles.taskRewardBadgeText}>🪙{task.coin_reward}</Text>
                    </View>
                    <Text style={styles.taskCardTitle}>{task.title}</Text>
                  </TouchableOpacity>
                ))
            }
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── TASK MODAL ── */}
      <Modal visible={!!selectedTask} transparent animationType="slide" onRequestClose={() => !taskRunning && setSelectedTask(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => !taskRunning && setSelectedTask(null)} />
          <View style={styles.taskSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.taskSheetTitle}>{selectedTask?.title}</Text>
            <Text style={styles.taskSheetDesc}>{selectedTask?.description}</Text>
            <View style={styles.taskRewardPill}>
              <Text style={styles.taskRewardPillText}>🪙 {selectedTask?.coin_reward} coins</Text>
            </View>

            {taskRunning && (
              <View style={styles.taskProgBg}>
                <View style={[styles.taskProgFill, { width: `${taskProgress}%` }]} />
              </View>
            )}

            {showCoinAnim && !selectedTask ? null : (
              <TouchableOpacity
                style={[styles.startTaskBtn, taskRunning && { opacity: 0.6 }]}
                onPress={handleStartTask}
                disabled={taskRunning}
                activeOpacity={0.85}
              >
                {taskRunning ? <ActivityIndicator color={C.white} /> : <Text style={styles.startTaskBtnText}>Start Task</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── REDEEM MODAL ── */}
      <Modal visible={redeemVisible} transparent animationType="slide" onRequestClose={() => setRedeemVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setRedeemVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.redeemSheet}>
              <View style={styles.dragHandle} />

              {/* Header */}
              <View style={styles.redeemHeader}>
                <Text style={styles.redeemTitle}>Redeem Coins</Text>
                <Text style={styles.redeemCountry}>🇮🇳 India</Text>
              </View>

              {redeemSuccess ? (
                <View style={styles.redeemSuccessBox}>
                  <Text style={{ fontSize: 40 }}>✅</Text>
                  <Text style={styles.redeemSuccessText}>Withdrawal Requested!</Text>
                  <Text style={styles.redeemSuccessSub}>
                    ₹{selectedTier?.rs} will be sent within 24-48 hours
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Step 1: Payment Method */}
                  <Text style={styles.redeemStep}>Select Payment Method</Text>
                  {PAYMENT_METHODS.map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[styles.methodRow, selectedMethod === method && styles.methodRowActive]}
                      onPress={() => { setSelectedMethod(method); setPaymentAddress(''); }}
                    >
                      <View style={[styles.radio, selectedMethod === method && styles.radioActive]} />
                      <Text style={styles.methodIcon}>
                        {method === 'UPI ID' ? '💳' : method === 'Google Play' ? '🎮' : method === 'Amazon Pay' ? '📦' : '🅿️'}
                      </Text>
                      <Text style={styles.methodText}>{method}</Text>
                    </TouchableOpacity>
                  ))}

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
                      keyboardType={selectedMethod === 'UPI ID' || selectedMethod === 'PayPal' ? 'email-address' : 'default'}
                    />
                    {paymentAddress.length > 0 && (
                      <Text style={[styles.addrStatus, { color: isAddressValid() ? C.gem : C.error }]}>
                        {isAddressValid() ? '✅ Valid' : selectedMethod === 'UPI ID' ? '❌ Invalid UPI (use name@bank format)' : '❌ Invalid format'}
                      </Text>
                    )}
                  </View>

                  {/* Step 2: Select Amount */}
                  <Text style={styles.redeemStep}>Select Amount</Text>
                  {TIERS.map((tier) => {
                    const canAfford = coins >= tier.coins;
                    const isSelected = selectedTier?.coins === tier.coins;
                    return (
                      <TouchableOpacity
                        key={tier.coins}
                        style={[styles.tierRow, isSelected && styles.tierRowSelected, !canAfford && { opacity: 0.5 }]}
                        onPress={() => canAfford && setSelectedTier(tier)}
                        disabled={!canAfford}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.tierCoins}>{tier.coins} 🪙</Text>
                        <Text style={styles.tierEq}>=</Text>
                        <Text style={styles.tierRs}>₹{tier.rs}</Text>
                        <View style={[styles.tierSelectBtn, !canAfford && { backgroundColor: C.disabled }]}>
                          <Text style={styles.tierSelectText}>{canAfford ? 'Select' : 'Need more'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Submit */}
                  <TouchableOpacity
                    style={[styles.redeemSubmitBtn, !canSubmitRedeem && { backgroundColor: C.disabled }]}
                    onPress={handleRedeem}
                    disabled={!canSubmitRedeem}
                    activeOpacity={0.85}
                  >
                    {submitting
                      ? <ActivityIndicator color={C.white} />
                      : <Text style={styles.redeemSubmitText}>
                          Redeem {selectedTier ? `₹${selectedTier.rs}` : '—'}
                        </Text>
                    }
                  </TouchableOpacity>
                  <Text style={styles.redeemNote}>Processed manually within 24-48 hours</Text>
                  <View style={{ height: 24 }} />
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 54, paddingBottom: 20 },

  // Top bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  helloText: { color: C.blue, fontSize: 13 },
  welcomeText: { color: C.white, fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  streakPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  streakFire: { fontSize: 18, marginRight: 4 },
  streakLabel: { color: C.white, fontSize: 14 },
  streakBadge: { backgroundColor: '#E8175D', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: 6 },
  streakBadgeText: { color: C.white, fontSize: 11, fontWeight: 'bold' },

  // Balance card
  balanceCard: { marginHorizontal: 16, borderRadius: 18, height: 130, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  balanceLeft: { flex: 1 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 4 },
  balanceCoins: { color: C.gold, fontSize: 32, fontWeight: 'bold' },
  balanceRs: { color: C.muted, fontSize: 14, marginTop: 2 },
  balanceRight: { alignItems: 'center', gap: 10 },
  balanceDeco: { fontSize: 36 },
  withdrawPill: { backgroundColor: C.white, borderRadius: 18, height: 36, paddingHorizontal: 16, justifyContent: 'center' },
  withdrawPillText: { color: '#1D6AE5', fontWeight: 'bold', fontSize: 13 },

  // Withdraw banner
  withdrawBanner: { backgroundColor: C.gem, borderRadius: 12, marginHorizontal: 16, padding: 14, alignItems: 'center', marginBottom: 12 },
  withdrawBannerText: { color: C.white, fontWeight: 'bold', fontSize: 14 },

  // Level widget
  levelWidget: { backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12 },
  levelWidgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelWidgetTitle: { color: C.white, fontSize: 14, fontWeight: 'bold' },
  levelWidgetGems: { color: C.gem, fontSize: 13, fontWeight: 'bold' },
  levelProgBg: { height: 8, backgroundColor: C.surface, borderRadius: 4, overflow: 'hidden' },
  levelProgFill: { height: 8, backgroundColor: C.gem, borderRadius: 4 },

  // Actions row
  actionsRow: { flexDirection: 'row', marginHorizontal: 16, gap: 12, marginBottom: 20 },
  actionCardA: { flex: 1, borderRadius: 16, overflow: 'hidden', height: 120 },
  actionCardGradient: { flex: 1, padding: 14, justifyContent: 'space-between' },
  actionCardB: { flex: 1, backgroundColor: C.surface, borderRadius: 16, height: 120, padding: 14, justifyContent: 'space-between' },
  actionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actionCardIcon: { fontSize: 24 },
  actionCardBottom: {},
  actionCardTitle: { color: C.white, fontSize: 16, fontWeight: 'bold' },
  actionCardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  actionCardSubMuted: { color: C.muted, fontSize: 12, marginTop: 2 },
  gemPill: { backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  gemPillText: { color: C.white, fontWeight: 'bold', fontSize: 13 },

  // Partner offers
  partnerRow: { paddingHorizontal: 16, gap: 12, marginBottom: 20 },
  partnerCard: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 10 },
  partnerHangAds1: { color: '#E8175D', fontWeight: 'bold', fontSize: 16 },
  partnerHangAds2: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  partnerCardLabel: { color: C.white, fontSize: 11, marginTop: 8 },
  recommendedBadge: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  recommendedText: { color: C.white, fontSize: 9, fontWeight: 'bold' },
  partnerPlaytime: { color: C.white, fontWeight: 'bold', fontSize: 18, marginTop: 4 },
  partnerWannNN: { color: C.white, fontWeight: 'bold', fontSize: 24 },
  partnerWannWann: { color: C.white, fontWeight: 'bold', fontSize: 14 },

  // Top tasks
  taskSection: { marginHorizontal: 16, marginBottom: 12 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  taskHeaderTitle: { color: C.white, fontSize: 18, fontWeight: 'bold' },
  seeAll: { color: C.blue, fontSize: 13 },
  taskRow: { gap: 12, paddingBottom: 4 },
  taskCard: { width: 110, height: 100, borderRadius: 14, padding: 10, justifyContent: 'space-between' },
  taskRewardBadge: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  taskRewardBadgeText: { color: C.white, fontSize: 11 },
  taskCardTitle: { color: C.white, fontWeight: 'bold', fontSize: 13 },

  // Modal overlay
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  dragHandle: { width: 40, height: 4, backgroundColor: C.disabled, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  // Task modal sheet
  taskSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  taskSheetTitle: { color: C.white, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  taskSheetDesc: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  taskRewardPill: { alignSelf: 'flex-start', backgroundColor: '#2A2000', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: C.gold },
  taskRewardPillText: { color: C.gold, fontWeight: 'bold', fontSize: 14 },
  taskProgBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  taskProgFill: { height: 6, backgroundColor: C.gem, borderRadius: 3 },
  startTaskBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  startTaskBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },

  // Redeem modal sheet
  redeemSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  redeemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  redeemTitle: { color: C.white, fontSize: 18, fontWeight: 'bold' },
  redeemCountry: { color: C.muted, fontSize: 12 },
  redeemStep: { color: C.white, fontWeight: 'bold', fontSize: 14, marginTop: 12, marginBottom: 8 },

  // Method rows
  methodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  methodRowActive: { borderColor: C.primary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.disabled, marginRight: 12 },
  radioActive: { borderColor: C.primary, backgroundColor: C.primary },
  methodIcon: { fontSize: 18, marginRight: 10 },
  methodText: { color: C.white, fontSize: 14 },

  // Address input
  addrWrap: { marginBottom: 4 },
  addrInput: { backgroundColor: C.card, color: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, borderWidth: 1, borderColor: C.border },
  inputValid: { borderColor: C.gem },
  inputInvalid: { borderColor: C.error },
  addrStatus: { fontSize: 12, marginTop: 4, marginLeft: 4 },

  // Tiers
  tierRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  tierRowSelected: { borderColor: C.primary, borderWidth: 2 },
  tierCoins: { color: C.gold, fontWeight: 'bold', fontSize: 15, flex: 1 },
  tierEq: { color: C.muted, marginHorizontal: 8 },
  tierRs: { color: C.white, fontWeight: 'bold', fontSize: 15, flex: 1 },
  tierSelectBtn: { backgroundColor: C.primary, borderRadius: 17, width: 80, height: 34, alignItems: 'center', justifyContent: 'center' },
  tierSelectText: { color: C.white, fontSize: 13, fontWeight: 'bold' },

  // Redeem submit
  redeemSubmitBtn: { backgroundColor: C.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  redeemSubmitText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
  redeemNote: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Redeem success
  redeemSuccessBox: { alignItems: 'center', paddingVertical: 32 },
  redeemSuccessText: { color: C.white, fontWeight: 'bold', fontSize: 20, marginTop: 12 },
  redeemSuccessSub: { color: C.muted, fontSize: 14, marginTop: 8, textAlign: 'center' },
});
