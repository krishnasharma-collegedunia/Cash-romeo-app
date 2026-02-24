import 'react-native-gesture-handler';
import '@expo/metro-runtime';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { useAuthStore } from './store/authStore';
import AppNavigator from './navigation';
import { C } from './constants/theme';
import { supabase } from './lib/supabase';
import { ensureUserRow } from './lib/api';

export default function App() {
  const { session, loading, initialize } = useAuthStore();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_700Bold,
  });
  const [hashProcessed, setHashProcessed] = useState(false);
  const [hashError, setHashError] = useState(null);

  useEffect(() => {
    const boot = async () => {
      // ── Step 1: On web, check for OAuth redirect tokens in URL hash ──
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1); // strip leading #
        const params = new URLSearchParams(hash);

        const errorCode = params.get('error');
        const errorDesc = params.get('error_description');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        // Always clear the hash from the URL bar immediately
        if (typeof window.history?.replaceState === 'function') {
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
          );
        }

        if (errorCode) {
          // OAuth error (e.g. user denied access)
          setHashError(errorDesc || errorCode);
        } else if (accessToken && refreshToken) {
          try {
            // Establish session from the tokens Google returned
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              setHashError(error.message);
            } else if (data?.session?.user) {
              // Ensure the user profile row exists (first Google login)
              await ensureUserRow(
                data.session.user.id,
                data.session.user.email,
                data.session.user.user_metadata?.full_name ||
                  data.session.user.user_metadata?.name
              );
            }
          } catch (e) {
            setHashError(e.message);
          }
        }
      }

      // ── Step 2: Normal initialization (reads session from storage / just-set) ──
      setHashProcessed(true);
      await initialize();
    };

    boot();
  }, []);

  // Show splash until fonts loaded, hash processed, and auth checked
  if (!fontsLoaded || !hashProcessed || loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>💰</Text>
        <Text style={styles.splashName}>Cash Dunia</Text>
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 24 }} />
        {hashProcessed && !loading && (
          <Text style={styles.splashSub}>Signing you in...</Text>
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator isAuthenticated={!!session} oauthError={hashError} />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: { fontSize: 60 },
  splashName: {
    color: C.white,
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
    letterSpacing: 2,
  },
  splashSub: {
    color: C.muted,
    fontSize: 14,
    marginTop: 8,
  },
});
