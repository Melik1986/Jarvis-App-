/**
 * Types for 1C OData integration
 */

export interface OnesConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface StockItem {
  /** Product ID (Ref_Key in 1C) */
  id: string;
  /** Product name (Description) */
  name: string;
  /** SKU/Article (Артикул) */
  sku?: string;
  /** Current stock quantity */
  quantity: number;
  /** Unit of measure */
  unit?: string;
  /** Warehouse name */
  warehouse?: string;
}

export interface Product {
  /** Product ID (Ref_Key in 1C) */
  id: string;
  /** Product name (Description) */
  name: string;
  /** SKU/Article */
  sku?: string;
  /** Price */
  price?: number;
  /** Unit of measure */
  unit?: string;
  /** Is service (not physical product) */
  isService?: boolean;
}

export interface InvoiceLineItem {
  /** Product ID */
  productId: string;
  /** Product name (for display) */
  productName?: string;
  /** Quantity */
  quantity: number;
  /** Price per unit */
  price: number;
  /** Total amount (quantity * price) */
  amount: number;
}

export interface InvoiceDto {
  /** Customer/Contractor ID */
  customerId?: string;
  /** Customer name (will search if customerId not provided) */
  customerName?: string;
  /** Invoice date (defaults to now) */
  date?: Date;
  /** Line items */
  items: InvoiceLineItem[];
  /** Comment/Notes */
  comment?: string;
}

export interface Invoice {
  /** Invoice ID (Ref_Key in 1C) */
  id: string;
  /** Invoice number */
  number: string;
  /** Invoice date */
  date: Date;
  /** Customer name */
  customerName: string;
  /** Total amount */
  total: number;
  /** Status */
  status: "draft" | "posted" | "cancelled";
}

/**
 * OData response wrapper from 1C
 */
export interface ODataResponse<T> {
  "odata.metadata"?: string;
  value: T[];
}

/**
 * 1C Catalog item (Номенклатура)
 */
export interface Catalog_Nomenclature {
  Ref_Key: string;
  Description: string;
  Артикул?: string;
  ЕдиницаИзмерения_Key?: string;
  ЭтоУслуга?: boolean;
}

/**
 * 1C Stock balance (Остатки)
 */
export interface AccumulationRegister_Stock {
  Номенклатура_Key: string;
  Склад_Key?: string;
  КоличествоBalance: number;
}
