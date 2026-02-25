import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../constants/theme';
import { supabase } from '../lib/supabase';

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function AuthScreen({ navigation, route }) {
  const oauthError = route?.params?.oauthError ?? null;
  const [mode, setMode] = useState('login');
  const [ready, setReady] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Signup fields
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Field errors
  const [fieldErrors, setFieldErrors] = useState({});

  const [loading, setLoading] = useState(false);

  // Auto-login: if session exists, skip to main app
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigation.replace('MainTabs');
      } else {
        setReady(true);
      }
    });
  }, []);

  if (!ready) return null;

  // ── LOGIN ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('');
    if (!email.trim() || !password) {
      setLoginError('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(error.message);
      navigation.replace('MainTabs');
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter Email', 'Type your email above, then tap Forgot Password.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) throw new Error(error.message);
      Alert.alert('Reset Link Sent', 'Check your email for a password reset link.');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // Build redirectTo so Google sends the token back to THIS page
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin + window.location.pathname
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      Alert.alert('Google Login Error', e.message);
    }
  };

  // ── SIGNUP ────────────────────────────────────────────────────────
  const validateSignup = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!signupEmail.trim() || !isValidEmail(signupEmail)) errs.email = 'Valid email required';
    if (signupPass.length < 8) errs.password = 'Minimum 8 characters';
    if (signupPass !== confirmPass) errs.confirm = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignup = async () => {
    if (!validateSignup()) return;
    setLoading(true);
    try {
      // 1. Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim().toLowerCase(),
        password: signupPass,
      });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user) throw new Error('Signup failed — no user returned.');

      // 2. Generate referral code
      const refCode = Math.random().toString(36).substr(2, 6).toUpperCase();

      // 3. Insert user row
      const { error: userErr } = await supabase.from('users').insert({
        id: user.id,
        email: signupEmail.trim().toLowerCase(),
        name: name.trim(),
        coins: 0,
        daily_coins: 0,
        gems: 0,
        current_level: 1,
        gems_this_level: 0,
        offer_gate_open: false,
        referral_code: refCode,
        last_reset_date: new Date().toISOString().slice(0, 10),
      });
      if (userErr) throw new Error(userErr.message);

      // 4. Insert streak row
      await supabase.from('user_streaks').insert({
        user_id: user.id,
        streak_count: 0,
        ads_watched_today: 0,
        ads_watched_date: new Date().toISOString().slice(0, 10),
      });

      // 5. Handle referral code bonus
      if (referralCode.trim()) {
        const { data: referrer } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode.trim().toUpperCase())
          .single();
        if (referrer) {
          await supabase.from('users').update({ referred_by: referrer.id }).eq('id', user.id);
          await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: user.id });
          await supabase.rpc('increment_coins', { uid: user.id, amount: 25 });
        }
      }

      navigation.replace('MainTabs');
    } catch (e) {
      Alert.alert('Signup Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={[C.bg, '#0D1B2A']} style={styles.container}>
      {/* OAuth error banner (e.g. Google login denied) */}
      {oauthError && (
        <View style={styles.oauthErrorBanner}>
          <Text style={styles.oauthErrorText}>⚠️ Login failed: {oauthError}</Text>
        </View>
      )}
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

          {/* Tab switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setLoginError(''); setFieldErrors({}); }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setLoginError(''); setFieldErrors({}); }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {mode === 'login' ? (
              <>
                {/* Email */}
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

                {/* Password + eye */}
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 46 }]}
                      placeholder="Your password"
                      placeholderTextColor={C.muted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                      <Ionicons name={showPass ? 'eye' : 'eye-off'} size={20} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Forgot Password */}
                <TouchableOpacity style={styles.forgotWrap} onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.btnText}>Login</Text>}
                </TouchableOpacity>

                {/* Google OAuth — web only */}
                {Platform.OS === 'web' && (
                  <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} activeOpacity={0.85}>
                    <Text style={styles.googleBtnText}>🔍  Continue with Google</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {/* Full Name */}
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.name && styles.inputError]}
                    placeholder="Your full name"
                    placeholderTextColor={C.muted}
                    value={name}
                    onChangeText={t => { setName(t); setFieldErrors(p => ({ ...p, name: '' })); }}
                    autoCapitalize="words"
                  />
                  {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
                </View>

                {/* Email */}
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={[styles.input, fieldErrors.email && styles.inputError]}
                    placeholder="your@email.com"
                    placeholderTextColor={C.muted}
                    value={signupEmail}
                    onChangeText={t => { setSignupEmail(t); setFieldErrors(p => ({ ...p, email: '' })); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
                </View>

                {/* Password */}
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Password (min 8 characters)</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 46 }, fieldErrors.password && styles.inputError]}
                      placeholder="Min 8 characters"
                      placeholderTextColor={C.muted}
                      value={signupPass}
                      onChangeText={t => { setSignupPass(t); setFieldErrors(p => ({ ...p, password: '' })); }}
                      secureTextEntry={!showSignupPass}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowSignupPass(v => !v)}>
                      <Ionicons name={showSignupPass ? 'eye' : 'eye-off'} size={20} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 46 }, fieldErrors.confirm && styles.inputError]}
                      placeholder="Repeat your password"
                      placeholderTextColor={C.muted}
                      value={confirmPass}
                      onChangeText={t => { setConfirmPass(t); setFieldErrors(p => ({ ...p, confirm: '' })); }}
                      secureTextEntry={!showConfirmPass}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPass(v => !v)}>
                      <Ionicons name={showConfirmPass ? 'eye' : 'eye-off'} size={20} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.confirm ? <Text style={styles.fieldError}>{fieldErrors.confirm}</Text> : null}
                </View>

                {/* Referral Code (optional) */}
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Referral Code <Text style={styles.optional}>(optional)</Text></Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ABC123"
                    placeholderTextColor={C.muted}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    autoCapitalize="characters"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btn, loading && styles.btnDisabled]}
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.btnText}>Create Account</Text>}
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.switchHint}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text
                style={styles.switchLink}
                onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setLoginError(''); setFieldErrors({}); }}
              >
                {mode === 'login' ? 'Sign Up' : 'Login'}
              </Text>
            </Text>
          </View>

          <Text style={styles.footer}>Earn coins by playing games & completing offers. Withdraw via UPI!</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },

  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface, borderWidth: 2,
    borderColor: C.primary, justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 32, color: C.white, fontWeight: 'bold', letterSpacing: 1 },
  tagline: { fontSize: 14, color: C.muted, marginTop: 4 },

  tabRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 14, padding: 4, marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.white },
  tabText: { color: C.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#000', fontWeight: 'bold' },

  card: {
    backgroundColor: C.surface, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: C.border,
  },

  inputWrap: { marginBottom: 14 },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  optional: { color: C.disabled, fontSize: 12 },
  input: {
    backgroundColor: C.card, color: C.white, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: C.border,
  },
  inputError: { borderColor: C.error },
  fieldError: { color: C.error, fontSize: 12, marginTop: 4 },

  passwordRow: { flexDirection: 'row', position: 'relative' },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },

  forgotWrap: { alignItems: 'flex-end', marginBottom: 12, marginTop: -4 },
  forgotText: { color: C.blue, fontSize: 13, fontStyle: 'italic' },

  errorText: { color: C.error, fontSize: 13, marginBottom: 10, textAlign: 'center' },

  btn: {
    backgroundColor: C.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: C.white, fontSize: 16, fontWeight: 'bold' },

  googleBtn: {
    marginTop: 12, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  googleBtnText: { color: C.white, fontSize: 15, fontWeight: '600' },

  switchHint: { textAlign: 'center', color: C.muted, marginTop: 16, fontSize: 13 },
  switchLink: { color: C.primary, fontWeight: '600' },

  footer: { textAlign: 'center', color: C.disabled, fontSize: 12, marginTop: 20, lineHeight: 18 },

  oauthErrorBanner: {
    backgroundColor: C.error, paddingVertical: 10, paddingHorizontal: 16,
  },
  oauthErrorText: { color: C.white, fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
});
