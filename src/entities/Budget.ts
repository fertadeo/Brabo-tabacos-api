// =====================================================
// ENTITIES - PRESUPUESTOS (budgets + budget_items)
// =====================================================

import type { SaleCurrency } from './Sale';
import type { BudgetLineInput } from '../utils/budgetItems';

export type { BudgetLineInput };

export type BudgetStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';

export interface Budget {
  id: number;
  budget_number: string;
  client_id: number;
  /** Orden de reparación vinculada; debe ser el mismo `client_id` que la orden */
  repair_order_id?: number | null;
  status: BudgetStatus;
  total_amount: number;
  /** Cotización USD/ARS usada al guardar si hay ítems en dólares */
  exchange_rate?: number | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: number;
  budget_id: number;
  product_id: number | null;
  product_name?: string | null;
  product_code?: string | null;
  /** Texto de línea manual (product_id null) */
  description?: string | null;
  quantity: number;
  unit_price: number;
  currency: SaleCurrency;
  total_price: number;
  created_at: string;
}

export interface BudgetWithDetails extends Budget {
  client_name?: string;
  client_code?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_cuil_cuit?: string;
  /** Datos de la orden de reparación cuando `repair_order_id` está definido */
  repair_order_number?: string | null;
  repair_order_status?: string | null;
  repair_order_equipment_description?: string | null;
  items?: BudgetItem[];
  item_count?: number;
}

export interface CreateBudgetData {
  client_id: number;
  items: BudgetLineInput[];
  /** Opcional: vincular a una orden de reparación (mismo cliente obligatorio) */
  repair_order_id?: number | null;
  valid_until?: string | null;
  notes?: string | null;
  /** Cotización USD/ARS requerida si algún ítem está en USD */
  exchange_rate?: number | null;
  /** Si true, permite incluir productos inactivos en el presupuesto */
  allow_inactive?: boolean;
}

export interface UpdateBudgetData {
  client_id?: number;
  /** En borrador: asignar o `null` para desvincular */
  repair_order_id?: number | null;
  valid_until?: string | null;
  notes?: string | null;
  items?: BudgetLineInput[];
  exchange_rate?: number | null;
  allow_inactive?: boolean;
}

export interface BudgetFilters {
  client_id?: number;
  repair_order_id?: number;
  status?: BudgetStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface BudgetListResult {
  budgets: BudgetWithDetails[];
  total: number;
  page: number;
  limit: number;
}

export interface BudgetStats {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  rejected: number;
  expired: number;
  total_amount_draft: number;
  total_amount_sent: number;
}

export interface ConvertBudgetToSaleData {
  payment_method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  payment_details?: {
    efectivo?: number;
    tarjeta?: number;
    transferencia?: number;
  };
  notes?: string;
  sync_to_woocommerce?: boolean;
  allow_inactive?: boolean;
  /** Si se envía, reemplaza al cliente del presupuesto en la venta */
  client_id?: number;
}
