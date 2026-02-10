import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "./authStore";
import { AppLogger } from "@/lib/logger";
import {
  getUserFriendlyMessage,
  logError,
  extractErrorFromResponse,
} from "@/lib/error-handler";

export interface StockItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unit?: string;
  warehouse?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  unit?: string;
  isService?: boolean;
}

interface InventoryState {
  // Cached data (offline-first)
  stockItems: StockItem[];
  products: Product[];
  lastSyncAt: number | null;

  // Loading states
  isLoadingStock: boolean;
  isLoadingProducts: boolean;

  // Actions
  fetchStock: (productName?: string) => Promise<StockItem[]>;
  fetchProducts: (filter?: string) => Promise<Product[]>;
  getOfflineStock: () => StockItem[];
  getOfflineProducts: () => Product[];
  clearCache: () => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      stockItems: [],
      products: [],
      lastSyncAt: null,
      isLoadingStock: false,
      isLoadingProducts: false,

      fetchStock: async (productName?: string) => {
        set({ isLoadingStock: true });

        try {
          const baseUrl = getApiUrl();
          const session = useAuthStore.getState().session;
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (session?.accessToken) {
            headers["Authorization"] = `Bearer ${session.accessToken}`;
          }

          const query = productName
            ? `?product=${encodeURIComponent(productName)}`
            : "";
          const response = await fetch(`${baseUrl}api/1c/stock${query}`, {
            headers,
          });

          if (!response.ok) {
            const apiError = await extractErrorFromResponse(response);
            throw apiError;
          }

          const data = await response.json();
          const items: StockItem[] = data.items || data;

          // Update cache
          set({
            stockItems: items,
            lastSyncAt: Date.now(),
            isLoadingStock: false,
          });

          return items;
        } catch (error) {
          // Log error with context
          logError(error, "inventoryStore.fetchStock", {
            productName,
            hasCachedData: get().stockItems.length > 0,
          });

          set({ isLoadingStock: false });

          // Return cached data on error (offline-first)
          const cachedItems = get().stockItems;

          // If we have cached data, log warning and return it
          if (cachedItems.length > 0) {
            AppLogger.warn(
              "Returning cached stock data due to error:",
              getUserFriendlyMessage(error),
            );
            return cachedItems;
          }

          // If no cached data, throw user-friendly error
          throw new Error(getUserFriendlyMessage(error));
        }
      },

      fetchProducts: async (filter?: string) => {
        set({ isLoadingProducts: true });

        try {
          const baseUrl = getApiUrl();
          const session = useAuthStore.getState().session;
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (session?.accessToken) {
            headers["Authorization"] = `Bearer ${session.accessToken}`;
          }

          const query = filter ? `?filter=${encodeURIComponent(filter)}` : "";
          const response = await fetch(`${baseUrl}api/1c/products${query}`, {
            headers,
          });

          if (!response.ok) {
            const apiError = await extractErrorFromResponse(response);
            throw apiError;
          }

          const data = await response.json();
          const items: Product[] = data.items || data;

          // Update cache
          set({
            products: items,
            lastSyncAt: Date.now(),
            isLoadingProducts: false,
          });

          return items;
        } catch (error) {
          // Log error with context
          logError(error, "inventoryStore.fetchProducts", {
            filter,
            hasCachedData: get().products.length > 0,
          });

          set({ isLoadingProducts: false });

          // Return cached data on error (offline-first)
          const cachedItems = get().products;

          // If we have cached data, log warning and return it
          if (cachedItems.length > 0) {
            AppLogger.warn(
              "Returning cached products data due to error:",
              getUserFriendlyMessage(error),
            );
            return cachedItems;
          }

          // If no cached data, throw user-friendly error
          throw new Error(getUserFriendlyMessage(error));
        }
      },

      getOfflineStock: () => get().stockItems,
      getOfflineProducts: () => get().products,

      clearCache: () =>
        set({
          stockItems: [],
          products: [],
          lastSyncAt: null,
        }),
    }),
    {
      name: "jsrvis-inventory",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        stockItems: state.stockItems,
        products: state.products,
        lastSyncAt: state.lastSyncAt,
      }),
    },
  ),
);
