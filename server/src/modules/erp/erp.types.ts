export type ErpProvider = "demo" | "1c" | "sap" | "odoo" | "custom";

export interface ErpConfig {
  provider: ErpProvider;
  baseUrl?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiType?: "rest" | "odata" | "graphql";
}

export interface StockItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unit?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  isService?: boolean;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  customerId?: string;
  customerName?: string;
  items: InvoiceItem[];
  total: number;
  status: "draft" | "posted";
  comment?: string;
}

export interface CreateInvoiceRequest {
  customerName?: string;
  items: Omit<InvoiceItem, "productId" | "amount">[];
  comment?: string;
}
