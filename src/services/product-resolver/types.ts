/**
 * Resultado de búsqueda de producto por código de barras
 */
export interface ProductResult {
  title: string;
  description?: string;
  brand?: string;
  images?: string[];
  source: string;
  source_site?: string; // Sitio donde se encontró (ej. "Mercado Libre", "Fravega")
  suggested_price?: number; // Precio sugerido si está disponible
  category_suggestion?: string; // Categoría sugerida
  provider_response_time?: number; // Tiempo de respuesta del provider en ms
}

/**
 * Opciones de búsqueda por código de barras (ej. restringir a un sitio)
 */
export interface BarcodeSearchOptions {
  /** Restringir resultados a un sitio: mercadolibre, fravega, garbarino */
  prefer_site?: 'mercadolibre' | 'fravega' | 'garbarino';
}

/** Dominios para operador site: en búsquedas (prefer_site) */
export const PREFER_SITE_DOMAINS: Record<NonNullable<BarcodeSearchOptions['prefer_site']>, string> = {
  mercadolibre: 'mercadolibre.com.ar',
  fravega: 'fravega.com',
  garbarino: 'garbarino.com',
};

/**
 * Interfaz que deben implementar todos los providers de búsqueda
 */
export interface ProductProvider {
  name: string;
  search(barcode: string, options?: BarcodeSearchOptions): Promise<ProductResult | null>;
}

/**
 * Respuesta completa del lookup de barcode
 */
export interface BarcodeLookupResponse {
  title: string;
  description?: string;
  brand?: string;
  images?: string[];
  source: string;
  source_site?: string; // Sitio donde se encontró (ej. "Mercado Libre", "Fravega")
  suggested_price?: number;
  category_suggestion?: string;
  exists_as_product?: boolean;
  product_id?: number;
  product_code?: string;
  current_stock?: number;
  cached_at?: string;
  provider_response_time?: number;
  preview_message?: string;
  available_actions: {
    accept: boolean;
    modify: boolean;
    ignore: boolean;
    add_stock?: boolean;
  };
}
