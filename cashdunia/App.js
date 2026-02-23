import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
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

export default function App() {
  const { session, loading, initialize } = useAuthStore();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_700Bold,
  });

  useEffect(() => {
    initialize();
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>💰</Text>
        <Text style={styles.splashName}>Cash Dunia</Text>
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator isAuthenticated={!!session} />
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
});
