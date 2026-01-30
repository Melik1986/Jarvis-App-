import type {
  OnesConfig,
  StockItem,
  Product,
  InvoiceDto,
  Invoice,
  ODataResponse,
  Catalog_Nomenclature,
  AccumulationRegister_Stock,
} from "./ones.types";

/**
 * Service for integrating with 1C via OData/HTTP.
 * Provides methods for inventory, products, and document operations.
 */
export class OnesService {
  private config: OnesConfig;
  private isConfigured: boolean;

  constructor() {
    this.config = {
      baseUrl: process.env.ONE_C_URL || "",
      username: process.env.ONE_C_USER || "",
      password: process.env.ONE_C_PASSWORD || "",
    };
    this.isConfigured = Boolean(this.config.baseUrl && this.config.username);
  }

  /**
   * Check if 1C integration is configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Get current stock for a product by name
   */
  async getStock(productName: string): Promise<StockItem[]> {
    if (!this.isConfigured) {
      return this.getMockStock(productName);
    }

    try {
      // First find the product
      const products = await this.fetchOData<Catalog_Nomenclature>(
        `Catalog_Номенклатура?$filter=contains(Description,'${encodeURIComponent(productName)}')`,
      );

      if (products.length === 0) {
        return [];
      }

      // Then get stock balances
      const productKeys = products
        .map((p) => `Номенклатура_Key eq guid'${p.Ref_Key}'`)
        .join(" or ");
      const stocks = await this.fetchOData<AccumulationRegister_Stock>(
        `AccumulationRegister_ТоварыНаСкладах/Balance?$filter=${encodeURIComponent(productKeys)}`,
      );

      // Merge product info with stock
      return products.map((product) => {
        const stock = stocks.find(
          (s) => s.Номенклатура_Key === product.Ref_Key,
        );
        return {
          id: product.Ref_Key,
          name: product.Description,
          sku: product.Артикул,
          quantity: stock?.КоличествоBalance || 0,
          unit: "шт",
        };
      });
    } catch (error) {
      console.error("Error fetching stock from 1C:", error);
      return this.getMockStock(productName);
    }
  }

  /**
   * Get products list with optional filter
   */
  async getProducts(filter?: string): Promise<Product[]> {
    if (!this.isConfigured) {
      return this.getMockProducts(filter);
    }

    try {
      const filterQuery = filter
        ? `?$filter=contains(Description,'${encodeURIComponent(filter)}')`
        : "?$top=50";

      const products = await this.fetchOData<Catalog_Nomenclature>(
        `Catalog_Номенклатура${filterQuery}`,
      );

      return products.map((p) => ({
        id: p.Ref_Key,
        name: p.Description,
        sku: p.Артикул,
        isService: p.ЭтоУслуга,
      }));
    } catch (error) {
      console.error("Error fetching products from 1C:", error);
      return this.getMockProducts(filter);
    }
  }

  /**
   * Create a sales invoice in 1C
   */
  async createInvoice(data: InvoiceDto): Promise<Invoice> {
    if (!this.isConfigured) {
      return this.getMockInvoice(data);
    }

    try {
      // In real implementation, this would POST to 1C
      // For now, return mock as placeholder
      console.log("Creating invoice in 1C:", data);
      return this.getMockInvoice(data);
    } catch (error) {
      console.error("Error creating invoice in 1C:", error);
      throw new Error("Failed to create invoice in 1C");
    }
  }

  /**
   * Fetch data from 1C OData endpoint
   */
  private async fetchOData<T>(endpoint: string): Promise<T[]> {
    const url = `${this.config.baseUrl}/${endpoint}`;
    const auth = Buffer.from(
      `${this.config.username}:${this.config.password}`,
    ).toString("base64");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `1C OData error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ODataResponse<T>;
    return data.value || [];
  }

  /**
   * POST data to 1C OData endpoint
   */
  private async postOData<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.config.baseUrl}/${endpoint}`;
    const auth = Buffer.from(
      `${this.config.username}:${this.config.password}`,
    ).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `1C OData error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // =====================
  // Mock data for demo/testing
  // =====================

  private getMockStock(productName: string): StockItem[] {
    const mockData: StockItem[] = [
      {
        id: "1",
        name: "Кофе Arabica 1кг",
        sku: "COFFEE-001",
        quantity: 150,
        unit: "шт",
      },
      {
        id: "2",
        name: "Кофе Robusta 500г",
        sku: "COFFEE-002",
        quantity: 80,
        unit: "шт",
      },
      {
        id: "3",
        name: "Чай зелёный 100г",
        sku: "TEA-001",
        quantity: 200,
        unit: "шт",
      },
      {
        id: "4",
        name: "Сахар 1кг",
        sku: "SUGAR-001",
        quantity: 500,
        unit: "шт",
      },
      { id: "5", name: "Молоко 1л", sku: "MILK-001", quantity: 50, unit: "шт" },
    ];

    const search = productName.toLowerCase();
    return mockData.filter((item) => item.name.toLowerCase().includes(search));
  }

  private getMockProducts(filter?: string): Product[] {
    const mockData: Product[] = [
      { id: "1", name: "Кофе Arabica 1кг", sku: "COFFEE-001", price: 1500 },
      { id: "2", name: "Кофе Robusta 500г", sku: "COFFEE-002", price: 800 },
      { id: "3", name: "Чай зелёный 100г", sku: "TEA-001", price: 350 },
      { id: "4", name: "Сахар 1кг", sku: "SUGAR-001", price: 120 },
      { id: "5", name: "Молоко 1л", sku: "MILK-001", price: 95 },
      { id: "6", name: "Доставка", isService: true, price: 500 },
    ];

    if (!filter) return mockData;
    const search = filter.toLowerCase();
    return mockData.filter((item) => item.name.toLowerCase().includes(search));
  }

  private getMockInvoice(data: InvoiceDto): Invoice {
    const total = data.items.reduce((sum, item) => sum + item.amount, 0);
    return {
      id: `INV-${Date.now()}`,
      number: `РТ-${Math.floor(Math.random() * 10000)}`,
      date: data.date || new Date(),
      customerName: data.customerName || "Покупатель",
      total,
      status: "draft",
    };
  }
}

// Singleton instance
export const onesService = new OnesService();
