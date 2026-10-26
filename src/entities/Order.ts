// =====================================================
// ENTITIES - ORDERS MODULE
// =====================================================

export interface Order {
  id: number;
  order_number: string;
  woocommerce_order_id?: number | null;
  canal_venta?: string | null; // 'woocommerce', 'local', etc.
  json?: any | null; // JSON completo con todos los datos de la orden
  client_id: number;
  status: 'pendiente_preparacion' | 'listo_despacho' | 'pagado' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado';
  total_amount: number;
  order_date: string;
  delivery_date?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  transport_company?: string;
  transport_cost?: number;
  notes?: string;
  remito_status?: 'sin_remito' | 'remito_generado' | 'remito_despachado' | 'remito_entregado';
  stock_reserved?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Campos adicionales de WooCommerce
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  customer_ip_address?: string;
  currency?: string;
  discount_total?: number;
  tax_total?: number;
  date_paid?: string;
  date_completed?: string;
  billing_address_2?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_company?: string;
  shipping_address_2?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_company?: string;
}

export interface OrderWithDetails extends Order {
  client_name?: string;
  client_code?: string;
  client_email?: string;
  client_phone?: string;
  items?: OrderItem[];
  remito_id?: number;
  remito_number?: string;
  woocommerce_details?: WooCommerceOrderDetails;
}

export interface WooCommerceOrderDetails {
  id: number;
  order_id: number;
  woocommerce_order_id: number;
  raw_data: any; // JSON completo del pedido de WooCommerce
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  /** Alícuota IVA de la línea (21, 10.5 o 0) */
  iva_rate?: number;
  batch_number?: string;
  notes?: string;
  stock_reserved?: boolean;
  created_at: string;
  // Campos adicionales de WooCommerce
  woocommerce_item_id?: number;
  woocommerce_product_id?: number;
  woocommerce_variation_id?: number;
  product_name_wc?: string;
  tax_class?: string;
  subtotal?: number;
  subtotal_tax?: number;
  total_tax?: number;
}

export interface CreateOrderData {
  client_id: number;
  order_number?: string; // Número de pedido personalizado (ej: de WooCommerce)
  woocommerce_order_id?: number; // ID del pedido en WooCommerce (para evitar duplicados)
  canal_venta?: string; // 'woocommerce', 'local', etc.
  json?: any; // JSON completo con todos los datos de la orden
  status?: 'pendiente_preparacion' | 'listo_despacho' | 'pagado' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado';
  sync_to_woocommerce?: boolean; // ⭐ NUEVO: Flag para controlar sincronización (por defecto true)
  delivery_date?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  transport_company?: string;
  transport_cost?: number;
  notes?: string;
  items: CreateOrderItemData[];
  // Campos adicionales de WooCommerce
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  customer_ip_address?: string;
  currency?: string;
  discount_total?: number;
  tax_total?: number;
  date_paid?: string;
  date_completed?: string;
  billing_address_2?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_company?: string;
  shipping_address_2?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_company?: string;
  woocommerce_raw_data?: any; // Datos completos de WooCommerce para guardar en woocommerce_order_details
  total_amount?: number; // Total del pedido (si viene de WooCommerce, usar este valor)
}

export interface CreateOrderItemData {
  product_id: number;
  quantity: number;
  unit_price: number;
  /** Override opcional; si no se envía, se toma del producto */
  iva_rate?: number;
  batch_number?: string;
  notes?: string;
  // Campos adicionales de WooCommerce
  woocommerce_item_id?: number;
  woocommerce_product_id?: number;
  woocommerce_variation_id?: number;
  product_name_wc?: string;
  tax_class?: string;
  subtotal?: number;
  subtotal_tax?: number;
  total_tax?: number;
}

export interface UpdateOrderData {
  status?: 'pendiente_preparacion' | 'listo_despacho' | 'pagado' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado';
  delivery_date?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  transport_company?: string;
  transport_cost?: number;
  notes?: string;
  remito_status?: 'sin_remito' | 'remito_generado' | 'remito_despachado' | 'remito_entregado';
  stock_reserved?: boolean;
  json?: any; // ⭐ NUEVO: JSON completo de WooCommerce para actualizaciones
  total_amount?: number; // ⭐ NUEVO: Total del pedido para actualizaciones
  woocommerce_order_id?: number; // ⭐ NUEVO: ID de WooCommerce para actualizaciones
  sync_to_woocommerce?: boolean; // ⭐ NUEVO: Flag para controlar sincronización (por defecto true)
}

export interface UpdateOrderItemData {
  quantity?: number;
  unit_price?: number;
  batch_number?: string;
  notes?: string;
  stock_reserved?: boolean;
}

export interface OrderFilters {
  status?: string;
  client_id?: number;
  remito_status?: string;
  date_from?: string;
  date_to?: string;
  stock_reserved?: boolean;
  has_remito?: boolean;
  page?: number;
  limit?: number;
}

export interface OrderStats {
  total_orders: number;
  pending_preparation: number;
  ready_for_dispatch: number;
  in_process: number;
  completed: number;
  cancelled: number;
  total_value: number;
  average_order_value: number;
  orders_without_remito: number;
  orders_with_stock_reserved: number;
}

