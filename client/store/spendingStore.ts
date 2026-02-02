import { create } from "zustand";
import { persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SpendingData {
  todayUsage: {
    tokens: number;
    requests: number;
  };
  todayCost: number;
  requestLimit: number;
  requestsUsed: number;
  lastResetDate: string; // ISO date string
}

interface SpendingStore extends SpendingData {
  incrementUsage: (tokens: number) => void;
  incrementRequests: () => void;
  resetDaily: () => void;
  setRequestLimit: (limit: number) => void;
}

const getTodayDate = (): string => {
  return new Date().toISOString().split("T")[0];
};

export const useSpendingStore = create<SpendingStore>()(
  persist(
    (set, get) => ({
      todayUsage: {
        tokens: 0,
        requests: 0,
      },
      todayCost: 0,
      requestLimit: 100,
      requestsUsed: 0,
      lastResetDate: getTodayDate(),

      incrementUsage: (tokens: number) => {
        const state = get();
        const today = getTodayDate();

        // Reset if new day
        if (state.lastResetDate !== today) {
          set({
            todayUsage: { tokens, requests: 0 },
            todayCost: 0,
            requestsUsed: 0,
            lastResetDate: today,
          });
          return;
        }

        // Estimate cost (rough approximation: $0.0001 per 1K tokens)
        const estimatedCost = (tokens / 1000) * 0.0001;

        set({
          todayUsage: {
            tokens: state.todayUsage.tokens + tokens,
            requests: state.todayUsage.requests,
          },
          todayCost: state.todayCost + estimatedCost,
        });
      },

      incrementRequests: () => {
        const state = get();
        const today = getTodayDate();

        // Reset if new day
        if (state.lastResetDate !== today) {
          set({
            todayUsage: { tokens: 0, requests: 1 },
            todayCost: 0,
            requestsUsed: 1,
            lastResetDate: today,
          });
          return;
        }

        set({
          todayUsage: {
            tokens: state.todayUsage.tokens,
            requests: state.todayUsage.requests + 1,
          },
          requestsUsed: state.requestsUsed + 1,
        });
      },

      resetDaily: () => {
        set({
          todayUsage: { tokens: 0, requests: 0 },
          todayCost: 0,
          requestsUsed: 0,
          lastResetDate: getTodayDate(),
        });
      },

      setRequestLimit: (limit: number) => {
        set({ requestLimit: limit });
      },
    }),
    {
      name: "spending-storage",
      storage: {
        getItem: async (name: string) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name: string, value: unknown) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name: string) => {
          await AsyncStorage.removeItem(name);
        },
      },
    },
  ),
);
