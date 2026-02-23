import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C, COINS_PER_RUPEE } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { signOut, getUser, getOffers, getWithdrawals } from '../lib/api';
import SkeletonBox from '../components/SkeletonBox';

export default function ProfileScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile } = useUserStore();
  const [offers, setOffers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const [userData, offersData, withdrawalsData] = await Promise.all([
        getUser(authUser.id),
        getOffers(authUser.id),
        getWithdrawals(authUser.id),
      ]);
      setProfile(userData);
      setOffers(offersData || []);
      setWithdrawals(withdrawalsData || []);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const totalEarned = offers.reduce((sum, o) => sum + (o.coins_awarded || 0), 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.coins_redeemed || 0), 0);

  return (
    <LinearGradient colors={[C.bg, '#0A1628']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || profile?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{profile?.name || 'Player'}</Text>
          <Text style={styles.userEmail}>{profile?.email || authUser?.email}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Level {profile?.current_level ?? 1}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        {loading && !profile ? (
          <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map(i => (
              <SkeletonBox key={i} height={80} style={{ width: '48%', borderRadius: 14 }} />
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: C.gold }]}>{profile?.coins ?? 0}</Text>
              <Text style={styles.statLbl}>🪙 Coins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: C.gem }]}>{profile?.gems ?? 0}</Text>
              <Text style={styles.statLbl}>💎 Gems</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: C.primary }]}>{totalEarned}</Text>
              <Text style={styles.statLbl}>Total Earned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: C.blue }]}>₹{(totalWithdrawn / COINS_PER_RUPEE).toFixed(0)}</Text>
              <Text style={styles.statLbl}>Withdrawn</Text>
            </View>
          </View>
        )}

        {/* Recent Offers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Offers</Text>
          {loading ? (
            [1, 2].map(i => <SkeletonBox key={i} height={60} style={{ marginBottom: 8, borderRadius: 12 }} />)
          ) : offers.slice(0, 5).length === 0 ? (
            <Text style={styles.emptyText}>No completed offers yet</Text>
          ) : (
            offers.slice(0, 5).map(offer => (
              <View key={offer.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>Level {offer.level} — {offer.offer_type}</Text>
                <Text style={styles.itemDate}>
                  {new Date(offer.created_at).toLocaleDateString('en-IN')}
                </Text>
                <Text style={styles.itemCoins}>+{offer.coins_awarded} 🪙</Text>
              </View>
            ))
          )}
        </View>

        {/* Recent Withdrawals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
          {loading ? (
            [1].map(i => <SkeletonBox key={i} height={60} style={{ marginBottom: 8, borderRadius: 12 }} />)
          ) : withdrawals.slice(0, 3).length === 0 ? (
            <Text style={styles.emptyText}>No withdrawals yet</Text>
          ) : (
            withdrawals.slice(0, 3).map(w => (
              <View key={w.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{w.payment_address}</Text>
                <Text style={styles.itemDate}>
                  {new Date(w.requested_at).toLocaleDateString('en-IN')}
                </Text>
                <Text style={[styles.itemCoins, {
                  color: w.status === 'paid' ? C.success : w.status === 'rejected' ? C.error : C.gold,
                }]}>₹{parseFloat(w.rs_value).toFixed(2)} • {w.status}</Text>
              </View>
            ))
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.85}
        >
          {loggingOut ? (
            <ActivityIndicator color={C.error} />
          ) : (
            <>
              <Ionicons name="log-out" size={20} color={C.error} />
              <Text style={styles.logoutText}>  Logout</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56 },
  profileHeader: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.primary, justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
    borderWidth: 3, borderColor: C.surface,
  },
  avatarText: { color: C.white, fontSize: 32, fontWeight: 'bold' },
  userName: { color: C.white, fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  userEmail: { color: C.muted, fontSize: 14, marginBottom: 10 },
  levelBadge: {
    backgroundColor: '#1A0B14', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 6,
    borderWidth: 1, borderColor: C.primary,
  },
  levelBadgeText: { color: C.primary, fontWeight: 'bold', fontSize: 14 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 20,
  },
  statCard: {
    width: '48%', backgroundColor: C.surface,
    borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1,
    borderColor: C.border,
  },
  statVal: { fontSize: 22, fontWeight: 'bold' },
  statLbl: { color: C.muted, fontSize: 12, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { color: C.muted, fontSize: 13 },
  itemCard: {
    backgroundColor: C.surface, borderRadius: 12,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  itemTitle: { color: C.white, fontSize: 13, fontWeight: '600', flex: 1, textTransform: 'capitalize' },
  itemDate: { color: C.muted, fontSize: 11 },
  itemCoins: { color: C.gold, fontWeight: 'bold', fontSize: 13, marginLeft: 8 },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 16,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.error,
  },
  logoutText: { color: C.error, fontWeight: 'bold', fontSize: 16 },
});
