export type PosDiscountThresholdType = 'quantity' | 'amount';
export type PosDiscountType = 'percent' | 'fixed';

export interface PosQuantityDiscount {
  id: number;
  name: string;
  /** quantity = por unidades; amount = por importe de línea (lista × cant) */
  threshold_type: PosDiscountThresholdType;
  min_quantity: number;
  min_amount: number;
  /** percent = %; fixed = monto fijo por unidad */
  discount_type: PosDiscountType;
  discount_percent: number;
  discount_amount: number;
  price_list_slug: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePosQuantityDiscountData {
  name: string;
  threshold_type?: PosDiscountThresholdType;
  min_quantity?: number;
  min_amount?: number;
  discount_type?: PosDiscountType;
  discount_percent?: number;
  discount_amount?: number;
  price_list_slug?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export type UpdatePosQuantityDiscountData = Partial<CreatePosQuantityDiscountData>;
