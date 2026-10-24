// =====================================================
// ENTITIES - REPAIR ORDERS MODULE
// =====================================================

export type RepairOrderStatus =
  | 'consulta_recibida'
  | 'presupuestado'
  | 'aceptado'
  | 'en_proceso_reparacion'
  | 'listo_entrega'
  | 'entregado'
  | 'cancelado';

export interface RepairOrder {
  id: number;
  repair_number: string;
  client_id: number;
  equipment_description: string;
  /** Lo que declara el cliente en recepción (distinto del diagnóstico técnico / presupuesto) */
  customer_declared_fault?: string | null;
  diagnosis?: string | null;
  work_description?: string | null;
  reception_date: string;
  delivery_date_estimated?: string | null;
  delivery_date_actual?: string | null;
  /** Montos expuestos como string decimal con 2 decimales (ej. "1234.56") para alinear con el frontend */
  labor_amount: string;
  total_amount: string;
  amount_paid: string;
  status: RepairOrderStatus;
  budget_sent_at?: string | null;
  accepted_at?: string | null;
  days_to_claim?: number | null;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

/** Presupuestos comerciales (`/api/budgets`) asociados a esta orden */
export interface LinkedCommercialBudgetSummary {
  id: number;
  budget_number: string;
  status: string;
  total_amount: number;
}

export interface RepairOrderWithDetails extends RepairOrder {
  client_name?: string;
  client_code?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_cuil_cuit?: string;
  items?: RepairOrderItem[];
  created_by_name?: string;
  balance?: string;
  linked_commercial_budgets?: LinkedCommercialBudgetSummary[];
}

export interface RepairOrderItem {
  id: number;
  repair_order_id: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  stock_deducted: boolean | number;
  created_at: string;
}

export interface CreateRepairOrderData {
  client_id: number;
  equipment_description: string;
  customer_declared_fault: string;
  diagnosis?: string | null;
  work_description?: string | null;
  reception_date: string;
  delivery_date_estimated?: string | null;
  labor_amount?: number;
  notes?: string | null;
}

export interface UpdateRepairOrderData {
  equipment_description?: string;
  customer_declared_fault?: string | null;
  diagnosis?: string | null;
  work_description?: string | null;
  reception_date?: string;
  delivery_date_estimated?: string | null;
  labor_amount?: number;
  notes?: string | null;
}

export interface CreateRepairOrderItemData {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface UpdateRepairOrderItemData {
  quantity?: number;
  unit_price?: number;
}

export interface RepairOrderFilters {
  status?: RepairOrderStatus;
  client_id?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface RepairOrderStats {
  total_orders: number;
  consulta_recibida: number;
  presupuestado: number;
  aceptado: number;
  en_proceso_reparacion: number;
  listo_entrega: number;
  entregado: number;
  cancelado: number;
  total_amount: number;
  amount_paid: number;
}
