// Common types for the ERP system

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// User and Authentication types
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  VIEWER = 'viewer',
  GERENCIA = 'gerencia',
  VENTAS = 'ventas',
  LOGISTICA = 'logistica',
  FINANZAS = 'finanzas',
  SUPERADMIN = 'superadmin'
}

// Dashboard types
export interface DashboardStats {
  /** Total ventas del día: pedidos (WooCommerce/local) + ventas POS */
  dailySales: number;
  /** Ventas del día solo de pedidos (orders, incl. WooCommerce) */
  dailySalesFromOrders?: number;
  /** Ventas del día solo del POS (tabla sales) */
  dailySalesFromPos?: number;
  activeOrders: number;
  activeClients: number;
  criticalProducts: number;
  stockMinority: number;
  stockMajority: number;
  customOrders: number;
}

// Stock types
export interface Product {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  category_id?: number | null;
  category_name?: string;
  price: number;
  stock: number;
  min_stock: number;
  max_stock: number;
  is_active: boolean;
  images?: string[] | null; // Array de URLs de imágenes desde WooCommerce
  woocommerce_id?: number | null; // ID del producto en WooCommerce
  woocommerce_slug?: string | null; // Slug público del producto en WooCommerce
  woocommerce_permalink?: string | null; // URL pública completa del producto en WooCommerce
  woocommerce_json?: any | null; // JSON completo del producto desde WooCommerce (puede ser grande)
  barcode?: string | null;
  qr_code?: string | null;
  created_at: string;
  updated_at: string;
}

// Client types (tipo de negocio)
export enum ClientType {
  MAYORISTA = 'mayorista',
  MINORISTA = 'minorista',
  PERSONALIZADO = 'personalizado'
}

// Personería (tipo de persona para facturación)
export enum Personeria {
  PERSONA_FISICA = 'persona_fisica',
  PERSONA_JURIDICA = 'persona_juridica',
  CONSUMIDOR_FINAL = 'consumidor_final'
}

export type ClientTaxCondition =
  | 'inscripto'
  | 'consumidor_final'
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento';

export enum SalesChannel {
  WOOCOMMERCE_MINORISTA = 'woocommerce_minorista',
  WOOCOMMERCE_MAYORISTA = 'woocommerce_mayorista',
  MERCADOLIBRE = 'mercadolibre',
  SISTEMA_MFCOMPUTERS = 'sistema_mfcomputers',
  MANUAL = 'manual',
  OTRO = 'otro'
}

export interface Client {
  id: number;
  code: string;
  client_type: ClientType;
  sales_channel: SalesChannel;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  personeria: Personeria;
  cuil_cuit?: string | null;
  tax_condition?: ClientTaxCondition | null;
  condicion_iva_receptor?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Order types
export interface Order {
  id: number;
  orderNumber: string;
  clientId: number;
  status: OrderStatus;
  totalAmount: number;
  orderDate: Date;
  deliveryDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  IN_PROCESS = 'in_process',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Production types
export interface ProductionOrder {
  id: number;
  orderNumber: string;
  productId: number;
  quantity: number;
  status: ProductionStatus;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProductionStatus {
  PENDING = 'pending',
  IN_PROCESS = 'in_process',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Purchase types
export enum PurchaseStatus {
  PENDING = 'pending',
  RECEIVED = 'received',
  CANCELLED = 'cancelled'
}

export type SupplierType = 'productivo' | 'no_productivo' | 'otro_pasivo';
export type IdentificationType = 'CUIT' | 'CUIL' | 'DNI' | 'PASAPORTE' | 'OTRO';
export type VatCondition = 'Responsable Inscripto' | 'Monotributista' | 'Exento' | 'Iva Exento' | 'No Responsable' | 'Consumidor Final';

export interface Supplier {
  id: number;
  code: string;
  supplier_type: SupplierType;
  name: string;
  legal_name?: string; // Razón Social Proveedor
  trade_name?: string; // Nombre de Fantasía
  purchase_frequency?: string; // Frecuencia de Compra
  id_type?: IdentificationType; // Tipo de identificación
  tax_id?: string; // CUIT
  gross_income?: string; // Ingresos Brutos
  vat_condition?: VatCondition; // Condición IVA
  account_description?: string; // Descripción de Cuenta
  product_service?: string; // Producto/Servicio
  integral_summary_account?: string; // Cuenta de Resumen Integral
  cost?: number; // Costo
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  has_account: boolean;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales
  account?: import('../entities/SupplierAccount').SupplierAccount;
}

export interface CreateSupplierData {
  code: string;
  name: string;
  supplier_type?: SupplierType;
  legal_name?: string;
  trade_name?: string;
  purchase_frequency?: string;
  id_type?: IdentificationType;
  tax_id?: string;
  gross_income?: string;
  vat_condition?: VatCondition;
  account_description?: string;
  product_service?: string;
  integral_summary_account?: string;
  cost?: number;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  has_account?: boolean;
  payment_terms?: number;
}

export interface UpdateSupplierData {
  code?: string;
  name?: string;
  supplier_type?: SupplierType;
  legal_name?: string;
  trade_name?: string;
  purchase_frequency?: string;
  id_type?: IdentificationType;
  tax_id?: string;
  gross_income?: string;
  vat_condition?: VatCondition;
  account_description?: string;
  product_service?: string;
  integral_summary_account?: string;
  cost?: number;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  has_account?: boolean;
  payment_terms?: number;
  is_active?: boolean;
}

// Export types from entities (to avoid duplication)
// Purchase types are now in src/entities/Purchase.ts
export type { 
  Purchase, 
  CreatePurchaseData, 
  UpdatePurchaseData, 
  ConfirmPurchaseData,
  PurchaseItem, 
  CreatePurchaseItemData, 
  UpdatePurchaseItemData,
  DebtType
} from '../entities/Purchase';

// Supplier Invoice types
export type {
  SupplierInvoice,
  CreateSupplierInvoiceData,
  UpdateSupplierInvoiceData,
  LinkDeliveryNoteData,
  SupplierInvoiceItem,
  CreateSupplierInvoiceItemData,
  UpdateSupplierInvoiceItemData,
  InvoiceStatus,
  PaymentStatus
} from '../entities/SupplierInvoice';

// Supplier Delivery Note types
export type {
  SupplierDeliveryNote,
  CreateSupplierDeliveryNoteData,
  UpdateSupplierDeliveryNoteData,
  LinkInvoiceData,
  SupplierDeliveryNoteItem,
  CreateSupplierDeliveryNoteItemData,
  UpdateSupplierDeliveryNoteItemData,
  DeliveryNoteStatus
} from '../entities/SupplierDeliveryNote';

// Supplier Account types
export type {
  SupplierAccount,
  SupplierAccountSummary,
  SupplierAccountMovement,
  CreateSupplierAccountMovementData,
  UpdateSupplierAccountMovementData,
  MovementType,
  MovementDirection,
  MovementReferenceType,
  MovementStatus
} from '../entities/SupplierAccount';

// Accrued Expense types (Egresos sin factura / Devengamientos)
export type {
  AccruedExpense,
  CreateAccruedExpenseData,
  UpdateAccruedExpenseData,
  LinkInvoiceToExpenseData,
  ExpenseType,
  ExpenseCategory,
  ExpenseStatus
} from '../entities/AccruedExpense';

// Accrued Liability types (Pasivos Devengados)
export type {
  AccruedLiability,
  CreateAccruedLiabilityData,
  UpdateAccruedLiabilityData,
  AccruedLiabilityPayment,
  LinkPaymentToLiabilityData,
  LiabilityType,
  LiabilityStatus
} from '../entities/AccruedLiability';
