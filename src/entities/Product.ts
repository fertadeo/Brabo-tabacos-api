export interface Product {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  category_id?: number | null;
  price: number;
  /** Alícuota IVA: 21, 10.5 o 0 (precio con IVA incluido) */
  iva_rate?: number;
  stock: number;
  min_stock: number;
  max_stock: number;
  is_active: boolean;
  images?: string[] | null; // Array de URLs de imágenes
  woocommerce_image_ids?: number[] | null; // IDs de medios en WordPress/WooCommerce (para sync sin duplicar)
  woocommerce_id?: number | null; // ID del producto en WooCommerce
  woocommerce_slug?: string | null; // Slug público del producto en WooCommerce
  woocommerce_permalink?: string | null; // URL pública completa del producto en WooCommerce
  woocommerce_json?: any | null; // JSON completo del producto desde WooCommerce (puede ser grande)
  barcode?: string | null;
  qr_code?: string | null;
  /** Peso en kg (envíos, WooCommerce) */
  weight?: number | null;
  /** Longitud en cm (envíos, WooCommerce) */
  length?: number | null;
  /** Ancho en cm (envíos, WooCommerce) */
  width?: number | null;
  /** Alto en cm (envíos, WooCommerce) */
  height?: number | null;
  /** Permitir reservas con stock 0 (venta por encargo); en WooCommerce = backorders 'notify' */
  allow_backorders?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithCategory extends Product {
  category_name?: string;
  /** ID de la categoría en WooCommerce (desde categories.woocommerce_id). Necesario para asignar el producto a la categoría correcta al sincronizar. */
  category_woocommerce_id?: number | null;
}

export interface CreateProductData {
  code: string;
  name: string;
  description?: string | null;
  category_id?: number | null;
  price: number;
  iva_rate?: number;
  stock?: number;
  min_stock?: number;
  max_stock?: number;
  images?: string[] | null; // Array de URLs de imágenes
  woocommerce_image_ids?: number[] | null; // IDs de medios en WordPress (para sync)
  woocommerce_id?: number | null; // ID del producto en WooCommerce
  woocommerce_slug?: string | null; // Slug público del producto en WooCommerce
  woocommerce_permalink?: string | null; // URL pública completa del producto en WooCommerce
  woocommerce_json?: any | null; // JSON completo del producto desde WooCommerce
  barcode?: string | null;
  qr_code?: string | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  allow_backorders?: boolean;
  /** Si false, producto inactivo en el ERP (equivalente a “borrador” respecto al catálogo activo). Por defecto true. */
  is_active?: boolean;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  is_active?: boolean;
  woocommerce_image_ids?: number[] | null;
}
