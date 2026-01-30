import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "./authStore";

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

          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          const query = productName
            ? `?product=${encodeURIComponent(productName)}`
            : "";
          const response = await fetch(`${baseUrl}api/1c/stock${query}`, {
            headers,
          });

          if (!response.ok) {
            throw new Error("Failed to fetch stock");
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
          console.error("Error fetching stock:", error);
          set({ isLoadingStock: false });

          // Return cached data on error (offline-first)
          return get().stockItems;
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

          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          const query = filter ? `?filter=${encodeURIComponent(filter)}` : "";
          const response = await fetch(`${baseUrl}api/1c/products${query}`, {
            headers,
          });

          if (!response.ok) {
            throw new Error("Failed to fetch products");
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
          console.error("Error fetching products:", error);
          set({ isLoadingProducts: false });

          // Return cached data on error (offline-first)
          return get().products;
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
