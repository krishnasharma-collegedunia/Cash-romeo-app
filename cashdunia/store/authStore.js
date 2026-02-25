import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { ensureUserRow } from '../lib/api';

let _authListenerRegistered = false;

export const useAuthStore = create((set) => ({
  session: null,
  user: null,
  loading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    set({ loading: true });
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, loading: false });

    if (!_authListenerRegistered) {
      _authListenerRegistered = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    }
  },
}));
