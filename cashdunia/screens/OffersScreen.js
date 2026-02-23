import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, LEVEL_CONFIG } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, getOffers } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

export default function OffersScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile } = useUserStore();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadOffers();
    }, [])
  );

  const loadOffers = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const data = await getOffers(authUser.id);
      setOffers(data || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const levelConfig = profile ? LEVEL_CONFIG[profile.current_level] || LEVEL_CONFIG[1] : LEVEL_CONFIG[1];
  const gemsThisLevel = profile?.gems_this_level ?? 0;
  const offerGateOpen = profile?.offer_gate_open ?? false;

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offers</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Current Offer */}
        <Text style={styles.sectionTitle}>Current Offer</Text>
        <View style={[styles.currentOffer, { borderColor: offerGateOpen ? C.gem : C.border }]}>
          <View style={styles.offerRow}>
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>{levelConfig.label}</Text>
            </View>
            <Text style={[styles.offerType, { color: levelConfig.offerType === 'simple' ? C.blue : C.primary }]}>
              {levelConfig.offerType}
            </Text>
          </View>
          <Text style={styles.offerReward}>🪙 {levelConfig.coinsAwarded} coins reward</Text>
          <View style={styles.progRow}>
            <Text style={styles.progLabel}>Gems: {gemsThisLevel}/{levelConfig.gemTarget}</Text>
            <View style={styles.progBg}>
              <View
                style={[
                  styles.progFill,
                  { width: `${Math.min((gemsThisLevel / levelConfig.gemTarget) * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
          {offerGateOpen ? (
            <TouchableOpacity
              style={styles.claimBtn}
              onPress={() => navigation.navigate('SpecialOffer')}
              activeOpacity={0.85}
            >
              <Text style={styles.claimBtnText}>🎉 Claim Now!</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={() => navigation.navigate('Game')}
              activeOpacity={0.85}
            >
              <Text style={styles.playBtnText}>🎮 Play to Earn Gems</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Level Overview */}
        <Text style={styles.sectionTitle}>All Level Offers</Text>
        {Object.entries(LEVEL_CONFIG).map(([lvl, cfg]) => (
          <View
            key={lvl}
            style={[
              styles.lvlCard,
              profile?.current_level === parseInt(lvl) && styles.lvlCardActive,
            ]}
          >
            <View style={styles.lvlRow}>
              <Text style={styles.lvlLabel}>{cfg.label}</Text>
              {profile?.current_level === parseInt(lvl) && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Current</Text>
                </View>
              )}
            </View>
            <View style={styles.lvlDetails}>
              <Text style={styles.lvlDetail}>💎 {cfg.gemTarget} gems needed</Text>
              <Text style={styles.lvlDetail}>🪙 {cfg.coinsAwarded} coins</Text>
              <Text style={styles.lvlDetail}>📱 {cfg.offerType}</Text>
            </View>
          </View>
        ))}

        {/* Completed Offers */}
        <Text style={styles.sectionTitle}>Completed Offers</Text>
        {loading ? (
          [1, 2, 3].map(i => <SkeletonBox key={i} height={70} style={{ marginBottom: 8, borderRadius: 12 }} />)
        ) : offers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🎟️</Text>
            <Text style={styles.emptyText}>No completed offers yet</Text>
            <Text style={styles.emptySub}>Play the game to earn gems and complete offers!</Text>
          </View>
        ) : (
          offers.map(offer => (
            <View key={offer.id} style={styles.histCard}>
              <View>
                <Text style={styles.histLevel}>Level {offer.level} — {offer.offer_type}</Text>
                <Text style={styles.histDate}>
                  {new Date(offer.created_at).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <Text style={styles.histCoins}>+{offer.coins_awarded} 🪙</Text>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
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
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
  currentOffer: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, marginBottom: 20,
    borderWidth: 2,
  },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  offerBadge: { backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  offerBadgeText: { color: C.white, fontSize: 13, fontWeight: '600' },
  offerType: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  offerReward: { color: C.gold, fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  progRow: { marginBottom: 14 },
  progLabel: { color: C.muted, fontSize: 13, marginBottom: 6 },
  progBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progFill: { height: 6, backgroundColor: C.gem, borderRadius: 3 },
  claimBtn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  claimBtnText: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  playBtn: {
    backgroundColor: C.card, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: C.blue,
  },
  playBtnText: { color: C.blue, fontWeight: 'bold', fontSize: 14 },
  lvlCard: {
    backgroundColor: C.surface, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  lvlCardActive: { borderColor: C.primary, backgroundColor: '#1A0B14' },
  lvlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lvlLabel: { color: C.white, fontSize: 15, fontWeight: 'bold' },
  activeBadge: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { color: C.white, fontSize: 11, fontWeight: 'bold' },
  lvlDetails: { flexDirection: 'row', gap: 14 },
  lvlDetail: { color: C.muted, fontSize: 12 },
  emptyCard: {
    backgroundColor: C.surface, borderRadius: 16,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: C.white, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: C.muted, fontSize: 13, textAlign: 'center' },
  histCard: {
    backgroundColor: C.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  histLevel: { color: C.white, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  histDate: { color: C.muted, fontSize: 12, marginTop: 2 },
  histCoins: { color: C.gold, fontWeight: 'bold', fontSize: 15 },
});
