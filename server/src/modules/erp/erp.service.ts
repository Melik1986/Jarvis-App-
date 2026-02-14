import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
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
import { ErpAdapter } from "./adapters/erp-adapter.interface";
import { DemoAdapter } from "./adapters/demo.adapter";
import { OneCAdapter } from "./adapters/1c.adapter";
import { OdooAdapter } from "./adapters/odoo.adapter";

@Injectable()
export class ErpService implements OnModuleInit {
  private config!: ErpConfig;
  private isConfigured!: boolean;

  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(CircuitBreakerService)
    private circuitBreaker: CircuitBreakerService,
  ) {}

  onModuleInit() {
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

  private getAdapter(customConfig?: Partial<ErpConfig>): ErpAdapter {
    const config = { ...this.config, ...customConfig };

    switch (config.provider) {
      case "demo":
        if (process.env.NODE_ENV === "production") {
          throw new Error("Demo provider is not allowed in production");
        }
        return new DemoAdapter();
      case "1c":
        if (!config.baseUrl) throw new Error("ERP Base URL is required for 1C");
        return new OneCAdapter(config);
      case "odoo":
        if (!config.baseUrl)
          throw new Error("ERP Base URL is required for Odoo");
        return new OdooAdapter(config);
      default:
        throw new Error(`Unsupported ERP provider: ${config.provider}`);
    }
  }

  async getStock(
    productName?: string,
    customConfig?: Partial<ErpConfig>,
  ): Promise<StockItem[]> {
    const breaker = this.circuitBreaker.getBreaker("erp-get-stock", () =>
      this.getAdapter(customConfig).getStock(productName),
    );

    try {
      return (await breaker.fire()) as StockItem[];
    } catch (error) {
      AppLogger.warn("ERP getStock failed:", error);
      throw error;
    }
  }

  async getProducts(
    filter?: string,
    customConfig?: Partial<ErpConfig>,
  ): Promise<Product[]> {
    const breaker = this.circuitBreaker.getBreaker("erp-get-products", () =>
      this.getAdapter(customConfig).getProducts(filter),
    );

    try {
      return (await breaker.fire()) as Product[];
    } catch (error) {
      AppLogger.warn("ERP getProducts failed:", error);
      throw error;
    }
  }

  async createInvoice(
    request: CreateInvoiceRequest,
    customConfig?: Partial<ErpConfig>,
  ): Promise<Invoice> {
    const breaker = this.circuitBreaker.getBreaker("erp-create-invoice", () =>
      this.getAdapter(customConfig).createInvoice(request),
    );

    try {
      return (await breaker.fire()) as Invoice;
    } catch (error) {
      AppLogger.warn("ERP createInvoice failed:", error);
      throw error;
    }
  }

  async testConnection(customConfig?: Partial<ErpConfig>) {
    const config = { ...this.config, ...customConfig };

    const steps: { name: string; ok: boolean; error?: string }[] = [];

    if (config.provider === "demo") {
      steps.push({ name: "demo", ok: true });
      return { success: true, steps };
    }

    if (!config.baseUrl) {
      steps.push({ name: "baseUrl", ok: false, error: "Missing baseUrl" });
      return { success: false, steps };
    }

    // pingOk unused, but we keep the ping attempt for logging
    try {
      const cleanUrl = (config.baseUrl || "")
        .trim()
        .replace(/^[`'"]+|[`'"]+$/g, "");
      AppLogger.info("ErpService.testConnection: Pinging base URL", {
        url: cleanUrl,
      });
      const pingRes = await fetch(cleanUrl, { method: "GET" });
      steps.push({ name: "ping", ok: pingRes.ok });
    } catch (e) {
      AppLogger.warn("ErpService.testConnection: Ping failed", e);
      steps.push({ name: "ping", ok: false, error: String(e) });
      // We continue even if ping fails, as some ERPs block root path
    }

    try {
      AppLogger.info("ErpService.testConnection: Testing adapter auth", {
        provider: config.provider,
        hasSecret: !!(config.apiKey || config.password),
      });
      const adapter = this.getAdapter(customConfig);
      const ok = adapter.testConnection ? await adapter.testConnection() : true;
      steps.push({ name: "auth_read", ok });
      return { success: ok, steps };
    } catch (e) {
      AppLogger.error("ErpService.testConnection: Adapter test failed", e);
      steps.push({ name: "auth_read", ok: false, error: String(e) });
      return { success: false, steps };
    }
  }
}
