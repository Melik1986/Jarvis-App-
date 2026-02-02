import { create } from "zustand";

interface LoadingState {
  isLoading: boolean;
  message: string | null;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  message: null,
  showLoading: (message) => set({ isLoading: true, message: message || null }),
  hideLoading: () => set({ isLoading: false, message: null }),
}));
