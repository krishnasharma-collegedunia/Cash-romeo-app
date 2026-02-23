import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  'https://qhjcmyszufmbcvdpsdjk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoamNteXN6dWZtYmN2ZHBzZGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Njg5MzQsImV4cCI6MjA4NzI0NDkzNH0.QprqXTkQ7TNNswk_wUqqBoPsUCC61e2ZlsvCMHEDfcY',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
