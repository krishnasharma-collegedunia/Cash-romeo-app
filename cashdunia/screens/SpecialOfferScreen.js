import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, LEVEL_CONFIG } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { getOffers } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function SpecialOfferScreen({ route, navigation }) {
  const { user: authUser } = useAuthStore();
  const level = route?.params?.level ?? 1;
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

  const [activeTab, setActiveTab] = useState('Active');
  const [completedCount, setCompletedCount] = useState(0);
  const [completedOffers, setCompletedOffers] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [authUser?.id])
  );

  const loadData = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      // Hero count from offer_history
      const { count } = await supabase
        .from('offer_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id);
      setCompletedCount(count ?? 0);

      // Completed offers list
      const offers = await getOffers(authUser.id);
      setCompletedOffers(offers || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const description =
    level === 1
      ? `Play the game, watch an ad, then tap Verify to collect ${config.coinsAwarded} coins!`
      : `Play the game, watch an ad, install the app, then tap Verify to collect ${config.coinsAwarded} coins!`;

  const handleStartOffer = () => {
    navigation.navigate('Verify', { level, coins_to_award: config.coinsAwarded });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Special Offer</Text>
        <View style={styles.gemBadge}>
          <Text style={styles.gemBadgeText}>💎</Text>
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        {loading ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <>
            <Text style={styles.heroCount}>{completedCount}</Text>
            <Text style={styles.heroSub}>Activities Completed</Text>
          </>
        )}
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        {['Active', 'Completed'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'Active' ? (
        <View style={styles.activeContent}>
          {/* Single offer card */}
          <TouchableOpacity
            style={styles.offerCard}
            onPress={() => navigation.navigate('Verify', { level, coins_to_award: config.coinsAwarded })}
            activeOpacity={0.88}
          >
            <View style={styles.offerLeft}>
              <Text style={{ fontSize: 28 }}>🪙</Text>
              <Text style={{ fontSize: 24 }}>🪙</Text>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>
            <View style={styles.offerRight}>
              <Text style={styles.offerTitle}>Watch Ad</Text>
              <Text style={styles.offerDesc}>{description}</Text>
              <View style={styles.coinPill}>
                <Text style={styles.coinPillText}>🪙 {config.coinsAwarded}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.levelNote}>
            Level {level} · {config.offerType === 'simple' ? '3 steps' : '5 steps'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={completedOffers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.flatContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 48 }}>🎁</Text>
              <Text style={styles.emptyText}>No completed offers yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.histRow}>
              <View style={styles.histIcon}>
                <Text style={{ fontSize: 20 }}>🎁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.histTitle}>Watch Ad</Text>
                <Text style={styles.histDate}>
                  {new Date(item.created_at).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <Text style={styles.histCoins}>+🪙{item.coins_awarded}</Text>
            </View>
          )}
        />
      )}

      {/* Fixed bottom streak banner */}
      <LinearGradient
        colors={['#E8175D', '#C01048']}
        style={styles.streakBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.streakBannerLeft}>
          <Text style={styles.streakBannerTitle}>🏆 Days Streak</Text>
          <Text style={styles.streakBannerSub}>Complete tasks and collect rewards</Text>
        </View>
        <TouchableOpacity style={styles.streakPill} onPress={() => navigation.navigate('Streak')}>
          <Text style={styles.streakPillText}>Get Start →</Text>
        </TouchableOpacity>
      </LinearGradient>
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
  gemBadge: { width: 40, alignItems: 'flex-end' },
  gemBadgeText: { fontSize: 22 },

  hero: { alignItems: 'center', marginTop: 20, marginBottom: 24 },
  heroCount: { color: C.white, fontSize: 64, fontWeight: 'bold', lineHeight: 72 },
  heroSub: { color: C.muted, fontSize: 14, marginTop: 4 },

  tabRow: {
    flexDirection: 'row', marginHorizontal: 16,
    backgroundColor: C.surface, borderRadius: 12,
    padding: 4, marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: C.blue },
  tabText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: C.white, fontWeight: 'bold' },

  activeContent: { paddingHorizontal: 16 },
  offerCard: {
    flexDirection: 'row', backgroundColor: '#1A2035',
    borderRadius: 14, padding: 20, alignItems: 'center',
  },
  offerLeft: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  offerRight: { flex: 1 },
  offerTitle: { color: C.white, fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  offerDesc: { color: C.muted, fontSize: 13, lineHeight: 18 },
  coinPill: {
    alignSelf: 'flex-start', backgroundColor: '#2563EB',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8,
  },
  coinPillText: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  levelNote: { color: C.disabled, fontSize: 12, marginTop: 10, textAlign: 'center' },

  flatContent: { paddingHorizontal: 16, paddingBottom: 100 },
  emptyBox: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: C.muted, fontSize: 14, marginTop: 12 },

  histRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 10,
    padding: 12, paddingHorizontal: 16, marginBottom: 6,
  },
  histIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563EB', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  histTitle: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  histDate: { color: C.muted, fontSize: 12, marginTop: 2 },
  histCoins: { color: C.gem, fontWeight: 'bold', fontSize: 14 },

  streakBanner: {
    flexDirection: 'row', alignItems: 'center',
    height: 70, paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  streakBannerLeft: { flex: 1 },
  streakBannerTitle: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  streakBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  streakPill: {
    borderWidth: 1, borderColor: C.white,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7,
  },
  streakPillText: { color: C.white, fontWeight: 'bold', fontSize: 13 },
});
