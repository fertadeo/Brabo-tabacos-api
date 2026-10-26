export interface PosQuantityDiscount {
  id: number;
  name: string;
  min_quantity: number;
  discount_percent: number;
  price_list_slug: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePosQuantityDiscountData {
  name: string;
  min_quantity: number;
  discount_percent: number;
  price_list_slug?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export type UpdatePosQuantityDiscountData = Partial<CreatePosQuantityDiscountData>;
