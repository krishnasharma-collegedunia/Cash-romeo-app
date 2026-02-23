import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../constants/theme';
import { signIn, signUp } from '../lib/api';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim());
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[C.bg, '#0D1B2A']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>💰</Text>
            </View>
            <Text style={styles.appName}>Cash Dunia</Text>
            <Text style={styles.tagline}>Play. Earn. Withdraw.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' && styles.activeTab]}
                onPress={() => setMode('login')}
              >
                <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'signup' && styles.activeTab]}
                onPress={() => setMode('signup')}
              >
                <Text style={[styles.tabText, mode === 'signup' && styles.activeTabText]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {mode === 'signup' && (
              <View style={styles.inputWrap}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={C.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={C.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min 6 characters"
                placeholderTextColor={C.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={styles.btnText}>
                  {mode === 'login' ? 'Login' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.hintLink} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Sign Up' : 'Login'}
              </Text>
            </Text>
          </View>

          <Text style={styles.footer}>Earn coins by completing offers and playing games. Withdraw via UPI!</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface, borderWidth: 2,
    borderColor: C.primary, justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 32, color: C.white, fontWeight: 'bold', letterSpacing: 1 },
  tagline: { fontSize: 14, color: C.muted, marginTop: 4 },
  card: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: C.border,
  },
  tabRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, marginBottom: 24, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: C.primary },
  tabText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  activeTabText: { color: C.white },
  inputWrap: { marginBottom: 16 },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: C.card, color: C.white, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: C.border,
  },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: C.white, fontSize: 16, fontWeight: 'bold' },
  hint: { textAlign: 'center', color: C.muted, marginTop: 16, fontSize: 13 },
  hintLink: { color: C.primary, fontWeight: '600' },
  footer: { textAlign: 'center', color: C.disabled, fontSize: 12, marginTop: 24, lineHeight: 18 },
});
