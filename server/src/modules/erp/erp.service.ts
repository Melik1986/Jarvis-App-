import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ErpConfig,
  StockItem,
  Product,
  Invoice,
  CreateInvoiceRequest,
} from "./erp.types";
import { AppLogger } from "../../utils/logger";
import { CircuitBreakerService } from "../../services/circuit-breaker.service";

@Injectable()
export class ErpService {
  private config: ErpConfig;
  private isConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private circuitBreaker: CircuitBreakerService,
  ) {
    this.config = {
      provider: "1c",
      baseUrl:
        this.configService.get("ERP_URL") ||
        this.configService.get("ONE_C_URL"),
      username:
        this.configService.get("ERP_USER") ||
        this.configService.get("ONE_C_USER"),
      password:
        this.configService.get("ERP_PASSWORD") ||
        this.configService.get("ONE_C_PASSWORD"),
      apiType: "odata",
    };
    this.isConfigured = Boolean(this.config.baseUrl);
  }

  private getAuthHeader(config: ErpConfig): string {
    const user = config.username || this.config.username || "";
    const pass = config.password || this.config.password || "";
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  }

  async getStock(
    productName?: string,
    customConfig?: Partial<ErpConfig>,
  ): Promise<StockItem[]> {
    const config = { ...this.config, ...customConfig };

    if (config.provider === "demo" || !config.baseUrl) {
      return this.getMockStock(productName);
    }

    const breaker = this.circuitBreaker.getBreaker(
      "erp-get-stock",
      async () => {
        let url = `${config.baseUrl}/AccumulationRegister_ТоварыНаСкладах/Balance?$format=json`;
        if (productName) {
          url += `&$filter=contains(Номенклатура/Description,'${encodeURIComponent(productName)}')`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: this.getAuthHeader(config),
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`ERP OData error: ${response.status}`);
        }

        const data = await response.json();
        return (data.value || []).map(
          (item: { Номенклатура_Key: string; КоличествоBalance: number }) => ({
            id: item.Номенклатура_Key,
            name: productName || "Товар",
            quantity: item.КоличествоBalance || 0,
            unit: "шт",
          }),
        );
      },
    );

    try {
      return (await breaker.fire()) as StockItem[];
    } catch (error) {
      AppLogger.warn("ERP getStock failed, using mock fallback:", error);
      if (breaker.opened) {
        AppLogger.warn("Circuit breaker is OPEN for erp-get-stock");
      }
      return this.getMockStock(productName);
    }
  }

  async getProducts(
    filter?: string,
    customConfig?: Partial<ErpConfig>,
  ): Promise<Product[]> {
    const config = { ...this.config, ...customConfig };

    if (config.provider === "demo" || !config.baseUrl) {
      return this.getMockProducts(filter);
    }

    const breaker = this.circuitBreaker.getBreaker(
      "erp-get-products",
      async () => {
        let url = `${config.baseUrl}/Catalog_Номенклатура?$format=json&$select=Ref_Key,Description,Артикул,Цена,ЭтоУслуга`;
        if (filter) {
          url += `&$filter=contains(Description,'${encodeURIComponent(filter)}')`;
        }

        const response = await fetch(url, {
          headers: {
            Authorization: this.getAuthHeader(config),
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`ERP OData error: ${response.status}`);
        }

        const data = await response.json();
        return (data.value || []).map(
          (item: {
            Ref_Key: string;
            Description: string;
            Артикул?: string;
            Цена?: number;
            ЭтоУслуга?: boolean;
          }) => ({
            id: item.Ref_Key,
            name: item.Description,
            sku: item.Артикул,
            price: item.Цена,
            isService: item.ЭтоУслуга,
          }),
        );
      },
    );

    try {
      return (await breaker.fire()) as Product[];
    } catch (error) {
      AppLogger.warn("ERP getProducts failed, using mock fallback:", error);
      if (breaker.opened) {
        AppLogger.warn("Circuit breaker is OPEN for erp-get-products");
      }
      return this.getMockProducts(filter);
    }
  }

  async createInvoice(
    request: CreateInvoiceRequest,
    customConfig?: Partial<ErpConfig>,
  ): Promise<Invoice> {
    const config = { ...this.config, ...customConfig };

    if (config.provider === "demo" || !config.baseUrl) {
      return this.createMockInvoice(request);
    }

    const breaker = this.circuitBreaker.getBreaker(
      "erp-create-invoice",
      async () => {
        const items = request.items.map((item) => ({
          productId: "",
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          amount: item.quantity * item.price,
        }));

        const total = items.reduce((sum, item) => sum + item.amount, 0);

        const documentData = {
          Date: new Date().toISOString(),
          Контрагент: request.customerName,
          Комментарий: request.comment || "",
          Товары: items.map((item) => ({
            Номенклатура: item.productName,
            Количество: item.quantity,
            Цена: item.price,
            Сумма: item.amount,
          })),
        };

        const response = await fetch(
          `${config.baseUrl}/Document_РеализацияТоваровИУслуг?$format=json`,
          {
            method: "POST",
            headers: {
              Authorization: this.getAuthHeader(config),
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(documentData),
          },
        );

        if (!response.ok) {
          throw new Error(`ERP OData error: ${response.status}`);
        }

        const result = await response.json();

        return {
          id: result.Ref_Key || `inv-${Date.now()}`,
          number: result.Number || `РТУ-${Date.now()}`,
          date: result.Date || new Date().toISOString(),
          customerName: request.customerName,
          items,
          total,
          status: "draft",
          comment: request.comment,
        };
      },
    );

    try {
      return (await breaker.fire()) as Invoice;
    } catch (error) {
      AppLogger.warn("ERP createInvoice failed, using mock fallback:", error);
      if (breaker.opened) {
        AppLogger.warn("Circuit breaker is OPEN for erp-create-invoice");
      }
      return this.createMockInvoice(request);
    }
  }

  // Mock data methods
  private getMockStock(productName?: string): StockItem[] {
    const mockStock: StockItem[] = [
      {
        id: "stock-1",
        name: "Кофе арабика 1кг",
        sku: "COFFEE-001",
        quantity: 150,
        unit: "шт",
      },
      {
        id: "stock-2",
        name: "Молоко 1л",
        sku: "MILK-001",
        quantity: 80,
        unit: "шт",
      },
      {
        id: "stock-3",
        name: "Сахар 1кг",
        sku: "SUGAR-001",
        quantity: 200,
        unit: "шт",
      },
      {
        id: "stock-4",
        name: "Печенье шоколадное",
        sku: "COOKIE-001",
        quantity: 45,
        unit: "уп",
      },
    ];

    if (productName) {
      const lowerName = productName.toLowerCase();
      return mockStock.filter((item) =>
        item.name.toLowerCase().includes(lowerName),
      );
    }
    return mockStock;
  }

  private getMockProducts(filter?: string): Product[] {
    const mockProducts: Product[] = [
      {
        id: "prod-1",
        name: "Кофе арабика 1кг",
        sku: "COFFEE-001",
        price: 890,
        isService: false,
      },
      {
        id: "prod-2",
        name: "Молоко 1л",
        sku: "MILK-001",
        price: 89,
        isService: false,
      },
      {
        id: "prod-3",
        name: "Сахар 1кг",
        sku: "SUGAR-001",
        price: 65,
        isService: false,
      },
      {
        id: "prod-4",
        name: "Доставка",
        sku: "DELIVERY-001",
        price: 300,
        isService: true,
      },
    ];

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      return mockProducts.filter((p) =>
        p.name.toLowerCase().includes(lowerFilter),
      );
    }
    return mockProducts;
  }

  private createMockInvoice(request: CreateInvoiceRequest): Invoice {
    const items = request.items.map((item) => ({
      productId: `prod-${Date.now()}`,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      amount: item.quantity * item.price,
    }));

    return {
      id: `inv-${Date.now()}`,
      number: `РТУ-${String(Date.now()).slice(-6)}`,
      date: new Date().toISOString(),
      customerName: request.customerName || "Покупатель",
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      status: "draft",
      comment: request.comment,
    };
  }
}
