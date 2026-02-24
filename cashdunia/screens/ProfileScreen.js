import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Modal, TextInput, Switch, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getUser, getOffers, updateUser, getReferralCount } from '../lib/api';
import { supabase } from '../lib/supabase';
import SkeletonBox from '../components/SkeletonBox';

export default function ProfileScreen({ navigation }) {
  const { user: authUser } = useAuthStore();
  const { profile, setProfile, clearProfile } = useUserStore();

  const [offerCount, setOfferCount] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit profile modal
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameToast, setNameToast] = useState(false);
  const toastRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => { if (toastRef.current) clearTimeout(toastRef.current); };
    }, [authUser?.id])
  );

  const loadData = async () => {
    if (!authUser?.id) return;
    setLoading(true);
    try {
      const [userData, offersData, refCount] = await Promise.all([
        getUser(authUser.id),
        getOffers(authUser.id),
        getReferralCount(authUser.id),
      ]);
      setProfile(userData);
      setOfferCount(offersData?.length ?? 0);
      setReferralCount(refCount);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            clearProfile();
            // Global signOut invalidates all sessions (prevents auto-relogin)
            await supabase.auth.signOut({ scope: 'global' });
            // Belt-and-suspenders: wipe AsyncStorage tokens directly
            await AsyncStorage.multiRemove([
              'supabase.auth.token',
              'supabase.auth.refreshToken',
              'sb-qhjcmyszufmbcvdpsdjk-auth-token',
            ]);
            await AsyncStorage.clear();
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          } catch (err) {
            console.error('Logout error:', err);
            Alert.alert('Error', 'Logout failed.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSavingName(true);
    try {
      await updateUser(authUser.id, { name: editName.trim() });
      const updated = await getUser(authUser.id);
      setProfile(updated);
      setEditVisible(false);
      setNameToast(true);
      toastRef.current = setTimeout(() => setNameToast(false), 2500);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingName(false);
    }
  };

  const openEdit = () => {
    setEditName(profile?.name || '');
    setEditVisible(true);
  };

  // Member since
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const displayName = profile?.name || profile?.email?.split('@')[0] || '?';
  const firstLetter = displayName[0].toUpperCase();

  return (
    <View style={styles.container}>
      {/* Name updated toast */}
      {nameToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✅ Name updated!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + Info */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={['#E8175D', '#C01048']}
            style={styles.avatarCircle}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarLetter}>{firstLetter}</Text>
          </LinearGradient>

          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{profile?.email || authUser?.email}</Text>
          {memberSince ? (
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          ) : null}
        </View>

        {/* Stats 2x2 Grid */}
        {loading && !profile ? (
          <View style={styles.statsGrid}>
            {[1, 2, 3, 4].map(i => (
              <SkeletonBox key={i} height={80} style={styles.statCardSkeleton} />
            ))}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: C.gold }]}>{profile?.coins ?? 0}</Text>
              <Text style={styles.statLabel}>🪙 Total Coins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#FF6B35' }]}>{profile?.streak_count ?? 0}</Text>
              <Text style={styles.statLabel}>🔥 Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: C.primary }]}>{offerCount}</Text>
              <Text style={styles.statLabel}>🎁 Offers Done</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: C.blue }]}>{referralCount}</Text>
              <Text style={styles.statLabel}>👥 Friends Invited</Text>
            </View>
          </View>
        )}

        {/* Account Settings */}
        <View style={styles.settingsCard}>
          {/* Edit Profile */}
          <TouchableOpacity style={styles.settingsRow} onPress={openEdit}>
            <Text style={styles.settingsIcon}>👤</Text>
            <Text style={styles.settingsLabel}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.separator} />

          {/* Notifications */}
          <View style={styles.settingsRow}>
            <Text style={styles.settingsIcon}>🔔</Text>
            <Text style={styles.settingsLabel}>Notifications</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.comingSoon}>Coming soon</Text>
              <Switch value={false} onValueChange={() => {}} disabled />
            </View>
          </View>
          <View style={styles.separator} />

          {/* Terms */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => Linking.openURL('https://cashdunia.app/terms')}>
            <Text style={styles.settingsIcon}>📋</Text>
            <Text style={styles.settingsLabel}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.separator} />

          {/* Privacy */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => Linking.openURL('https://cashdunia.app/privacy')}>
            <Text style={styles.settingsIcon}>🔒</Text>
            <Text style={styles.settingsLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.separator} />

          {/* App Version */}
          <View style={styles.settingsRow}>
            <Text style={styles.settingsIcon}>ℹ️</Text>
            <Text style={styles.settingsLabel}>App Version</Text>
            <Text style={styles.versionText}>v1.0.0</Text>
          </View>
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
            <Text style={styles.logoutText}>Log Out</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>Cash Dunia v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditVisible(false)} />
          <View style={styles.editSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.editTitle}>Edit Profile</Text>
            <Text style={styles.editLabel}>Name</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={C.muted}
              autoFocus
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingName && { opacity: 0.6 }]}
              onPress={handleSaveName}
              disabled={savingName}
            >
              {savingName ? <ActivityIndicator color={C.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 54, paddingBottom: 20 },

  toast: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: C.gem, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10, zIndex: 999,
  },
  toastText: { color: C.white, fontWeight: 'bold', fontSize: 14 },

  // Avatar section
  avatarSection: { alignItems: 'center', paddingTop: 10, marginBottom: 24 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarLetter: { color: C.white, fontWeight: 'bold', fontSize: 36 },
  displayName: { color: C.white, fontWeight: 'bold', fontSize: 20, marginBottom: 4 },
  email: { color: C.muted, fontSize: 14, marginBottom: 4 },
  memberSince: { color: '#5A6A82', fontSize: 12, marginTop: 2 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 16, gap: 10, marginBottom: 20,
  },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: C.card,
    borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  statCardSkeleton: { flex: 1, minWidth: '45%', borderRadius: 14 },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 4 },

  // Settings
  settingsCard: {
    backgroundColor: C.card, borderRadius: 12,
    marginHorizontal: 16, marginBottom: 20,
    borderWidth: 1, borderColor: C.border,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingsIcon: { fontSize: 20, marginRight: 12 },
  settingsLabel: { flex: 1, color: C.white, fontSize: 15 },
  versionText: { color: C.muted, fontSize: 14 },
  comingSoon: { color: C.disabled, fontSize: 12 },
  separator: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },

  // Logout
  logoutBtn: {
    marginHorizontal: 16, height: 52, borderRadius: 14,
    borderWidth: 1, borderColor: C.error,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoutText: { color: C.error, fontWeight: 'bold', fontSize: 16 },
  footer: { color: '#5A6A82', fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  editSheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  dragHandle: { width: 40, height: 4, backgroundColor: C.disabled, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  editTitle: { color: C.white, fontWeight: 'bold', fontSize: 18, marginBottom: 16 },
  editLabel: { color: C.muted, fontSize: 13, marginBottom: 6 },
  editInput: {
    backgroundColor: C.card, color: C.white, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: C.white, fontWeight: 'bold', fontSize: 16 },
});
