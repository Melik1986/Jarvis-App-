import {
  ErpConfig,
  StockItem,
  Product,
  Invoice,
  CreateInvoiceRequest,
} from "../erp.types";
import { ErpAdapter } from "./erp-adapter.interface";

export class OdooAdapter implements ErpAdapter {
  constructor(private config: ErpConfig) {}

  private cleanText(value: string | undefined): string | undefined {
    if (typeof value !== "string") return undefined;
    const cleaned = value.trim().replace(/^[`'"]+|[`'"]+$/g, "");
    return cleaned || undefined;
  }

  private getJsonRpcUrl(): string {
    const raw = (this.config.baseUrl || "")
      .trim()
      .replace(/^[`'"]+|[`'"]+$/g, "");
    try {
      const url = new URL(raw);
      const cleanedPath = url.pathname.replace(/\/+$/, "");
      if (cleanedPath === "/odoo" || cleanedPath.endsWith("/odoo")) {
        const newPath = cleanedPath.slice(0, -"/odoo".length) || "/";
        url.pathname = newPath;
      }
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/jsonrpc`;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      const cleaned = raw.replace(/\/+$/, "");
      const base = cleaned.endsWith("/odoo")
        ? cleaned.slice(0, -"/odoo".length) || "/"
        : cleaned;
      return `${base.replace(/\/+$/, "")}/jsonrpc`;
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      throw new Error("Unexpected Odoo response shape");
    }
    return value;
  }

  private asArray(value: unknown): unknown[] {
    if (!Array.isArray(value)) {
      throw new Error("Unexpected Odoo response shape");
    }
    return value;
  }

  private getString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private getNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
  }

  private getTuple2(value: unknown): [number, string] | undefined {
    if (!Array.isArray(value) || value.length < 2) return undefined;
    const [a, b] = value;
    if (typeof a === "number" && typeof b === "string") return [a, b];
    return undefined;
  }

  private normalizeSearchTerm(value?: string): string | undefined {
    const cleaned = this.cleanText(value);
    if (!cleaned) return undefined;
    const noTrailingPunctuation = cleaned.replace(/[.,!?;:]+$/g, "").trim();
    return noTrailingPunctuation || undefined;
  }

  private tokenizeSearchTerms(value?: string): string[] {
    const normalized = this.normalizeSearchTerm(value);
    if (!normalized) return [];
    return normalized
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);
  }

  private matchesSearchTokens(
    record: Record<string, unknown>,
    tokens: string[],
  ): boolean {
    if (tokens.length === 0) return true;
    const fields = [
      this.getString(record.name),
      this.getString(record.display_name),
      this.getString(record.default_code),
      this.getString(record.barcode),
    ].filter((value): value is string => Boolean(value));
    if (fields.length === 0) return false;
    const haystack = fields.join(" ").toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  }

  private filterRecordsByTokens(
    records: Record<string, unknown>[],
    tokens: string[],
  ): Record<string, unknown>[] {
    if (tokens.length === 0) return records;
    return records.filter((record) => this.matchesSearchTokens(record, tokens));
  }

  /**
   * Build args for Odoo search/search_read methods.
   * The first positional arg is a domain.
   */
  private buildProductSearchArgs(filter?: string): unknown[] {
    const query = this.normalizeSearchTerm(filter);
    if (!query) return [[]];
    const domain: unknown[] = [
      "|",
      "|",
      ["name", "ilike", query],
      ["default_code", "ilike", query],
      ["barcode", "ilike", query],
    ];
    return [domain];
  }

  private mapStockItem(record: Record<string, unknown>): StockItem {
    const uom = this.getTuple2(record.uom_id);
    const name =
      this.getString(record.name) ||
      this.getString(record.display_name) ||
      "Unnamed product";
    return {
      id: String(this.getNumber(record.id) ?? ""),
      name,
      sku: this.getString(record.default_code) || "",
      quantity: this.getNumber(record.qty_available) ?? 0,
      unit: uom?.[1] || "pcs",
    };
  }

  private mapProduct(record: Record<string, unknown>): Product {
    const uom = this.getTuple2(record.uom_id);
    const kind =
      this.getString(record.detailed_type) || this.getString(record.type);
    const name =
      this.getString(record.name) ||
      this.getString(record.display_name) ||
      "Unnamed product";
    return {
      id: String(this.getNumber(record.id) ?? ""),
      name,
      sku: this.getString(record.default_code) || "",
      price: this.getNumber(record.list_price),
      quantity: this.getNumber(record.qty_available),
      unit: uom?.[1] || "pcs",
      isService: kind === "service",
    };
  }

  /**
   * Universal JSON-RPC client for Odoo.
   * Uses standard /jsonrpc endpoint which works with all Odoo versions (16-19).
   */
  private async jsonRpc(
    service: "common" | "object",
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    const url = this.getJsonRpcUrl();
    const body = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service,
        method,
        args,
      },
      id: Math.floor(Math.random() * 1000),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Odoo JSON-RPC HTTP error: ${response.status}`);
    }

    const json: unknown = await response.json();
    const root = this.asRecord(json);
    if (root.error) {
      const errorObj = this.asRecord(root.error);
      const message = this.getString(errorObj.message) || "Unknown error";
      const data = errorObj.data ? this.asRecord(errorObj.data) : undefined;
      const dataMessage = data ? this.getString(data.message) : undefined;
      throw new Error(
        `Odoo JSON-RPC error: ${message}${dataMessage ? ` (${dataMessage})` : ""}`,
      );
    }

    return root.result;
  }

  /**
   * Execute model method (search_read, create, etc.)
   */
  private async executeKw(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<unknown> {
    const db = this.cleanText(this.config.db);
    const username = this.cleanText(this.config.username);
    const apiKey = this.cleanText(this.config.apiKey);
    if (!db || !username || !apiKey) {
      throw new Error("Odoo configuration missing: db, username, or apiKey");
    }

    // Authenticate first (get UID)
    // Optimization: In a real app, we should cache UID.
    const uidResult = await this.jsonRpc("common", "authenticate", [
      db,
      username,
      apiKey,
      {},
    ]);

    const uid = this.getNumber(uidResult);
    if (!uid) {
      throw new Error("Odoo authentication failed");
    }

    return this.jsonRpc("object", "execute_kw", [
      db,
      uid,
      apiKey,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  async testConnection(): Promise<boolean> {
    const db = this.cleanText(this.config.db);
    const username = this.cleanText(this.config.username);
    const apiKey = this.cleanText(this.config.apiKey);
    if (!db || !username || !apiKey || !this.config.baseUrl) {
      throw new Error(
        "Odoo configuration missing: baseUrl, db, username, or apiKey",
      );
    }

    const uidResult = await this.jsonRpc("common", "authenticate", [
      db,
      username,
      apiKey,
      {},
    ]);
    const uid = this.getNumber(uidResult);
    if (!uid) {
      throw new Error("Odoo authentication failed: invalid db/login/apiKey");
    }

    const res = await this.jsonRpc("object", "execute_kw", [
      db,
      uid,
      apiKey,
      "res.partner",
      "search",
      [[]],
      { limit: 1 },
    ]);

    return Array.isArray(res);
  }

  async getStock(productName?: string): Promise<StockItem[]> {
    const searchTokens = this.tokenizeSearchTerms(productName);
    const searchArgs = this.buildProductSearchArgs(productName);
    const fields = [
      "name",
      "default_code",
      "barcode",
      "qty_available",
      "uom_id",
    ];

    const productsUnknown = await this.executeKw(
      "product.product",
      "search_read",
      searchArgs,
      { fields, limit: 50 } as Record<string, unknown>,
    );

    const products = this.asArray(productsUnknown);
    if (products.length > 0) {
      return products.map((pUnknown) =>
        this.mapStockItem(this.asRecord(pUnknown)),
      );
    }

    if (searchTokens.length > 1) {
      const broadProductsUnknown = await this.executeKw(
        "product.product",
        "search_read",
        [[]],
        { fields, limit: 200 } as Record<string, unknown>,
      );
      const broadProducts = this.asArray(broadProductsUnknown).map((pUnknown) =>
        this.asRecord(pUnknown),
      );
      const matchedProducts = this.filterRecordsByTokens(
        broadProducts,
        searchTokens,
      );
      if (matchedProducts.length > 0) {
        return matchedProducts.map((record) => this.mapStockItem(record));
      }
    }

    const templatesUnknown = await this.executeKw(
      "product.template",
      "search_read",
      searchArgs,
      { fields, limit: 50 } as Record<string, unknown>,
    );
    const templates = this.asArray(templatesUnknown);
    if (templates.length > 0) {
      return templates.map((tUnknown) =>
        this.mapStockItem(this.asRecord(tUnknown)),
      );
    }

    if (searchTokens.length > 1) {
      const broadTemplatesUnknown = await this.executeKw(
        "product.template",
        "search_read",
        [[]],
        { fields, limit: 200 } as Record<string, unknown>,
      );
      const broadTemplates = this.asArray(broadTemplatesUnknown).map(
        (tUnknown) => this.asRecord(tUnknown),
      );
      const matchedTemplates = this.filterRecordsByTokens(
        broadTemplates,
        searchTokens,
      );
      return matchedTemplates.map((record) => this.mapStockItem(record));
    }

    return [];
  }

  async getProducts(filter?: string): Promise<Product[]> {
    const searchTokens = this.tokenizeSearchTerms(filter);
    const searchArgs = this.buildProductSearchArgs(filter);
    const fields = [
      "name",
      "default_code",
      "barcode",
      "list_price",
      "detailed_type",
      "type",
      "qty_available",
      "uom_id",
    ];

    const productsUnknown = await this.executeKw(
      "product.product",
      "search_read",
      searchArgs,
      { fields, limit: 50 } as Record<string, unknown>,
    );

    const products = this.asArray(productsUnknown);
    if (products.length > 0) {
      return products.map((pUnknown) =>
        this.mapProduct(this.asRecord(pUnknown)),
      );
    }

    if (searchTokens.length > 1) {
      const broadProductsUnknown = await this.executeKw(
        "product.product",
        "search_read",
        [[]],
        { fields, limit: 200 } as Record<string, unknown>,
      );
      const broadProducts = this.asArray(broadProductsUnknown).map((pUnknown) =>
        this.asRecord(pUnknown),
      );
      const matchedProducts = this.filterRecordsByTokens(
        broadProducts,
        searchTokens,
      );
      if (matchedProducts.length > 0) {
        return matchedProducts.map((record) => this.mapProduct(record));
      }
    }

    const templatesUnknown = await this.executeKw(
      "product.template",
      "search_read",
      searchArgs,
      { fields, limit: 50 } as Record<string, unknown>,
    );
    const templates = this.asArray(templatesUnknown);
    if (templates.length > 0) {
      return templates.map((tUnknown) =>
        this.mapProduct(this.asRecord(tUnknown)),
      );
    }

    if (searchTokens.length > 1) {
      const broadTemplatesUnknown = await this.executeKw(
        "product.template",
        "search_read",
        [[]],
        { fields, limit: 200 } as Record<string, unknown>,
      );
      const broadTemplates = this.asArray(broadTemplatesUnknown).map(
        (tUnknown) => this.asRecord(tUnknown),
      );
      const matchedTemplates = this.filterRecordsByTokens(
        broadTemplates,
        searchTokens,
      );
      return matchedTemplates.map((record) => this.mapProduct(record));
    }

    return [];
  }

  async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    const idempotencyKey =
      request.idempotencyKey ||
      this.computeDeterministicKey(
        request.customerName || "",
        request.items,
        request.comment || "",
      );
    try {
      const existingIdsUnknown = await this.executeKw("sale.order", "search", [
        [["client_order_ref", "=", idempotencyKey]],
      ]);
      const existingIds = this.asArray(existingIdsUnknown);
      const existingId =
        existingIds.length > 0 ? this.getNumber(existingIds[0]) : undefined;
      if (existingId) {
        const orderReadUnknown = await this.executeKw("sale.order", "read", [
          [existingId],
          ["name", "date_order", "amount_total", "state"],
        ]);
        const orders = this.asArray(orderReadUnknown);
        const order = this.asRecord(orders[0]);
        return {
          id: String(existingId),
          number: this.getString(order.name) ?? `SO-${existingId}`,
          date: this.getString(order.date_order) ?? new Date().toISOString(),
          customerName: request.customerName,
          items: request.items.map((i) => ({
            ...i,
            productId: "",
            amount: i.quantity * i.price,
          })),
          total: this.getNumber(order.amount_total) ?? 0,
          status: "draft",
          comment: request.comment,
        };
      }
    } catch {}

    // Note: Creating 'account.move' directly is complex. Sale Order is safer.

    // Find customer by name or create one (simplified)
    const customerId = await this.findOrCreatePartner(
      request.customerName || "Customer",
    );

    // Prepare order lines
    const orderLines: unknown[] = [];
    for (const item of request.items) {
      // Find product by name (simplified)
      const productId = await this.findProductId(item.productName);
      if (productId) {
        orderLines.push([
          0,
          0,
          {
            product_id: productId,
            product_uom_qty: item.quantity,
            price_unit: item.price,
          },
        ]);
      } else {
        // Fallback: create manual line item so invoice flow does not fail on strict catalog matching.
        orderLines.push([
          0,
          0,
          {
            name: item.productName,
            product_uom_qty: item.quantity,
            price_unit: item.price,
          },
        ]);
      }
    }

    if (orderLines.length === 0) {
      throw new Error("Cannot create invoice without line items");
    }

    const orderId = await this.executeKw("sale.order", "create", [
      {
        partner_id: customerId,
        order_line: orderLines,
        note: request.comment,
        client_order_ref: idempotencyKey,
      },
    ]);

    // Fetch created order details
    const orderIdNum = this.getNumber(orderId);
    if (!orderIdNum) {
      throw new Error("Failed to create Odoo sale.order");
    }

    const ordersUnknown = await this.executeKw("sale.order", "read", [
      [orderIdNum],
      ["name", "date_order", "amount_total", "state"],
    ]);
    const orders = this.asArray(ordersUnknown);
    const order = this.asRecord(orders[0]);

    return {
      id: String(this.getNumber(order.id) ?? orderIdNum),
      number: this.getString(order.name) ?? `SO-${orderIdNum}`,
      date: this.getString(order.date_order) ?? new Date().toISOString(),
      customerName: request.customerName,
      items: request.items.map((i) => ({
        ...i,
        productId: "",
        amount: i.quantity * i.price,
      })), // Simplified mapping
      total: this.getNumber(order.amount_total) ?? 0,
      status: "draft", // sale order is draft quotation by default
      comment: request.comment,
    };
  }

  private computeDeterministicKey(
    customerName: string,
    items: { productName: string; quantity: number; price: number }[],
    comment: string,
  ): string {
    const payload = JSON.stringify({
      customerName,
      items: items
        .map((i) => ({
          n: i.productName,
          q: i.quantity,
          p: i.price,
        }))
        .sort((a, b) => (a.n > b.n ? 1 : a.n < b.n ? -1 : 0)),
      comment,
    });
    // Simple FNV-1a hash for deterministic short key
    let h = 2166136261 >>> 0;
    for (let i = 0; i < payload.length; i++) {
      h ^= payload.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `AXON-${(h >>> 0).toString(16)}`;
  }

  private async findOrCreatePartner(name: string): Promise<number> {
    const partnersUnknown = await this.executeKw(
      "res.partner",
      "search_read",
      [[["name", "=", name]]],
      { limit: 1, fields: ["id"] } as Record<string, unknown>,
    );
    const partners = this.asArray(partnersUnknown);
    const partner = partners[0] ? this.asRecord(partners[0]) : undefined;
    const existingId = partner ? this.getNumber(partner.id) : undefined;
    if (existingId) return existingId;

    const newPartnerIdUnknown = await this.executeKw("res.partner", "create", [
      { name },
    ]);
    const newPartnerId = this.getNumber(newPartnerIdUnknown);
    if (!newPartnerId) throw new Error("Failed to create Odoo partner");
    return newPartnerId;
  }

  private async findProductId(name: string): Promise<number | null> {
    const searchArgs = this.buildProductSearchArgs(name);
    const productsUnknown = await this.executeKw(
      "product.product",
      "search_read",
      searchArgs,
      { limit: 1, fields: ["id"] } as Record<string, unknown>,
    );
    const products = this.asArray(productsUnknown);
    const product = products[0] ? this.asRecord(products[0]) : undefined;
    const id = product ? this.getNumber(product.id) : undefined;
    if (id) return id;

    const templatesUnknown = await this.executeKw(
      "product.template",
      "search_read",
      searchArgs,
      { limit: 1, fields: ["id"] } as Record<string, unknown>,
    );
    const templates = this.asArray(templatesUnknown);
    const firstTemplate = templates[0]
      ? this.asRecord(templates[0])
      : undefined;
    const templateId = firstTemplate
      ? this.getNumber(firstTemplate.id)
      : undefined;
    if (!templateId) return null;

    const variantUnknown = await this.executeKw(
      "product.product",
      "search_read",
      [[["product_tmpl_id", "=", templateId]]],
      { limit: 1, fields: ["id"] } as Record<string, unknown>,
    );
    const variants = this.asArray(variantUnknown);
    const firstVariant = variants[0] ? this.asRecord(variants[0]) : undefined;
    return firstVariant ? (this.getNumber(firstVariant.id) ?? null) : null;
  }
}
