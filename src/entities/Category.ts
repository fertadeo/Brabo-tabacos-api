export interface Category {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  woocommerce_id?: number;
  woocommerce_slug?: string;
  parent_id?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  woocommerce_id?: number;
  woocommerce_slug?: string;
  parent_id?: number | null;
}
