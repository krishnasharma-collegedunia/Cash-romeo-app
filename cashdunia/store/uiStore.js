import { create } from 'zustand';

export const useUIStore = create((set) => ({
  toasts: [],
  globalLoading: false,

  showToast: (message, type = 'info') => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setGlobalLoading: (v) => set({ globalLoading: v }),
}));
