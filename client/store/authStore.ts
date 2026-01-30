import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

export interface User {
  id: string;
  phone?: string;
  email?: string;
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signInWithOtp: (
    phone: string,
  ) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (
    phone: string,
    token: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,

      signInWithOtp: async (phone: string) => {
        set({ isLoading: true });
        try {
          const baseUrl = getApiUrl();
          const response = await fetch(`${baseUrl}api/auth/otp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
          });

          const data = await response.json();
          set({ isLoading: false });

          if (data.success) {
            return { success: true };
          }
          return { success: false, error: data.error || "Failed to send OTP" };
        } catch {
          set({ isLoading: false });
          return { success: false, error: "Network error" };
        }
      },

      verifyOtp: async (phone: string, token: string) => {
        set({ isLoading: true });
        try {
          const baseUrl = getApiUrl();
          const response = await fetch(`${baseUrl}api/auth/otp/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, token }),
          });

          const data = await response.json();

          if (data.success && data.session) {
            const session: Session = {
              ...data.session,
              expires_at: Date.now() + data.session.expires_in * 1000,
            };
            set({
              user: data.user,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: data.error || "Invalid OTP" };
        } catch {
          set({ isLoading: false });
          return { success: false, error: "Network error" };
        }
      },

      signOut: async () => {
        set({
          user: null,
          session: null,
          isAuthenticated: false,
        });
      },

      refreshSession: async () => {
        const { session } = get();
        if (!session?.refresh_token) return false;

        try {
          const baseUrl = getApiUrl();
          const response = await fetch(`${baseUrl}api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });

          const data = await response.json();

          if (data.success && data.session) {
            const newSession: Session = {
              ...data.session,
              expires_at: Date.now() + data.session.expires_in * 1000,
            };
            set({ session: newSession, user: data.user || get().user });
            return true;
          }

          // Refresh failed, sign out
          get().signOut();
          return false;
        } catch {
          return false;
        }
      },

      setSession: (session) => set({ session, isAuthenticated: !!session }),
      setUser: (user) => set({ user }),
    }),
    {
      name: "jsrvis-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
