import { useCallback } from "react";
import { useInventoryStore, StockItem, Product } from "@/store/inventoryStore";

/**
 * Hook for working with 1C data (inventory, products).
 * Provides offline-first access to 1C data through the inventory store.
 */
export function use1C() {
  const {
    stockItems,
    products,
    lastSyncAt,
    isLoadingStock,
    isLoadingProducts,
    fetchStock,
    fetchProducts,
    getOfflineStock,
    getOfflineProducts,
    clearCache,
  } = useInventoryStore();

  /**
   * Get stock for a product (tries online first, falls back to cache)
   */
  const getStock = useCallback(
    async (productName?: string): Promise<StockItem[]> => {
      return fetchStock(productName);
    },
    [fetchStock],
  );

  /**
   * Get products list (tries online first, falls back to cache)
   */
  const getProducts = useCallback(
    async (filter?: string): Promise<Product[]> => {
      return fetchProducts(filter);
    },
    [fetchProducts],
  );

  /**
   * Search stock items by name (offline search in cache)
   */
  const searchStockOffline = useCallback(
    (query: string): StockItem[] => {
      const lowerQuery = query.toLowerCase();
      return stockItems.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.sku?.toLowerCase().includes(lowerQuery),
      );
    },
    [stockItems],
  );

  /**
   * Search products by name (offline search in cache)
   */
  const searchProductsOffline = useCallback(
    (query: string): Product[] => {
      const lowerQuery = query.toLowerCase();
      return products.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.sku?.toLowerCase().includes(lowerQuery),
      );
    },
    [products],
  );

  /**
   * Check if cache is stale (older than 5 minutes)
   */
  const isCacheStale = useCallback((): boolean => {
    if (!lastSyncAt) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastSyncAt > fiveMinutes;
  }, [lastSyncAt]);

  /**
   * Sync all data from 1C (refresh cache)
   */
  const syncAll = useCallback(async (): Promise<void> => {
    await Promise.all([fetchStock(), fetchProducts()]);
  }, [fetchStock, fetchProducts]);

  return {
    // Cached data
    stockItems,
    products,
    lastSyncAt,

    // Loading states
    isLoadingStock,
    isLoadingProducts,
    isLoading: isLoadingStock || isLoadingProducts,

    // Online actions (with fallback to cache)
    getStock,
    getProducts,

    // Offline actions
    getOfflineStock,
    getOfflineProducts,
    searchStockOffline,
    searchProductsOffline,

    // Cache management
    isCacheStale,
    syncAll,
    clearCache,
  };
}
