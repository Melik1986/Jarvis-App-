import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  replitId?: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt?: number;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  getAccessToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,

      signOut: async () => {
        const { session } = get();
        if (session?.refreshToken) {
          try {
            const baseUrl = getApiUrl();
            await fetch(`${baseUrl}api/auth/logout`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: session.refreshToken }),
            });
          } catch {}
        }
        set({
          user: null,
          session: null,
          isAuthenticated: false,
        });
      },

      refreshSession: async () => {
        const { session } = get();
        if (!session?.refreshToken) return false;

        try {
          const baseUrl = getApiUrl();
          const response = await fetch(`${baseUrl}api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: session.refreshToken }),
          });

          const data = await response.json();

          if (data.success && data.session) {
            const newSession: Session = {
              accessToken: data.session.accessToken,
              refreshToken: data.session.refreshToken,
              expiresIn: data.session.expiresIn,
              expiresAt: Date.now() + data.session.expiresIn * 1000,
            };
            set({ session: newSession, user: data.user || get().user });
            return true;
          }

          get().signOut();
          return false;
        } catch {
          return false;
        }
      },

      setSession: (session) => set({ session, isAuthenticated: !!session }),
      setUser: (user) => set({ user }),
      getAccessToken: () => get().session?.accessToken || null,
    }),
    {
      name: "axon-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
