export type PriceListSlug = 'venta_local' | 'mayorista' | 'revendedor';

export interface PriceList {
  id: number;
  name: string;
  slug: PriceListSlug | string;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Precios por slug de lista (API create/update/get producto). */
export interface ProductPricesBySlug {
  venta_local?: number;
  mayorista?: number;
  revendedor?: number;
  [slug: string]: number | undefined;
}

export const DEFAULT_PRICE_LIST_SLUG: PriceListSlug = 'venta_local';

export const KNOWN_PRICE_LIST_SLUGS: PriceListSlug[] = [
  'venta_local',
  'mayorista',
  'revendedor'
];
