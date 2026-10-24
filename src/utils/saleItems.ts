/** Línea de catálogo en POST /api/sales */
export interface CreateSaleCatalogItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  /** Override opcional; si no se envía, se toma del producto */
  iva_rate?: number;
}

/** Línea manual en POST /api/sales */
export interface CreateSaleManualItem {
  description: string;
  quantity: number;
  unit_price: number;
  /** Default 21% si no se envía */
  iva_rate?: number;
}

export type CreateSaleLineInput = CreateSaleCatalogItem | CreateSaleManualItem;

export function isCatalogSaleLine(
  item: CreateSaleLineInput
): item is CreateSaleCatalogItem {
  return (item as CreateSaleCatalogItem).product_id != null;
}

export function normalizeCreateSaleLine(raw: Record<string, unknown>): CreateSaleLineInput {
  const productRaw = raw.product_id ?? raw.productId;
  let product_id: number | undefined;
  if (productRaw !== undefined && productRaw !== null && productRaw !== '') {
    product_id =
      typeof productRaw === 'string' ? parseInt(productRaw, 10) : Number(productRaw);
    if (!Number.isFinite(product_id) || product_id < 1) {
      product_id = undefined;
    }
  }

  const descRaw = raw.description;
  const description =
    typeof descRaw === 'string' ? descRaw.trim() : descRaw != null ? String(descRaw).trim() : '';

  const quantityRaw = raw.quantity;
  const quantity =
    typeof quantityRaw === 'string' ? parseInt(quantityRaw, 10) : Number(quantityRaw);

  const unitPriceRaw = raw.unit_price ?? raw.unitPrice;
  const unit_price =
    typeof unitPriceRaw === 'string' ? parseFloat(unitPriceRaw) : Number(unitPriceRaw);

  const hasProduct = product_id != null;
  const hasDescription = description.length > 0;

  if (hasProduct === hasDescription) {
    throw new Error(
      'Cada ítem debe tener product_id o description (no ambos ni ninguno)'
    );
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error('quantity debe ser un entero mayor o igual a 1');
  }

  if (!Number.isFinite(unit_price) || unit_price < 0) {
    throw new Error('unit_price debe ser un número mayor o igual a 0');
  }

  const ivaRaw = raw.iva_rate ?? raw.ivaRate;
  let iva_rate: number | undefined;
  if (ivaRaw !== undefined && ivaRaw !== null && ivaRaw !== '') {
    iva_rate =
      typeof ivaRaw === 'string' ? parseFloat(ivaRaw) : Number(ivaRaw);
    if (!Number.isFinite(iva_rate)) {
      throw new Error('iva_rate debe ser 0, 10.5 o 21');
    }
    if (iva_rate !== 0 && Math.abs(iva_rate - 10.5) > 0.01 && Math.abs(iva_rate - 21) > 0.01) {
      throw new Error('iva_rate debe ser 0, 10.5 o 21');
    }
  }

  if (hasProduct) {
    return {
      product_id: product_id!,
      quantity,
      unit_price,
      ...(iva_rate !== undefined ? { iva_rate } : {})
    };
  }

  if (description.length > 500) {
    throw new Error('description no puede exceder 500 caracteres');
  }

  return {
    description,
    quantity,
    unit_price,
    ...(iva_rate !== undefined ? { iva_rate } : {})
  };
}

export function saleItemDisplayName(row: {
  product_id?: number | null;
  product_name?: string | null;
  description?: string | null;
}): string {
  const fromApi = (row.product_name || row.description || '').trim();
  if (fromApi) return fromApi;
  if (row.product_id != null && row.product_id > 0) {
    return `Producto #${row.product_id}`;
  }
  return 'Ítem';
}

export function saleItemFiscalCodigo(row: {
  product_id?: number | null;
  product_code?: string | null;
}): string {
  if (row.product_id == null || row.product_id < 1) return '0';
  const code = (row.product_code || '').trim();
  return code || String(row.product_id);
}

export interface SaleItemForFacturadorDetalle {
  product_id?: number | null;
  product_name?: string | null;
  product_code?: string | null;
  description?: string | null;
  quantity: number | string;
  unit_price: number | string;
}

export interface FacturadorDetalleLine {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export function parseSaleItemQuantity(quantity: unknown): number {
  const n = typeof quantity === 'string' ? parseInt(quantity, 10) : Number(quantity);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Líneas de detalle alineadas al payload de POST /api/facturas (PDF / metadatos). */
export function buildFacturadorDetalleLines(
  items: SaleItemForFacturadorDetalle[],
  round2: (value: number) => number
): FacturadorDetalleLine[] {
  return items.map((item) => ({
    codigo: saleItemFiscalCodigo(item),
    descripcion: saleItemDisplayName(item),
    cantidad: parseSaleItemQuantity(item.quantity),
    precioUnitario: round2(Number(item.unit_price))
  }));
}

/** Decide si el detalle se incluye en la emisión (misma regla que buildPayloadFromSale). */
export function resolveFacturadorDetalleForEmision(
  items: SaleItemForFacturadorDetalle[],
  importeFiscal: number,
  round2: (value: number) => number,
  tolerance = 0.02
): {
  detalle: FacturadorDetalleLine[];
  incluidoEnEmision: boolean;
  detalleSum: number;
  diff: number;
} {
  const detalle = buildFacturadorDetalleLines(items, round2);
  if (detalle.length === 0) {
    return { detalle, incluidoEnEmision: false, detalleSum: 0, diff: 0 };
  }
  const detalleSum = round2(
    detalle.reduce((sum, line) => sum + line.cantidad * line.precioUnitario, 0)
  );
  const diff = round2(Math.abs(detalleSum - importeFiscal));
  return {
    detalle,
    incluidoEnEmision: diff <= tolerance,
    detalleSum,
    diff
  };
}
