import { create } from 'zustand';

export const useUserStore = create((set) => ({
  profile: null,
  loading: false,

  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : updates,
    })),

  clearProfile: () => set({ profile: null }),
}));
