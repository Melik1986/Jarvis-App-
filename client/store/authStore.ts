import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getApiUrl } from "@/lib/api-config";
import {
  createHybridStorage,
  AUTH_SENSITIVE_PATHS,
} from "@/lib/secure-settings-storage";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  providerPicture?: string | null;
  avatarSource?: "provider" | "local";
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
  setUser: (user: User | Record<string, unknown> | null) => void;
  getAccessToken: () => string | null;
}

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readAvatarSource = (value: unknown): "provider" | "local" | null => {
  if (value === "provider" || value === "local") return value;
  return null;
};

const extractProviderPicture = (
  raw: Record<string, unknown>,
): string | null => {
  const avatarKeys = [
    "providerPicture",
    "provider_picture",
    "picture",
    "avatarUrl",
    "avatar_url",
    "photoURL",
    "photoUrl",
    "photo",
    "imageUrl",
    "image_url",
    "image",
    "profileImageUrl",
    "profile_image_url",
  ] as const;

  for (const key of avatarKeys) {
    const value = readNonEmptyString(raw[key]);
    if (value) return value;
  }

  return null;
};

const normalizeUser = (
  incoming: User | Record<string, unknown> | null,
  previous: User | null,
): User | null => {
  if (!incoming) return null;

  const raw = incoming as Record<string, unknown>;
  const id = readNonEmptyString(raw.id) ?? previous?.id ?? null;
  const email = readNonEmptyString(raw.email) ?? previous?.email ?? null;
  if (!id || !email) {
    return previous;
  }

  const name = readNonEmptyString(raw.name) ?? previous?.name ?? null;
  const replitId =
    readNonEmptyString(raw.replitId) ??
    readNonEmptyString(raw.replit_id) ??
    previous?.replitId ??
    null;

  const providerPicture =
    extractProviderPicture(raw) ?? previous?.providerPicture ?? null;

  const explicitPicture = readNonEmptyString(raw.picture);
  const explicitAvatarSource = readAvatarSource(raw.avatarSource);

  const avatarSource: "provider" | "local" =
    explicitAvatarSource ??
    (previous?.avatarSource === "local" && previous.picture
      ? "local"
      : "provider");

  const picture =
    avatarSource === "local"
      ? (explicitPicture ?? previous?.picture ?? providerPicture)
      : (explicitPicture ?? providerPicture ?? previous?.picture ?? null);

  return {
    id,
    email,
    name,
    picture,
    providerPicture,
    avatarSource,
    replitId,
  };
};

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
            set({
              session: newSession,
              user: normalizeUser(
                (data.user ?? get().user) as
                  | User
                  | Record<string, unknown>
                  | null,
                get().user,
              ),
            });
            return true;
          }

          get().signOut();
          return false;
        } catch {
          return false;
        }
      },

      setSession: (session) => set({ session, isAuthenticated: !!session }),
      setUser: (user) => set({ user: normalizeUser(user, get().user) }),
      getAccessToken: () => get().session?.accessToken || null,
    }),
    {
      name: "axon-auth",
      storage: createJSONStorage(() =>
        createHybridStorage(
          "axon-auth",
          AUTH_SENSITIVE_PATHS,
          "axon-auth-session",
        ),
      ),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
