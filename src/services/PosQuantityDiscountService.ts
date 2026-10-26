import {
  CreatePosQuantityDiscountData,
  PosQuantityDiscount,
  UpdatePosQuantityDiscountData
} from '../entities/PosQuantityDiscount';
import { KNOWN_PRICE_LIST_SLUGS } from '../entities/PriceList';
import { PosQuantityDiscountRepository } from '../repositories/PosQuantityDiscountRepository';

const ALLOWED_SLUGS = new Set<string>(KNOWN_PRICE_LIST_SLUGS);

export class PosQuantityDiscountService {
  private repo = new PosQuantityDiscountRepository();

  async list(activeOnly = false): Promise<PosQuantityDiscount[]> {
    return this.repo.findAll(activeOnly);
  }

  async getById(id: number): Promise<PosQuantityDiscount | null> {
    return this.repo.findById(id);
  }

  private validatePayload(
    data: CreatePosQuantityDiscountData | UpdatePosQuantityDiscountData,
    isCreate: boolean
  ) {
    if (isCreate || data.name !== undefined) {
      const name = String(data.name ?? '').trim();
      if (!name) throw new Error('El nombre es obligatorio');
    }

    const thresholdType = data.threshold_type ?? (isCreate ? 'quantity' : undefined);
    if (thresholdType !== undefined && thresholdType !== 'quantity' && thresholdType !== 'amount') {
      throw new Error('threshold_type debe ser quantity o amount');
    }

    const discountType = data.discount_type ?? (isCreate ? 'percent' : undefined);
    if (discountType !== undefined && discountType !== 'percent' && discountType !== 'fixed') {
      throw new Error('discount_type debe ser percent o fixed');
    }

    if (isCreate || data.min_quantity !== undefined) {
      const q = Number(data.min_quantity ?? 1);
      if (!Number.isFinite(q) || q < 1) throw new Error('min_quantity debe ser >= 1');
    }

    if (isCreate || data.min_amount !== undefined) {
      const a = Number(data.min_amount ?? 0);
      if (!Number.isFinite(a) || a < 0) throw new Error('min_amount debe ser >= 0');
    }

    if (isCreate || data.discount_percent !== undefined) {
      const p = Number(data.discount_percent ?? 0);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new Error('discount_percent debe estar entre 0 y 100');
      }
    }

    if (isCreate || data.discount_amount !== undefined) {
      const a = Number(data.discount_amount ?? 0);
      if (!Number.isFinite(a) || a < 0) throw new Error('discount_amount debe ser >= 0');
    }

    if (isCreate) {
      const tt = data.threshold_type === 'amount' ? 'amount' : 'quantity';
      const dt = data.discount_type === 'fixed' ? 'fixed' : 'percent';
      if (tt === 'amount' && Number(data.min_amount ?? 0) <= 0) {
        throw new Error('Para umbral por importe, min_amount debe ser > 0');
      }
      if (dt === 'percent' && Number(data.discount_percent ?? 0) <= 0) {
        throw new Error('Para descuento %, discount_percent debe ser > 0');
      }
      if (dt === 'fixed' && Number(data.discount_amount ?? 0) <= 0) {
        throw new Error('Para descuento por monto, discount_amount debe ser > 0');
      }
    }

    if (data.price_list_slug !== undefined && data.price_list_slug !== null && data.price_list_slug !== '') {
      if (!ALLOWED_SLUGS.has(String(data.price_list_slug))) {
        throw new Error('price_list_slug inválido (venta_local | mayorista | revendedor | null)');
      }
    }
  }

  async create(data: CreatePosQuantityDiscountData): Promise<PosQuantityDiscount> {
    this.validatePayload(data, true);
    return this.repo.create({
      ...data,
      threshold_type: data.threshold_type === 'amount' ? 'amount' : 'quantity',
      discount_type: data.discount_type === 'fixed' ? 'fixed' : 'percent',
      min_quantity: data.min_quantity ?? 1,
      min_amount: data.min_amount ?? 0,
      discount_percent: data.discount_percent ?? 0,
      discount_amount: data.discount_amount ?? 0
    });
  }

  async update(id: number, data: UpdatePosQuantityDiscountData): Promise<PosQuantityDiscount> {
    this.validatePayload(data, false);
    return this.repo.update(id, data);
  }

  async remove(id: number): Promise<void> {
    const ok = await this.repo.delete(id);
    if (!ok) throw new Error('Descuento no encontrado');
  }
}
