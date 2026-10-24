export interface Remito {
  id: number;
  remito_number: string;
  order_id: number;
  client_id: number;
  remito_type: 'entrega_cliente' | 'traslado_interno' | 'devolucion' | 'consignacion';
  status: 'generado' | 'preparando' | 'listo_despacho' | 'en_transito' | 'entregado' | 'devuelto' | 'cancelado';
  
  // Fechas del proceso logístico
  generation_date: string;
  preparation_date?: string;
  dispatch_date?: string;
  delivery_date?: string;
  
  // Información de entrega
  delivery_address?: string;
  delivery_city?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  
  // Información de transporte
  transport_company?: string;
  tracking_number?: string;
  transport_cost: number;
  
  // Totales
  total_products: number;
  total_quantity: number;
  total_value: number;
  
  // Observaciones
  preparation_notes?: string;
  delivery_notes?: string;
  signature_data?: string;
  delivery_photo?: string;
  
  // Control
  created_by?: number;
  delivered_by?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RemitoWithDetails extends Remito {
  // Información relacionada
  client_name?: string;
  client_code?: string;
  order_number?: string;
  created_by_name?: string;
  delivered_by_name?: string;
  
  // Items del remito
  items?: RemitoItem[];
  
  // Trazabilidad
  tracking_history?: TrazabilidadEntry[];
}

export interface CreateRemitoData {
  order_id: number;
  client_id: number;
  remito_type?: 'entrega_cliente' | 'traslado_interno' | 'devolucion' | 'consignacion';
  delivery_address?: string;
  delivery_city?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  transport_company?: string;
  transport_cost?: number;
  preparation_notes?: string;
  items: CreateRemitoItemData[];
}

export interface UpdateRemitoData {
  status?: 'generado' | 'preparando' | 'listo_despacho' | 'en_transito' | 'entregado' | 'devuelto' | 'cancelado';
  delivery_address?: string;
  delivery_city?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  transport_company?: string;
  tracking_number?: string;
  transport_cost?: number;
  preparation_notes?: string;
  delivery_notes?: string;
  signature_data?: string;
  delivery_photo?: string;
  delivered_by?: number;
  preparation_date?: string;
  dispatch_date?: string;
  delivery_date?: string;
}

export interface RemitoItem {
  id: number;
  remito_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  
  // Estado del item
  status: 'preparado' | 'parcial' | 'completo' | 'devuelto';
  prepared_quantity: number;
  delivered_quantity: number;
  returned_quantity: number;
  
  // Información adicional
  batch_number?: string;
  serial_numbers?: string[];
  expiration_date?: string;
  notes?: string;
  
  created_at: string;
  
  // Información relacionada
  product_name?: string;
  product_code?: string;
}

export interface CreateRemitoItemData {
  product_id: number;
  quantity: number;
  unit_price: number;
  batch_number?: string;
  serial_numbers?: string[];
  expiration_date?: string;
  notes?: string;
}

export interface UpdateRemitoItemData {
  quantity?: number;
  unit_price?: number;
  status?: 'preparado' | 'parcial' | 'completo' | 'devuelto';
  prepared_quantity?: number;
  delivered_quantity?: number;
  returned_quantity?: number;
  batch_number?: string;
  serial_numbers?: string[];
  expiration_date?: string;
  notes?: string;
}

export interface TrazabilidadEntry {
  id: number;
  remito_id: number;
  product_id: number;
  
  // Etapa del proceso
  stage: 'fabricacion' | 'control_calidad' | 'almacenamiento' | 'preparacion' | 'despacho' | 'transito' | 'entrega' | 'devuelto';
  
  // Ubicación y responsable
  location?: string;
  location_details?: string;
  responsible_person?: string;
  responsible_user_id?: number;
  
  // Información de la etapa
  stage_start: string;
  stage_end?: string;
  duration_minutes?: number;
  
  // Datos específicos
  temperature?: number;
  humidity?: number;
  quality_check: boolean;
  quality_notes?: string;
  
  // Información de transporte
  vehicle_plate?: string;
  driver_name?: string;
  driver_phone?: string;
  
  // Observaciones y evidencia
  notes?: string;
  photos?: string[];
  documents?: string[];
  
  // Control
  is_automatic: boolean;
  created_at: string;
  
  // Información relacionada
  product_name?: string;
  responsible_user_name?: string;
}

export interface CreateTrazabilidadData {
  remito_id: number;
  product_id: number;
  stage: 'fabricacion' | 'control_calidad' | 'almacenamiento' | 'preparacion' | 'despacho' | 'transito' | 'entrega' | 'devuelto';
  location?: string;
  location_details?: string;
  responsible_person?: string;
  responsible_user_id?: number;
  stage_end?: string;
  temperature?: number;
  humidity?: number;
  quality_check?: boolean;
  quality_notes?: string;
  vehicle_plate?: string;
  driver_name?: string;
  driver_phone?: string;
  notes?: string;
  photos?: string[];
  documents?: string[];
  is_automatic?: boolean;
}

export interface StockMovement {
  id: number;
  product_id: number;
  movement_type: 'salida_remito' | 'entrada_devolucion' | 'traslado_interno' | 'ajuste_inventario';
  
  // Referencia
  remito_id?: number;
  reference_number?: string;
  reference_type: 'remito' | 'devolucion' | 'traslado' | 'ajuste';
  
  // Cantidades
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  
  // Ubicaciones
  from_location?: string;
  to_location?: string;
  
  // Información adicional
  batch_number?: string;
  notes?: string;
  
  // Control
  created_by?: number;
  created_at: string;
  
  // Información relacionada
  product_name?: string;
  product_code?: string;
  remito_number?: string;
  created_by_name?: string;
}

export interface DeliveryZone {
  id: number;
  name: string;
  description?: string;
  city?: string;
  province?: string;
  postal_codes: string[];
  
  // Configuración de entrega
  delivery_time_days: number;
  delivery_cost: number;
  free_delivery_minimum?: number;
  
  // Estado
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransportCompany {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  
  // Configuración de servicios
  services: string[];
  coverage_zones: string[];
  rates?: Record<string, any>;
  
  // Estado
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogisticsConfig {
  id: number;
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Interfaces para filtros y consultas
export interface RemitoFilters {
  status?: string;
  remito_type?: string;
  client_id?: number;
  order_id?: number;
  date_from?: string;
  date_to?: string;
  transport_company?: string;
  tracking_number?: string;
  page?: number;
  limit?: number;
}

export interface RemitoStats {
  total_remitos: number;
  pending_delivery: number;
  in_transit: number;
  delivered_today: number;
  delayed_deliveries: number;
  total_value: number;
  average_delivery_time: number;
}

export interface TrazabilidadFilters {
  remito_id?: number;
  product_id?: number;
  stage?: string;
  date_from?: string;
  date_to?: string;
  responsible_user_id?: number;
  page?: number;
  limit?: number;
}
