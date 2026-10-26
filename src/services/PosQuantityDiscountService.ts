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

  private validatePayload(data: CreatePosQuantityDiscountData | UpdatePosQuantityDiscountData, isCreate: boolean) {
    if (isCreate || data.name !== undefined) {
      const name = String(data.name ?? '').trim();
      if (!name) throw new Error('El nombre es obligatorio');
    }
    if (isCreate || data.min_quantity !== undefined) {
      const q = Number(data.min_quantity);
      if (!Number.isFinite(q) || q < 1) throw new Error('min_quantity debe ser >= 1');
    }
    if (isCreate || data.discount_percent !== undefined) {
      const p = Number(data.discount_percent);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new Error('discount_percent debe estar entre 0 y 100');
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
    return this.repo.create(data);
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
